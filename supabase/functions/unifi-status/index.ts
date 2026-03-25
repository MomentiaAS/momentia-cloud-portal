/**
 * UniFi Status Edge Function
 *
 * Routes (POST body):
 *   {}               → list all sites enriched with device names (discovery)
 *   { site_id }      → status for one site (site stats + host info)
 *   { debug: true }  → raw first items from /v1/sites and /v1/hosts (dev only)
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const UNIFI_API_KEY = Deno.env.get('UNIFI_API_KEY') ?? '';
function getUnifiBase() {
  // Support both casing styles for Supabase secret names.
  return Deno.env.get('UNIFI_BASE') ?? Deno.env.get('unifi_base') ?? 'https://api.ui.com';
}
// Some UniFi installations expose proxy/network endpoints under a different host
// (e.g. `https://<id>.id.ui.direct`). When this is configured, proxy calls can
// fall back to it if `api.ui.com` returns 401/403.
function getUnifiDirectBase() {
  // Keep this dynamic so changing secrets doesn't require a cold restart.
  // Supabase secret names are typically lowercase, so we check both.
  return Deno.env.get('UNIFI_DIRECT_BASE') ?? Deno.env.get('unifi_direct_base') ?? '';
}

function getUnifiDirectBaseFlags() {
  return {
    directUpperSet: !!Deno.env.get('UNIFI_DIRECT_BASE'),
    directLowerSet: !!Deno.env.get('unifi_direct_base'),
  };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function unifi(base: string, path: string) {
  const res = await fetch(`${base}${path}`, {
    headers: { 'X-API-KEY': UNIFI_API_KEY, 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`UniFi API ${res.status}: ${text}`);
  }
  return res.json();
}

async function unifiProxy(path: string) {
  const bases = [getUnifiBase()];
  const directBase = getUnifiDirectBase();
  if (directBase) bases.push(directBase);

  const errors: Array<{ base: string; message: string }> = [];
  for (const base of bases) {
    try {
      return await unifi(base, path);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ base, message });
    }
  }
  throw new Error(errors.map(e => `${e.base} -> ${e.message}`).join(' | '));
}

// deno-lint-ignore no-explicit-any
type AnyObj = Record<string, any>;

function pickDeviceName(d: AnyObj): string {
  return (
    d?.reportedState?.name ??
    d?.reportedState?.hostname ??
    d?.name ??
    d?.hostname ??
    d?.reportedState?.hardware?.shortname ??
    d?.reportedState?.hardware?.name ??
    'Unifi device'
  );
}

function pickDeviceIp(d: AnyObj): string | undefined {
  return (
    d?.ipAddress ??
    d?.reportedState?.ip ??
    d?.reportedState?.ipAddress ??
    d?.ip ??
    d?.reportedState?.hardware?.ipAddress ??
    undefined
  );
}

function pickDeviceMac(d: AnyObj): string | undefined {
  return (
    d?.mac ??
    d?.reportedState?.hardware?.mac ??
    d?.reportedState?.hardware?.macAddress ??
    undefined
  );
}

function isProbablyOffline(d: AnyObj): boolean {
  const state = (
    d?.reportedState?.state ??
    d?.state ??
    d?.reportedState?.connectionState ??
    d?.connectionState ??
    d?.status ??
    d?.deviceState
  );
  if (!state) return false;
  const s = String(state).toLowerCase();
  return s === 'disconnected' || s === 'offline';
}

function collectArrayCandidates(payload: AnyObj): AnyObj[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  // Some UniFi proxy endpoints return arrays nested inside objects
  // (e.g. `data: { devices: [...] }` or similar). We need to scan more deeply
  // than just `payload.data` and top-level properties.
  const out: AnyObj[] = [];
  const seenArrays = new Set<any[]>();

  // These endpoints can be deeply nested; keep bounds to avoid runaway scans.
  const MAX_DEPTH = 20;
  const MAX_ITEMS = 8000;

  const walk = (node: unknown, depthLeft: number) => {
    if (out.length >= MAX_ITEMS) return;
    if (depthLeft < 0) return;
    if (!node) return;

    if (Array.isArray(node)) {
      if (seenArrays.has(node)) return;
      seenArrays.add(node);
      for (const item of node) {
        if (out.length >= MAX_ITEMS) break;
        if (item != null) out.push(item as AnyObj);
      }
      return;
    }

    if (typeof node !== 'object') return;

    for (const v of Object.values(node as AnyObj)) {
      walk(v, depthLeft - 1);
      if (out.length >= MAX_ITEMS) return;
    }
  };

  walk(payload, MAX_DEPTH);
  return out;
}

function isProbablyInfraDevice(d: AnyObj): boolean {
  const type = String(d?.type ?? '').toLowerCase();
  if (type && type.includes('console')) return false;

  const short = String(d?.reportedState?.hardware?.shortname ?? d?.hardware?.shortname ?? '').toUpperCase();

  if (type.includes('switch') || type.includes('accesspoint')) return true;
  if (short.startsWith('USW')) return true;
  if (short.startsWith('UAP')) return true;
  if (short.startsWith('U6') || short.startsWith('U7')) return true;
  return false;
}

function uniqByKey<T>(items: T[], keyFn: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = keyFn(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (!UNIFI_API_KEY) {
    return json({ error: 'UNIFI_API_KEY secret is not set on this project.' }, 500);
  }

  const url  = new URL(req.url);
  let siteId = url.searchParams.get('site_id');
  let debug  = url.searchParams.get('debug') === '1';

  if (req.method === 'POST') {
    try {
      const body = await req.json() as { site_id?: string; debug?: boolean };
      siteId = siteId ?? body.site_id ?? null;
      debug  = debug  || !!body.debug;
    } catch { /* no body */ }
  }

  // Debug: return raw first objects from each endpoint
  if (debug) {
    const reqs: Array<{ key: string; promise: Promise<unknown> }> = [
      { key: 'sites', promise: unifiProxy('/v1/sites') },
      { key: 'hosts', promise: unifiProxy('/v1/hosts') },
    ];

    if (siteId) {
      reqs.push(
        { key: 'site_devices_v1', promise: unifiProxy(`/v1/sites/${siteId}/devices`) },
        { key: 'site_hosts_v1', promise: unifiProxy(`/v1/sites/${siteId}/hosts`) },
        { key: 'site_clients_v1', promise: unifiProxy(`/v1/sites/${siteId}/clients`) },
        { key: 'hosts_site_id', promise: unifiProxy(`/v1/hosts?site_id=${siteId}`) },
        // UniFi cloud sometimes exposes device lists via v2 proxy endpoints.
        // These endpoints typically return offline/online device records with
        // name + ip-ish fields depending on the key and UniFi version.
        { key: 'proxy_v2_site_default_device', promise: unifiProxy(`/proxy/network/v2/api/site/default/device`) },
        { key: 'proxy_v2_site_siteId_device', promise: unifiProxy(`/proxy/network/v2/api/site/${siteId}/device`) },

        // Another observed variant in the browser:
        // `/proxy/network/api/s/<site>/stat/device` and `/stat/client`.
        // We call both `default` and the provided `siteId`.
        { key: 'proxy_api_s_default_stat_device', promise: unifiProxy(`/proxy/network/api/s/default/stat/device`) },
        { key: 'proxy_api_s_siteId_stat_device', promise: unifiProxy(`/proxy/network/api/s/${siteId}/stat/device`) },
        { key: 'proxy_api_s_default_stat_client', promise: unifiProxy(`/proxy/network/api/s/default/stat/client`) },
        { key: 'proxy_api_s_siteId_stat_client', promise: unifiProxy(`/proxy/network/api/s/${siteId}/stat/client`) },
      );
    }

    const settled = await Promise.allSettled(reqs.map(r => r.promise));
    const results: AnyObj = {};

    // Extra debug info: sample offline infra devices from global /v1/hosts.
    // This helps determine whether we can derive per-site infra details from host objects.
    const hostsSettledIndex = reqs.findIndex(r => r.key === 'hosts');
    let offlineInfraHostsSample: AnyObj[] = [];
    let offlineNonConsoleHostsSample: AnyObj[] = [];
    if (hostsSettledIndex >= 0) {
      const hostRes = settled[hostsSettledIndex];
      if (hostRes.status === 'fulfilled') {
        const hostsData = (hostRes.value as AnyObj)?.data;
        const arr = Array.isArray(hostsData) ? hostsData : [];

        const offlineHosts = arr.filter(isProbablyOffline).slice(0, 20);
        const offlineNonConsole = offlineHosts.filter(d => {
          const t = String(d?.type ?? '').toLowerCase();
          return t !== 'console' && t !== 'gateway' && t !== 'controller';
        });

        offlineInfraHostsSample = offlineNonConsole
          .filter(isProbablyInfraDevice)
          .slice(0, 10)
          .map((d: AnyObj) => ({
            name: pickDeviceName(d),
            ipAddress: pickDeviceIp(d) ?? null,
            mac: pickDeviceMac(d) ?? null,
            type: d?.type ?? d?.deviceType ?? null,
            reportedShortname: d?.reportedState?.hardware?.shortname ?? d?.hardware?.shortname ?? null,
            siteId: d?.siteId ?? d?.site_id ?? d?.site ?? null,
            state: d?.reportedState?.state ?? d?.state ?? d?.status ?? null,
          }));

        offlineNonConsoleHostsSample = offlineNonConsole.slice(0, 10).map((d: AnyObj) => ({
          name: pickDeviceName(d),
          type: d?.type ?? null,
          shortname: d?.reportedState?.hardware?.shortname ?? d?.hardware?.shortname ?? null,
          ipAddress: pickDeviceIp(d) ?? null,
          mac: pickDeviceMac(d) ?? null,
          reportedState: d?.reportedState?.state ?? null,
          // Keep state-related fields for troubleshooting
          rawState: d?.reportedState?.connectionState ?? d?.state ?? d?.status ?? null,
        }));
      }
    }

    for (let i = 0; i < settled.length; i++) {
      const k = reqs[i].key;
      const r = settled[i];
      if (r.status !== 'fulfilled') {
        results[k] = { error: String(r.reason) };
        continue;
      }
      const val = r.value as AnyObj;
      const data = val?.data;
      const arr = Array.isArray(data) ? data : [];
      const nonNull = arr.filter(x => x != null);

      // Some endpoints (notably /proxy/network/v2/...) may return arrays
      // nested under properties instead of a direct `data: []`.
      const collected = collectArrayCandidates(val);
      const collectedNonNull = collected.filter(x => x != null);

      results[k] = {
        count: arr.length,
        nonNullCount: nonNull.length,
        first: nonNull.slice(0, 1)[0] ?? null,
        collectedCount: collected.length,
        collectedNonNullCount: collectedNonNull.length,
        collectedFirst: collectedNonNull.slice(0, 1)[0] ?? null,
      };
    }

    return json({
      siteId,
      results,
      offlineInfraHostsSample,
      offlineNonConsoleHostsSample,
      debugEnv: {
        unifiBase: getUnifiBase(),
        unifiApiKeySet: !!UNIFI_API_KEY,
        directBaseSet: !!getUnifiDirectBase(),
        directBase: getUnifiDirectBase() || null,
        envKeys: (() => {
          try {
            const keys = Array.from(Deno.env.keys()).map(k => String(k));
            return keys.slice(0, 60);
          } catch {
            return [];
          }
        })(),
        ...getUnifiDirectBaseFlags(),
      },
    });
  }

  try {
    // Always fetch both endpoints — we need hosts for device names
    const [sitesRes, hostsRes] = await Promise.allSettled([
      unifiProxy('/v1/sites'),
      unifiProxy('/v1/hosts'),
    ]);

    const rawSites: AnyObj[] = sitesRes.status === 'fulfilled' ? (sitesRes.value?.data ?? []) : [];
    const rawHosts: AnyObj[] = hostsRes.status === 'fulfilled' ? (hostsRes.value?.data ?? []) : [];

    // Build host lookup by host.id (sites reference hosts via site.hostId)
    const hostById = new Map<string, AnyObj>();
    for (const h of rawHosts) {
      if (h.id) hostById.set(h.id, h);
    }

    if (!siteId) {
      // ── Discovery: return enriched site list ──────────────────────────────
      const enriched = rawSites.map((s: AnyObj) => {
        const host = s.hostId ? hostById.get(s.hostId) : null;
        return {
          siteId:     s.siteId,
          hostId:     s.hostId,
          meta:       s.meta,
          deviceName: host?.reportedState?.name ?? host?.reportedState?.hostname ?? null,
          deviceType: host?.reportedState?.hardware?.shortname ?? null,
          deviceModel: host?.reportedState?.hardware?.name     ?? null,
        };
      });
      return json({ sites: enriched });
    }

    // ── Per-site status ────────────────────────────────────────────────────
    const site = rawSites.find((s: AnyObj) => s.siteId === siteId || s.id === siteId) ?? null;

    // Find the host via site.hostId — NOT by host.siteId (hosts don't carry that field)
    const host = site?.hostId ? hostById.get(site.hostId) ?? null : null;

    // Best-effort: include offline infrastructure devices (switches + access points)
    // for richer alert messages. This depends on which UniFi API endpoints your
    // API key supports, so we treat failures as non-fatal.
    let infraOfflineDevices: AnyObj[] = [];
    try {
      const candidateResponses = await Promise.allSettled([
        unifiProxy(`/proxy/network/v2/api/site/default/device`),
        unifiProxy(`/proxy/network/v2/api/site/${siteId}/device`),
        // Additional inventory variants (often return name/ip + state).
        unifiProxy(`/proxy/network/api/s/default/stat/device`),
        unifiProxy(`/proxy/network/api/s/${siteId}/stat/device`),

        // Fallbacks (may return consoles only depending on API key)
        unifiProxy(`/v1/sites/${siteId}/devices`),
        unifiProxy(`/v1/sites/${siteId}/hosts`),
        unifiProxy(`/v1/sites/${siteId}/clients`),
        unifiProxy(`/v1/hosts?site_id=${siteId}`),
      ]);

      const allDevices: AnyObj[] = [];
      for (const c of candidateResponses) {
        if (c.status !== 'fulfilled') continue;
        const val = c.value as AnyObj;
        allDevices.push(...collectArrayCandidates(val));
      }

      const offlineInfra = allDevices
        .filter(isProbablyInfraDevice)
        .filter(isProbablyOffline)
        .map((d: AnyObj) => ({
          name: pickDeviceName(d),
          ipAddress: pickDeviceIp(d),
          mac: pickDeviceMac(d),
          type: d?.type ?? d?.hardwareType ?? d?.deviceType,
          state: d?.reportedState?.state ?? d?.state ?? d?.status,
        }));

      infraOfflineDevices = uniqByKey(
        offlineInfra,
        (d: AnyObj) => `${d.mac ?? ''}|${d.ipAddress ?? ''}|${d.name ?? ''}`,
      ).slice(0, 5);
    } catch {
      infraOfflineDevices = [];
    }

    // Best-effort device/client inventory for UI drawers.
    let devicesRaw: AnyObj[] = [];
    let clientsRaw: AnyObj[] = [];

    try {
      const deviceResponses = await Promise.allSettled([
        unifiProxy(`/proxy/network/api/s/default/stat/device`),
        unifiProxy(`/proxy/network/api/s/${siteId}/stat/device`),
        unifiProxy(`/proxy/network/v2/api/site/default/device`),
        unifiProxy(`/proxy/network/v2/api/site/${siteId}/device`),
          unifiProxy(`/v1/sites/${siteId}/devices`),
          unifiProxy(`/v1/sites/${siteId}/hosts`),
      ]);

      for (const c of deviceResponses) {
        if (c.status !== 'fulfilled') continue;
        devicesRaw.push(...collectArrayCandidates(c.value as AnyObj));
      }
    } catch { /* non-fatal */ }

    try {
      const clientResponses = await Promise.allSettled([
        unifiProxy(`/proxy/network/api/s/default/stat/client`),
        unifiProxy(`/proxy/network/api/s/${siteId}/stat/client`),
          unifiProxy(`/v1/sites/${siteId}/clients`),
      ]);

      for (const c of clientResponses) {
        if (c.status !== 'fulfilled') continue;
        clientsRaw.push(...collectArrayCandidates(c.value as AnyObj));
      }
    } catch { /* non-fatal */ }

    const devices = uniqByKey(
      devicesRaw,
      (d: AnyObj) => `${pickDeviceMac(d) ?? ''}|${pickDeviceIp(d) ?? ''}|${pickDeviceName(d) ?? ''}`,
    ).map((d: AnyObj) => ({
      name: pickDeviceName(d),
      ipAddress: pickDeviceIp(d),
      mac: pickDeviceMac(d),
      type: d?.type ?? d?.hardwareType ?? d?.deviceType ?? null,
      state: d?.reportedState?.state ?? d?.state ?? d?.status ?? null,
    })).slice(0, 200);

    const clients = uniqByKey(
      clientsRaw,
      (d: AnyObj) => `${pickDeviceMac(d) ?? ''}|${pickDeviceIp(d) ?? ''}|${pickDeviceName(d) ?? ''}`,
    ).map((d: AnyObj) => ({
      name: pickDeviceName(d),
      ipAddress: pickDeviceIp(d),
      mac: pickDeviceMac(d),
      type: d?.type ?? d?.deviceType ?? null,
      state: d?.reportedState?.state ?? d?.state ?? d?.status ?? null,
    })).slice(0, 200);

    return json({ site, host, infraOfflineDevices, devices, clients });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
