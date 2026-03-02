import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Actual UniFi API shapes (verified against api.ui.com) ────────────────────

export interface UnifiSiteStats {
  counts?: {
    totalDevice?:        number;
    offlineDevice?:      number;
    wiredClient?:        number;
    wifiClient?:         number;
    guestClient?:        number;
    criticalNotification?: number;
  };
  ispInfo?: {
    name?:         string;
    organization?: string;
  };
  percentages?: {
    wanUptime?:  number;
    txRetry?:    number;
  };
  internetIssues?: Array<{
    highLatency?:    boolean;
    latencyAvgMs?:   number;
    latencyMaxMs?:   number;
  }>;
  wans?: {
    WAN?:  { externalIp?: string; wanUptime?: number };
    WAN2?: { externalIp?: string; wanUptime?: number };
  };
}

export interface UnifiSite {
  siteId?:     string;
  hostId?:     string;
  meta?: {
    name?: string;   // internal key ("default")
    desc?: string;   // site description ("Default")
    timezone?: string;
  };
  statistics?: UnifiSiteStats;
  permission?: string;
  // Enriched by Edge Function from /v1/hosts
  deviceName?:  string | null;
  deviceType?:  string | null;
  deviceModel?: string | null;
}

export interface UnifiHost {
  id?:   string;
  type?: string;
  ipAddress?: string;
  reportedState?: {
    name?:     string;      // e.g. "H203_FW01" — display name set in UniFi
    hostname?: string;      // e.g. "H203-FW01" — system hostname
    state?:    string;      // "connected" | "disconnected"
    ip?:       string;
    version?:  string;
    hardware?: {
      name?:      string;   // "UniFi Dream Router 7"
      shortname?: string;   // "UDR7"
      firmwareVersion?: string;
    };
    wans?: Array<{
      type?:    string;     // "WAN" | "WAN2"
      ipv4?:    string;
      ipv6?:    string;
      enabled?: boolean;
      plugged?: boolean;
      interface?: string;
    }>;
  };
}

export interface UnifiStatus {
  site: UnifiSite | null;
  host: UnifiHost | null;
}

export interface UnifiSiteListItem {
  siteId?:      string;
  hostId?:      string;
  meta?: {
    name?: string;
    desc?: string;
  };
  deviceName?:  string | null;
  deviceType?:  string | null;
  deviceModel?: string | null;
}

// ── Hook: per-site status ─────────────────────────────────────────────────────

export function useUnifiStatus(siteId: string | undefined) {
  const [status,  setStatus]  = useState<UnifiStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('unifi-status', {
        body: { site_id: siteId },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      setStatus(data as UnifiStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch UniFi status');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  return { status, loading, error, reload: load };
}

// ── Hook: site discovery (list all sites) ─────────────────────────────────────

export function useUnifiSites() {
  const [sites,   setSites]   = useState<UnifiSiteListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('unifi-status', {
        body: {},
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      setSites((data?.sites ?? []) as UnifiSiteListItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch UniFi sites');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { sites, loading, error, reload: load };
}
