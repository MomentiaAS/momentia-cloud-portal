import { useCallback, useEffect, useState } from 'react';

export const ACTIVE_WORK_TIMER_STORAGE_KEY = 'momentia-active-timer';

export interface ActiveWorkTimerPersisted {
  customerId: string | null;
  startedAtIso: string;
  notes: string;
}

function readPersisted(): ActiveWorkTimerPersisted | null {
  try {
    const raw = localStorage.getItem(ACTIVE_WORK_TIMER_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<ActiveWorkTimerPersisted>;
    if (typeof p.startedAtIso !== 'string') return null;
    if (Number.isNaN(new Date(p.startedAtIso).getTime())) return null;
    return {
      customerId:
        p.customerId === null || p.customerId === undefined || p.customerId === ''
          ? null
          : typeof p.customerId === 'string'
            ? p.customerId
            : null,
      startedAtIso: p.startedAtIso,
      notes: typeof p.notes === 'string' ? p.notes : '',
    };
  } catch {
    return null;
  }
}

function writePersisted(p: ActiveWorkTimerPersisted | null) {
  if (p) localStorage.setItem(ACTIVE_WORK_TIMER_STORAGE_KEY, JSON.stringify(p));
  else localStorage.removeItem(ACTIVE_WORK_TIMER_STORAGE_KEY);
}

/** Live timer with localStorage so a refresh does not lose an in-progress run. */
export function useActiveWorkTimer() {
  const [active, setActive] = useState<ActiveWorkTimerPersisted | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    setActive(readPersisted());
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick(n => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  const elapsedMs = active
    ? Math.max(0, Date.now() - new Date(active.startedAtIso).getTime())
    : 0;

  const start = useCallback((customerId: string | null, notes: string) => {
    if (active) return false;
    const startedAtIso = new Date().toISOString();
    const next: ActiveWorkTimerPersisted = {
      customerId,
      startedAtIso,
      notes: notes.trim(),
    };
    setActive(next);
    writePersisted(next);
    return true;
  }, [active]);

  const discard = useCallback(() => {
    setActive(null);
    writePersisted(null);
  }, []);

  return {
    active,
    elapsedMs,
    start,
    discard,
    isRunning: active != null,
  };
}
