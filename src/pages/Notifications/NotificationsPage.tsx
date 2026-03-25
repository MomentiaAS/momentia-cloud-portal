import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, RefreshCw, ShieldAlert, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAlerts } from '../../hooks/useAlerts';
import { useAllAssets } from '../../hooks/useAssets';
import { useCustomers } from '../../hooks/useCustomers';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { upsertUnifiOfflineAlert, resolveUnifiOfflineAlerts } from '../../lib/db';
import { formatDistanceToNow } from 'date-fns';

const READ_WARRANTY_KEY  = 'momentia-read-warranty-alerts';
const SYNC_THROTTLE_KEY  = 'momentia-unifi-sync-last';
const SYNC_THROTTLE_MS   = 60_000; // 60 seconds between syncs
const WRITER_ROLES = new Set(['superadmin', 'admin', 'technician']);

function readWarrantySet(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_WARRANTY_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { alerts, loading, error, reload, markResolved } = useAlerts();
  const { assets, loading: assetsLoading, error: assetsError, reload: reloadAssets } = useAllAssets();
  const { customers } = useCustomers();
  const readWarranty = readWarrantySet();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const syncRunningRef = useRef(false);

  // ── UniFi offline alert sync ─────────────────────────────────────────────
  const syncUniFiAlerts = useCallback(async (force = false) => {
    // Only writer roles create/update alerts
    if (!profile || !WRITER_ROLES.has(profile.role)) return;
    // Throttle: skip if synced recently (unless forced)
    if (!force) {
      const last = parseInt(sessionStorage.getItem(SYNC_THROTTLE_KEY) ?? '0', 10);
      if (Date.now() - last < SYNC_THROTTLE_MS) return;
    }
    // Guard against concurrent runs
    if (syncRunningRef.current) return;
    syncRunningRef.current = true;
    setSyncing(true);

    try {
      // Some existing customers may not have integrations.unifi set (legacy JSON),
      // so rely on unifiSiteId as the source of truth for syncing.
      const unifiCustomers = customers.filter(c => !!c.unifiSiteId);
      await Promise.allSettled(
        unifiCustomers.map(async (customer) => {
          try {
            const { data, error: fnErr } = await supabase.functions.invoke('unifi-status', {
              body: { site_id: customer.unifiSiteId },
            });
            if (fnErr || data?.error) return;

            const counts = data?.site?.statistics?.counts ?? {};
            const gatewayName =
              data?.host?.reportedState?.name ??
              data?.host?.reportedState?.hostname ??
              data?.host?.reportedState?.hardware?.shortname ??
              data?.host?.reportedState?.hardware?.name ??
              'UniFi Gateway';
            const infraOfflineDevices = (data as any)?.infraOfflineDevices as Array<{
              name?: string;
              ipAddress?: string;
            }> | undefined;
            const offlineGateway = (counts.offlineGatewayDevice ?? 0) as number;
            const offlineWired   = (counts.offlineWiredDevice   ?? 0) as number;
            const offlineWifi    = (counts.offlineWifiDevice    ?? 0) as number;
            const gatewayOffline = offlineGateway > 0;
            const infraOffline   = (offlineWired + offlineWifi) > 0;

            if (gatewayOffline) {
              await upsertUnifiOfflineAlert({
                customerId: customer.id,
                source:     'unifi-offline-gateway',
                severity:   'critical',
                title:      'UniFi: Gateway offline',
                message:    `Customer: ${customer.name}. UniFi gateway (${gatewayName}) reports offline (offlineGatewayDevice: ${offlineGateway}). Site: ${customer.unifiSiteId}`,
              });
            } else {
              await resolveUnifiOfflineAlerts({ customerId: customer.id, source: 'unifi-offline-gateway' });
            }

            if (infraOffline) {
              const infraLines = (infraOfflineDevices ?? []).map(d => {
                const name = d.name ?? 'Unknown device';
                return d.ipAddress ? `- ${name} (${d.ipAddress})` : `- ${name}`;
              });
              const infraDevicesText = infraLines.length > 0
                ? `\nOffline devices:\n${infraLines.join('\n')}`
                : '';
              await upsertUnifiOfflineAlert({
                customerId: customer.id,
                source:     'unifi-offline-infra',
                severity:   'medium',
                title:      'UniFi: Infrastructure offline',
                message:    `Customer: ${customer.name}. UniFi infrastructure reports offline (offlineWiredDevice: ${offlineWired}, offlineWifiDevice: ${offlineWifi}). Gateway: ${gatewayName}. Site: ${customer.unifiSiteId}.${infraDevicesText}`,
              });
            } else {
              await resolveUnifiOfflineAlerts({ customerId: customer.id, source: 'unifi-offline-infra' });
            }
          } catch {
            // Don't surface per-customer sync errors in UI
          }
        }),
      );

      sessionStorage.setItem(SYNC_THROTTLE_KEY, String(Date.now()));
      await reload();
      await reloadAssets();
      window.dispatchEvent(new Event('notifications-updated'));
    } finally {
      syncRunningRef.current = false;
      setSyncing(false);
    }
  }, [customers, profile, reload, reloadAssets]);

  // Sync on page load (once customers are loaded)
  useEffect(() => {
    if (!profile) return;
    if (customers.length > 0) void syncUniFiAlerts();
  }, [customers.length, profile, syncUniFiAlerts]);
  // ── End UniFi offline alert sync ─────────────────────────────────────────

  const customerName = (id: string) => customers.find(c => c.id === id)?.name ?? '—';
  const warrantyAlerts = assets.flatMap(a => {
    if (!a.warrantyEnd) return [];
    const days = Math.floor((new Date(a.warrantyEnd).getTime() - Date.now()) / 86_400_000);
    if (days >= 90) return [];
    return [{
      id: `warranty-${a.id}`,
      customerId: a.customerId,
      title: days < 0 ? `Warranty expired: ${a.name}` : `Warranty expiring soon: ${a.name}`,
      warrantyEnd: a.warrantyEnd,
      severity: days < 0 ? 'high' as const : 'medium' as const,
      source: 'warranty',
      timestamp: a.createdAt,
      unread: !readWarranty.has(`warranty-${a.id}`),
    }];
  });
  const isLoading = loading || assetsLoading;
  const totalUnread = alerts.filter(a => !a.resolved).length + warrantyAlerts.filter(a => a.unread).length;

  const items = [
    ...alerts.map(alert => ({
      kind: 'db' as const,
      id: alert.id,
      customerId: alert.customerId,
      title: alert.title,
      source: alert.source,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp,
      unread: !alert.resolved,
    })),
    ...warrantyAlerts.map(alert => ({
      kind: 'warranty' as const,
      id: alert.id,
      customerId: alert.customerId,
      title: alert.title,
      source: alert.source,
      severity: alert.severity,
      message: `Warranty date: ${alert.warrantyEnd}`,
      timestamp: alert.timestamp,
      unread: alert.unread,
    })),
  ].sort((a, b) => {
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const displayedItems = unreadOnly ? items.filter(i => i.unread) : items;

  function markWarrantyRead(id: string) {
    const next = readWarrantySet();
    next.add(id);
    localStorage.setItem(READ_WARRANTY_KEY, JSON.stringify([...next]));
    // refresh local list
    reloadAssets();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Notifications</h1>
          {!isLoading && <Badge variant="danger">{totalUnread} unread</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={unreadOnly ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setUnreadOnly(v => !v)}
            disabled={isLoading}
          >
            {unreadOnly ? 'Unread only' : 'All'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { void syncUniFiAlerts(true); }}
            aria-label="Refresh"
            disabled={isLoading || syncing}
          >
            <RefreshCw className={`size-4 ${(isLoading || syncing) ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {(error || assetsError) && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error ?? assetsError}
        </div>
      )}

      <div className="space-y-2">
        {isLoading && [1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-card" />)}

        {!isLoading && displayedItems.length === 0 && (
          <Card>
            <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
              <Bell className="size-8 text-text-muted" />
              <p className="text-sm text-text-muted">
                {unreadOnly ? 'No unread notifications.' : 'All caught up — no unresolved alerts.'}
              </p>
            </CardBody>
          </Card>
        )}

        {!isLoading && displayedItems.map(item => (
          <Card key={`${item.kind}-${item.id}`} className="hover:shadow-card-hover">
            <CardBody className="pt-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant={item.severity} dot>{item.severity.toUpperCase()}</Badge>
                  <span className="text-xs text-text-muted">{customerName(item.customerId)}</span>
                  <span className="text-xs text-text-muted">· {item.source}</span>
                  {!item.unread && <Badge variant="default">Read</Badge>}
                </div>
                <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                <p className="text-sm text-text-secondary mt-0.5 whitespace-pre-wrap">
                  {item.kind === 'warranty' && <ShieldAlert className="size-3.5 inline mr-1" />}
                  {item.message}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {item.kind === 'db' && item.source.startsWith('unifi-offline-') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/customers/${item.customerId}?tab=network&unifiAlert=${encodeURIComponent(item.source)}`)}
                    rightIcon={<ExternalLink className="size-3" />}
                  >
                    Open
                  </Button>
                )}
                {item.kind === 'warranty' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/customers/${item.customerId}?tab=assets`)}
                    rightIcon={<ExternalLink className="size-3" />}
                  >
                    Open
                  </Button>
                )}
                {item.unread && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (item.kind === 'db') await markResolved(item.id);
                      else markWarrantyRead(item.id);
                      window.dispatchEvent(new Event('notifications-updated'));
                    }}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
