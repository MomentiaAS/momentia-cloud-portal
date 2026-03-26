import { format, isValid, parseISO } from 'date-fns';

export function formatDateNo(value?: string | null): string {
  if (!value) return '—';
  const dt = parseISO(value);
  if (!isValid(dt)) return value;
  return format(dt, 'dd.MM.yyyy');
}

