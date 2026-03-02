import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wifi, RefreshCw, Copy, Check, AlertCircle, ExternalLink, Users, Server, ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useUnifiSites } from '../../hooks/useUnifiStatus';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import type { UnifiSiteListItem } from '../../hooks/useUnifiStatus';

// ── Copyable ID chip ──────────────────────────────────────────────────────────

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      title="Copy Site ID"
      className="group flex items-center gap-1.5 max-w-full px-2 py-1 rounded-md
        bg-surface border border-border hover:border-accent/50 hover:bg-accent/5
        transition-colors text-left focus-ring"
    >
      <code className="text-xs font-mono text-text-secondary truncate">{value}</code>
      {copied
        ? <Check className="size-3 text-emerald-500 shrink-0" />
        : <Copy className="size-3 text-text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      }
    </button>
  );
}

// ── Single site card ──────────────────────────────────────────────────────────

function SiteCard({ site }: { site: UnifiSiteListItem }) {
  const siteId    = site.siteId ?? site.id ?? '';
  // deviceName comes from the host's reportedState.hostname — this is the
  // meaningful name ("Momentia Lab", "H203_FW01"). Fall back through desc → name.
  const siteName  = site.deviceName ?? site.meta?.desc ?? site.meta?.name ?? 'Unnamed Site';
  const deviceType = site.deviceType ?? null;
  const stats    = (site as { statistics?: {
    online_clients_count?: number;
    devices?: { total?: number; online?: number };
  } }).statistics;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl
      border border-border bg-surface hover:border-accent/30 transition-colors">

      {/* Icon */}
      <div className="size-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
        <Wifi className="size-5 text-accent" />
      </div>

      {/* Name + ID */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-text-primary">{siteName}</p>
          {deviceType && (
            <span className="text-xs text-text-muted capitalize">{deviceType.replace('udm', 'UDM')}</span>
          )}
        </div>
        {siteId ? (
          <CopyChip value={siteId} />
        ) : (
          <span className="text-xs text-text-muted italic">No ID available</span>
        )}
      </div>

      {/* Stats (if available) */}
      {stats && (
        <div className="flex items-center gap-3 shrink-0">
          {stats.devices && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Server className="size-3.5" />
              <span>
                {stats.devices.online ?? '—'} / {stats.devices.total ?? '—'} devices
              </span>
            </div>
          )}
          {stats.online_clients_count != null && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Users className="size-3.5" />
              <span>{stats.online_clients_count} clients</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function UnifiSitesPage() {
  const { profile } = useAuth();
  const navigate    = useNavigate();

  // Only admins and superadmins may access this page
  if (profile && profile.role !== 'superadmin' && profile.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const { sites, loading, error, reload } = useUnifiSites();

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Header */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary mb-2 transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">UniFi Sites</h1>
            <p className="text-sm text-text-muted mt-0.5">
              All sites registered to your UniFi account. Copy a Site ID and paste it into a customer's
              integration settings.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* How-to card */}
      <Card>
        <CardHeader title="How to link a site to a customer" />
        <CardBody>
          <ol className="space-y-2 text-sm text-text-secondary list-decimal list-inside">
            <li>Find the site that belongs to the customer below.</li>
            <li>Click the Site ID chip to copy it to your clipboard.</li>
            <li>Open the customer, click <strong>Edit</strong>, enable the <strong>UniFi Network</strong> integration.</li>
            <li>Paste the Site ID into the <strong>UniFi Site ID</strong> field and save.</li>
            <li>The customer's detail page will now show a live <strong>Network</strong> tab.</li>
          </ol>
        </CardBody>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader
          title={`Sites${!loading && sites.length > 0 ? ` (${sites.length})` : ''}`}
          action={
            <a
              href="https://unifi.ui.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors"
            >
              Open UniFi <ExternalLink className="size-3" />
            </a>
          }
        />
        <CardBody className="space-y-2">

          {loading && (
            [...Array(3)].map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertCircle className="size-7 text-red-500" />
              <p className="text-sm font-medium text-text-primary">Could not load sites</p>
              <p className="text-xs text-text-muted max-w-sm">{error}</p>
              <Button variant="outline" size="sm" onClick={reload}>Try again</Button>
            </div>
          )}

          {!loading && !error && sites.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Wifi className="size-7 text-text-muted" />
              <p className="text-sm font-medium text-text-primary">No sites found</p>
              <p className="text-xs text-text-muted max-w-sm">
                Make sure the API key has access to at least one site and that the
                <code className="mx-1 text-xs font-mono">UNIFI_API_KEY</code>
                secret is set correctly.
              </p>
            </div>
          )}

          {!loading && !error && sites.map((site, idx) => (
            <SiteCard key={site.siteId ?? site.id ?? idx} site={site} />
          ))}

        </CardBody>
      </Card>

      {/* Legend */}
      {!loading && !error && sites.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Badge variant="default">Tip</Badge>
          Click the grey monospace chip under a site name to copy its Site ID to the clipboard.
        </div>
      )}
    </div>
  );
}
