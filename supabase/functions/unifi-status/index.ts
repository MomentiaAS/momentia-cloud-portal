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
const UNIFI_BASE    = 'https://api.ui.com';

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

async function unifi(path: string) {
  const res = await fetch(`${UNIFI_BASE}${path}`, {
    headers: { 'X-API-KEY': UNIFI_API_KEY, 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`UniFi API ${res.status}: ${text}`);
  }
  return res.json();
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
    d?.connectionState
  );
  if (!state) return false;
  const s = String(state).toLowerCase();
  return s === 'disconnected' || s === 'offline';
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
      { key: 'sites', promise: unifi('/v1/sites') },
      { key: 'hosts', promise: unifi('/v1/hosts') },
    ];

    if (siteId) {
      reqs.push(
        { key: 'site_devices_v1', promise: unifi(`/v1/sites/${siteId}/devices`) },
        { key: 'site_hosts_v1', promise: unifi(`/v1/sites/${siteId}/hosts`) },
        { key: 'site_clients_v1', promise: unifi(`/v1/sites/${siteId}/clients`) },
        { key: 'hosts_site_id', promise: unifi(`/v1/hosts?site_id=${siteId}`) },
      );
    }

    const settled = await Promise.allSettled(reqs.map(r => r.promise));
    const results: AnyObj = {};

    for (let i = 0; i < settled.length; i++) {
      const k = reqs[i].key;
      const r = settled[i];
      if (r.status !== 'fulfilled') {
        results[k] = { error: String(r.reason) };
        continue;
      }
      const data = (r.value as AnyObj)?.data;
      const arr = Array.isArray(data) ? data : [];
      results[k] = {
        count: arr.length,
        first: arr.slice(0, 1)[0] ?? null,
      };
    }

    return json({ siteId, results });
  }

  try {
    // Always fetch both endpoints — we need hosts for device names
    const [sitesRes, hostsRes] = await Promise.allSettled([
      unifi('/v1/sites'),
      unifi('/v1/hosts'),
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
      const candidates = await Promise.allSettled([
        unifi(`/v1/sites/${siteId}/devices`),
        unifi(`/v1/sites/${siteId}/hosts`),
        unifi(`/v1/sites/${siteId}/clients`),
        unifi(`/v1/hosts?site_id=${siteId}`),
      ]);

      const all: AnyObj[] = [];
      for (const c of candidates) {
        if (c.status !== 'fulfilled') continue;
        const data = (c.value as AnyObj)?.data;
        if (Array.isArray(data)) all.push(...data);
      }

      const offlineInfra = all
        .filter(isProbablyInfraDevice)
        .filter(isProbablyOffline)
        .map((d: AnyObj) => ({
          name: pickDeviceName(d),
          ipAddress: pickDeviceIp(d),
          mac: pickDeviceMac(d),
          type: d?.type,
          state: d?.reportedState?.state ?? d?.state,
        }));

      infraOfflineDevices = uniqByKey(
        offlineInfra,
        (d: AnyObj) => `${d.mac ?? ''}|${d.ipAddress ?? ''}|${d.name ?? ''}`,
      ).slice(0, 5);
    } catch {
      infraOfflineDevices = [];
    }

    return json({ site, host, infraOfflineDevices });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
