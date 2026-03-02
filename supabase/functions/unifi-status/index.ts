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
    const [s, h] = await Promise.allSettled([unifi('/v1/sites'), unifi('/v1/hosts')]);
    return json({
      firstSite: s.status === 'fulfilled' ? (s.value?.data ?? [])[0] : null,
      firstHost: h.status === 'fulfilled' ? (h.value?.data ?? [])[0] : null,
    });
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

    return json({ site, host });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
