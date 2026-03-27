import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, Building2, AlertCircle, ChevronRight,
  Laptop, Server, Network, Smartphone, Printer, Package, Shield, Wifi, HardDrive, Monitor, Home, Wrench,
} from 'lucide-react';
import { cn } from '../ui/cn';
import { useCustomers } from '../../hooks/useCustomers';
import { useAllAssets } from '../../hooks/useAssets';
import { useAlerts } from '../../hooks/useAlerts';
import type { AssetType } from '../../types';

// ── Constants ────────────────────────────────────────────────────────────────

const MIN_QUERY = 2;
const MAX_PER_GROUP = 6;

const ASSET_ICON: Record<AssetType, React.ElementType> = {
  computer: Laptop,
  server: Server,
  router_firewall: Shield,
  access_point: Wifi,
  switch: HardDrive,
  network_equipment: Network,
  mobile_device: Smartphone,
  printer: Printer,
  license_subscription: Package,
  audio_video: Monitor,
  home_appliances: Home,
  tools: Wrench,
  other: Package,
};

// ── Types ─────────────────────────────────────────────────────────────────────

type ResultKind = 'customer' | 'asset' | 'alert';

interface SearchResult {
  id:          string;
  kind:        ResultKind;
  primary:     string;
  secondary:   string;
  href:        string;
  icon:        React.ElementType;
  iconClass:   string;
}

// ── Highlight helper ──────────────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent/20 text-accent rounded-[2px] not-italic font-medium">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GlobalSearchBar() {
  const navigate = useNavigate();
  const { customers } = useCustomers();
  const { assets }    = useAllAssets();
  const { alerts }    = useAlerts(false); // unresolved only

  const [query,     setQuery]     = useState('');
  const [open,      setOpen]      = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const inputRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // customer name lookup for asset/alert subtitles
  const customerMap = useMemo(
    () => Object.fromEntries(customers.map(c => [c.id, c.name])),
    [customers],
  );

  // ── Search logic ────────────────────────────────────────────────────────────

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < MIN_QUERY) return [];

    const customerResults: SearchResult[] = customers
      .filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.orgNumber?.toLowerCase().includes(q)) ||
        (c.domain?.toLowerCase().includes(q)) ||
        c.primaryContact.name.toLowerCase().includes(q) ||
        c.assignedTech.toLowerCase().includes(q) ||
        (c.address?.toLowerCase().includes(q)) ||
        (c.postcode?.toLowerCase().includes(q)) ||
        (c.state?.toLowerCase().includes(q)),
      )
      .slice(0, MAX_PER_GROUP)
      .map(c => ({
        id:        c.id,
        kind:      'customer' as const,
        primary:   c.name,
        secondary: [c.status, c.health !== 'unknown' ? c.health : null, c.assignedTech || null].filter(Boolean).join(' · '),
        href:      `/customers/${c.id}`,
        icon:      Building2,
        iconClass: 'text-blue-500',
      }));

    const assetResults: SearchResult[] = assets
      .filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.make?.toLowerCase().includes(q)) ||
        (a.model?.toLowerCase().includes(q)) ||
        (a.serial?.toLowerCase().includes(q)) ||
        (a.ipAddress?.toLowerCase().includes(q)) ||
        (a.macAddress?.toLowerCase().includes(q)) ||
        (a.notes?.toLowerCase().includes(q)),
      )
      .slice(0, MAX_PER_GROUP)
      .map(a => ({
        id:        a.id,
        kind:      'asset' as const,
        primary:   a.name,
        secondary: [
          customerMap[a.customerId],
          a.serial ? `S/N ${a.serial}` : null,
          a.ipAddress ?? null,
        ].filter(Boolean).join(' · '),
        href:      `/customers/${a.customerId}?tab=assets`,
        icon:      ASSET_ICON[a.type] ?? Package,
        iconClass: 'text-text-muted',
      }));

    const alertResults: SearchResult[] = alerts
      .filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.message.toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q),
      )
      .slice(0, MAX_PER_GROUP)
      .map(a => ({
        id:        a.id,
        kind:      'alert' as const,
        primary:   a.title,
        secondary: [customerMap[a.customerId], a.severity].filter(Boolean).join(' · '),
        href:      `/customers/${a.customerId}?tab=alerts&highlight=${a.id}`,
        icon:      AlertCircle,
        iconClass: (a.severity === 'critical' || a.severity === 'high')
          ? 'text-red-500'
          : 'text-amber-500',
      }));

    return [...customerResults, ...assetResults, ...alertResults];
  }, [query, customers, assets, alerts, customerMap]);

  const groups = useMemo(() => [
    { label: 'Customers', items: results.filter(r => r.kind === 'customer') },
    { label: 'Assets',    items: results.filter(r => r.kind === 'asset') },
    { label: 'Alerts',    items: results.filter(r => r.kind === 'alert') },
  ].filter(g => g.items.length > 0), [results]);

  // Map result id → flat index for keyboard nav
  const idToFlatIdx = useMemo(() => {
    const map: Record<string, number> = {};
    results.forEach((r, i) => { map[r.id] = i; });
    return map;
  }, [results]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function selectResult(r: SearchResult) {
    navigate(r.href);
    setQuery('');
    setOpen(false);
    setActiveIdx(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); setActiveIdx(-1); return; }
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    }
    if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      selectResult(results[activeIdx]);
    }
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        inputRef.current && !inputRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
        setActiveIdx(-1);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  // Reset keyboard selection whenever results change
  useEffect(() => { setActiveIdx(-1); }, [results]);

  const showDropdown = open && query.trim().length >= MIN_QUERY;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex-1 max-w-sm">
      {/* Input */}
      <div className="relative flex items-center">
        <span className="absolute left-3 text-text-muted pointer-events-none">
          <Search className="size-3.5" />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search customers, assets, alerts…"
          aria-label="Global search"
          aria-haspopup="listbox"
          aria-expanded={showDropdown}
          className={cn(
            'w-full rounded-lg border border-border bg-surface-raised text-text-primary text-sm',
            'placeholder:text-text-muted transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent',
            'h-9 pl-9',
            query ? 'pr-9' : 'pr-3',
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setOpen(false);
              setActiveIdx(-1);
              inputRef.current?.focus();
            }}
            className="absolute right-3 text-text-muted hover:text-text-primary"
            aria-label="Clear search"
            tabIndex={-1}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          role="listbox"
          className={cn(
            'absolute left-0 right-0 top-full mt-1 z-50',
            'bg-surface-raised border border-border rounded-xl shadow-modal',
            'overflow-hidden max-h-[70vh] overflow-y-auto',
          )}
        >
          {results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center text-text-muted">
              No results for &ldquo;{query.trim()}&rdquo;
            </p>
          ) : (
            groups.map((group, gi) => (
              <div key={group.label}>
                {/* Group header */}
                <p className={cn(
                  'px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted bg-surface/60',
                  gi > 0 && 'border-t border-border',
                )}>
                  {group.label} ({group.items.length})
                </p>

                {/* Group items */}
                {group.items.map(item => {
                  const flatIdx = idToFlatIdx[item.id];
                  const isActive = flatIdx === activeIdx;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      role="option"
                      aria-selected={isActive}
                      onMouseDown={e => { e.preventDefault(); selectResult(item); }}
                      onMouseEnter={() => setActiveIdx(flatIdx)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        'border-b border-border/40 last:border-0',
                        isActive ? 'bg-accent/10' : 'hover:bg-surface',
                      )}
                    >
                      <span className={cn('shrink-0', item.iconClass)}>
                        <Icon className="size-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          <Highlight text={item.primary} query={query.trim()} />
                        </p>
                        {item.secondary && (
                          <p className="text-xs text-text-muted truncate capitalize">
                            {item.secondary}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="size-3.5 text-text-muted shrink-0" />
                    </button>
                  );
                })}
              </div>
            ))
          )}

          {/* Footer hint */}
          <p className="px-4 py-1.5 text-[10px] text-text-muted bg-surface/60 border-t border-border flex items-center gap-3">
            <span><kbd className="font-sans bg-border px-1 rounded text-[10px]">↑↓</kbd> navigate</span>
            <span><kbd className="font-sans bg-border px-1 rounded text-[10px]">↵</kbd> open</span>
            <span><kbd className="font-sans bg-border px-1 rounded text-[10px]">esc</kbd> close</span>
          </p>
        </div>
      )}
    </div>
  );
}
