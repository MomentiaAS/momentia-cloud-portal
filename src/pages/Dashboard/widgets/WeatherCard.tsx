import { useRef, useState, useEffect } from 'react';
import { Wind, Droplets, Pencil, Check, X } from 'lucide-react';
import { Card, CardBody } from '../../../components/ui/Card';
import { demoWeather } from '../../../data/demo';
import { cn } from '../../../components/ui/cn';
import { useApp } from '../../../context/AppContext';

export function WeatherCard({ className }: { className?: string }) {
  const { weatherCity, setWeatherCity } = useApp();
  const w = demoWeather;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(weatherCity);
    setEditing(true);
  }

  function confirm() {
    if (draft.trim()) setWeatherCity(draft.trim());
    setEditing(false);
  }

  function cancel() {
    setEditing(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter')  confirm();
    if (e.key === 'Escape') cancel();
  }

  // Focus input when edit mode opens
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <Card className={cn(className)}>
      <CardBody className="pt-5 flex flex-col gap-1">
        {/* City row */}
        <div className="flex items-center gap-1.5 min-h-[20px]">
          {editing ? (
            <>
              <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={handleKey}
                maxLength={48}
                placeholder="Enter city name…"
                className={cn(
                  'flex-1 min-w-0 text-xs font-medium uppercase tracking-wider',
                  'bg-transparent border-b border-accent outline-none text-text-primary',
                  'placeholder:text-text-muted',
                )}
                aria-label="Weather city"
              />
              <button
                onClick={confirm}
                aria-label="Confirm city"
                className="text-emerald-500 hover:text-emerald-600 transition-colors shrink-0"
              >
                <Check className="size-3.5" />
              </button>
              <button
                onClick={cancel}
                aria-label="Cancel"
                className="text-text-muted hover:text-text-primary transition-colors shrink-0"
              >
                <X className="size-3.5" />
              </button>
            </>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-wider text-text-muted truncate">
                {weatherCity} — Weather
              </p>
              <button
                onClick={startEdit}
                aria-label="Change city"
                className="shrink-0 text-text-muted hover:text-accent transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Pencil className="size-3" />
              </button>
            </>
          )}
        </div>

        <div className="flex items-end gap-3 mt-1">
          <span style={{ fontSize: '2.5rem' }} aria-hidden="true">{w.icon}</span>
          <span className="font-bold text-3xl text-text-primary tabular-nums">{w.tempC}°C</span>
        </div>
        <p className="text-sm text-text-secondary">{w.condition}</p>
        <div className="flex items-center gap-4 mt-1 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <Droplets className="size-3" />{w.humidity}%
          </span>
          <span className="flex items-center gap-1">
            <Wind className="size-3" />{w.windKph} km/h
          </span>
        </div>

        {/* Persistent edit trigger shown below content */}
        {!editing && (
          <button
            onClick={startEdit}
            aria-label="Change city"
            className={cn(
              'mt-2 self-start flex items-center gap-1 text-[11px] text-text-muted',
              'hover:text-accent transition-colors focus-ring rounded',
            )}
          >
            <Pencil className="size-3" />
            Change location
          </button>
        )}
      </CardBody>
    </Card>
  );
}
