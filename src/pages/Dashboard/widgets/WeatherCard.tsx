import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Wind, Droplets, Pencil, X, RefreshCw,
  Thermometer, AlertCircle, MapPin, Loader2,
} from 'lucide-react';
import { Card, CardBody } from '../../../components/ui/Card';
import { cn } from '../../../components/ui/cn';
import { useApp } from '../../../context/AppContext';
import { useWeather, searchCities, type GeoSuggestion } from '../../../hooks/useWeather';

export function WeatherCard({ className }: { className?: string }) {
  const { weatherLocation, setWeatherLocation } = useApp();
  const { data, loading, error, refresh } = useWeather(weatherLocation.lat, weatherLocation.lon);

  /* ── Search state ── */
  const [editing,     setEditing]     = useState(false);
  const [query,       setQuery]       = useState('');
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [activeIdx,   setActiveIdx]   = useState(-1);
  const [searchErr,   setSearchErr]   = useState('');

  const inputRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  /* ── Open search ── */
  function openSearch() {
    setQuery('');
    setSuggestions([]);
    setActiveIdx(-1);
    setSearchErr('');
    setEditing(true);
  }

  /* ── Close / cancel ── */
  function closeSearch() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setEditing(false);
    setSuggestions([]);
    setQuery('');
  }

  /* ── Debounced geocode search ── */
  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setSuggestions([]); setSearchErr(''); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchErr('');
      try {
        const results = await searchCities(q);
        setSuggestions(results);
        setActiveIdx(-1);
        if (results.length === 0) setSearchErr('No locations found');
      } catch {
        setSearchErr('Search failed');
      } finally {
        setSearching(false);
      }
    }, 350);
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    doSearch(e.target.value);
  }

  /* ── Select a suggestion ── */
  function selectSuggestion(s: GeoSuggestion) {
    setWeatherLocation(s);
    closeSearch();
  }

  /* ── Keyboard navigation ── */
  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { closeSearch(); return; }
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    }
    if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIdx]);
    }
  }

  /* ── Close dropdown when clicking outside ── */
  useEffect(() => {
    if (!editing) return;
    function onOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current    && !inputRef.current.contains(e.target as Node)
      ) closeSearch();
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [editing]);

  /* ── Focus input on open ── */
  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 10);
  }, [editing]);

  /* ── Cleanup on unmount ── */
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  return (
    <Card className={cn(className)}>
      <CardBody className="pt-5 flex flex-col gap-1">

        {/* ── Header row ── */}
        <div className="flex items-center gap-1.5 min-h-[20px]">
          <MapPin className="size-3 text-text-muted shrink-0" />
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted truncate flex-1">
            {weatherLocation.label}
          </p>
          {!editing && (
            <>
              <button
                onClick={refresh}
                disabled={loading}
                aria-label="Refresh weather"
                className="shrink-0 text-text-muted hover:text-accent transition-colors disabled:opacity-40"
              >
                <RefreshCw className={cn('size-3', loading && 'animate-spin')} />
              </button>
              <button
                onClick={openSearch}
                aria-label="Change location"
                className="shrink-0 text-text-muted hover:text-accent transition-colors"
              >
                <Pencil className="size-3" />
              </button>
            </>
          )}
        </div>

        {/* ── Search box + dropdown ── */}
        {editing && (
          <div className="relative mt-1">
            <div className="flex items-center gap-1">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  value={query}
                  onChange={handleInput}
                  onKeyDown={handleKey}
                  placeholder="Search for a city…"
                  className={cn(
                    'h-8 w-full rounded-lg border border-accent bg-surface pl-2.5 pr-8 text-xs text-text-primary',
                    'placeholder:text-text-muted outline-none focus:ring-2 focus:ring-accent/40',
                  )}
                  aria-label="Search city"
                  aria-autocomplete="list"
                  aria-expanded={suggestions.length > 0}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
                  {searching
                    ? <Loader2 className="size-3.5 animate-spin" />
                    : null
                  }
                </span>
              </div>
              <button
                onClick={closeSearch}
                aria-label="Cancel"
                className="shrink-0 text-text-muted hover:text-text-primary transition-colors p-1"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {/* Suggestions dropdown */}
            {(suggestions.length > 0 || searchErr) && (
              <div
                ref={dropdownRef}
                className={cn(
                  'absolute left-0 right-0 top-full mt-1 z-50',
                  'rounded-lg border border-border bg-surface shadow-lg overflow-hidden',
                )}
                role="listbox"
              >
                {searchErr && (
                  <p className="px-3 py-2 text-xs text-text-muted">{searchErr}</p>
                )}
                {suggestions.map((s, i) => (
                  <button
                    key={`${s.lat}-${s.lon}`}
                    role="option"
                    aria-selected={i === activeIdx}
                    onMouseDown={e => { e.preventDefault(); selectSuggestion(s); }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs transition-colors',
                      'flex items-center gap-2',
                      i === activeIdx
                        ? 'bg-accent/10 text-text-primary'
                        : 'text-text-secondary hover:bg-surface-raised',
                      i > 0 && 'border-t border-border/50',
                    )}
                  >
                    <MapPin className="size-3 text-text-muted shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading && !data && (
          <div className="mt-3 space-y-2 animate-pulse">
            <div className="h-8 w-32 rounded bg-surface-raised" />
            <div className="h-4 w-24 rounded bg-surface-raised" />
            <div className="h-3 w-40 rounded bg-surface-raised" />
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-red-500">
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Live weather ── */}
        {data && !error && (
          <>
            <div className="flex items-end gap-3 mt-1">
              <span style={{ fontSize: '2.5rem' }} aria-hidden="true">{data.icon}</span>
              <span className="font-bold text-3xl text-text-primary tabular-nums">{data.tempC}°C</span>
            </div>
            <p className="text-sm text-text-secondary">{data.condition}</p>
            <div className="flex items-center gap-4 mt-1 text-xs text-text-muted flex-wrap">
              <span className="flex items-center gap-1">
                <Droplets className="size-3" />{data.humidity}%
              </span>
              <span className="flex items-center gap-1">
                <Wind className="size-3" />{data.windKph} km/h
              </span>
              <span className="flex items-center gap-1">
                <Thermometer className="size-3" />Feels {data.feelsLike}°C
              </span>
            </div>
          </>
        )}

        {/* ── Change location trigger ── */}
        {!editing && (
          <button
            onClick={openSearch}
            className="mt-2 self-start flex items-center gap-1 text-[11px] text-text-muted hover:text-accent transition-colors focus-ring rounded"
          >
            <Pencil className="size-3" />
            Change location
          </button>
        )}
      </CardBody>
    </Card>
  );
}
