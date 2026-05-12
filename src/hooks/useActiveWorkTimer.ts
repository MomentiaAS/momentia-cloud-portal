import { useCallback, useEffect, useMemo, useState } from 'react';

export const ACTIVE_WORK_TIMERS_STORAGE_KEY = 'momentia-active-timers';
/** Legacy single-timer key — migrated once into slot 0. */
const LEGACY_ACTIVE_WORK_TIMER_KEY = 'momentia-active-timer';

export type TimerSlotIndex = 0 | 1;

export interface ActiveWorkTimerPersisted {
  customerId: string | null;
  startedAtIso: string;
  notes: string;
}

type SlotsTuple = [ActiveWorkTimerPersisted | null, ActiveWorkTimerPersisted | null];

function parseSlot(raw: unknown): ActiveWorkTimerPersisted | null {
  if (raw == null || typeof raw !== 'object') return null;
  const p = raw as Partial<ActiveWorkTimerPersisted>;
  if (typeof p.startedAtIso !== 'string' || Number.isNaN(new Date(p.startedAtIso).getTime())) return null;
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
}

function readSlotsFromStorage(): SlotsTuple {
  try {
    const rawV2 = localStorage.getItem(ACTIVE_WORK_TIMERS_STORAGE_KEY);
    if (rawV2) {
      const j = JSON.parse(rawV2) as { slots?: unknown };
      const s = j?.slots;
      if (Array.isArray(s) && s.length >= 2) {
        return [parseSlot(s[0]), parseSlot(s[1])];
      }
    }
    const rawLegacy = localStorage.getItem(LEGACY_ACTIVE_WORK_TIMER_KEY);
    if (rawLegacy) {
      const single = parseSlot(JSON.parse(rawLegacy) as unknown);
      localStorage.removeItem(LEGACY_ACTIVE_WORK_TIMER_KEY);
      const next: SlotsTuple = [single, null];
      if (single) {
        localStorage.setItem(
          ACTIVE_WORK_TIMERS_STORAGE_KEY,
          JSON.stringify({ slots: next }),
        );
      }
      return next;
    }
  } catch {
    /* ignore */
  }
  return [null, null];
}

function writeSlots(slots: SlotsTuple) {
  localStorage.setItem(ACTIVE_WORK_TIMERS_STORAGE_KEY, JSON.stringify({ slots }));
}

/** Up to two live timers with localStorage backup (refresh-safe). */
export function useActiveWorkTimer() {
  const [slots, setSlots] = useState<SlotsTuple>([null, null]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setSlots(readSlotsFromStorage());
  }, []);

  const anyRunning = slots[0] != null || slots[1] != null;

  useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => setTick(n => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [anyRunning]);

  const elapsedMsPair = useMemo((): [number, number] => {
    void tick;
    const e0 = slots[0]
      ? Math.max(0, Date.now() - new Date(slots[0].startedAtIso).getTime())
      : 0;
    const e1 = slots[1]
      ? Math.max(0, Date.now() - new Date(slots[1].startedAtIso).getTime())
      : 0;
    return [e0, e1];
  }, [slots, tick]);

  const start = useCallback((slot: TimerSlotIndex, customerId: string | null, notes: string) => {
    let ok = false;
    setSlots(prev => {
      if (prev[slot] != null) return prev;
      ok = true;
      const startedAtIso = new Date().toISOString();
      const next: SlotsTuple = [...prev] as SlotsTuple;
      next[slot] = { customerId, startedAtIso, notes: notes.trim() };
      writeSlots(next);
      return next;
    });
    return ok;
  }, []);

  const discard = useCallback((slot: TimerSlotIndex) => {
    setSlots(prev => {
      const next: SlotsTuple = [...prev] as SlotsTuple;
      next[slot] = null;
      writeSlots(next);
      return next;
    });
  }, []);

  return {
    slots,
    elapsedMsPair,
    start,
    discard,
    runningSlotCount: (slots[0] ? 1 : 0) + (slots[1] ? 1 : 0),
  };
}
