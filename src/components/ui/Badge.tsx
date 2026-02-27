import { cn } from './cn';
import type { Severity } from '../../types';

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | Severity;

const variantMap: Record<BadgeVariant, string> = {
  default:  'bg-primary-100 text-primary-700 dark:bg-primary-700 dark:text-primary-200',
  accent:   'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300',
  success:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning:  'bg-amber-100  text-amber-700  dark:bg-amber-900/30  dark:text-amber-400',
  danger:   'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
  info:     'bg-sky-100    text-sky-700    dark:bg-sky-900/30    dark:text-sky-400',
  critical: 'bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400',
  high:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium:   'bg-amber-100  text-amber-700  dark:bg-amber-900/30  dark:text-amber-400',
  low:      'bg-sky-100    text-sky-700    dark:bg-sky-900/30    dark:text-sky-400',
};

interface BadgeProps {
  children:   React.ReactNode;
  variant?:   BadgeVariant;
  dot?:       boolean;
  className?: string;
}

export function Badge({ children, variant = 'default', dot, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        variantMap[variant],
        className,
      )}
    >
      {dot && (
        <span className="size-1.5 rounded-full bg-current opacity-70 shrink-0" />
      )}
      {children}
    </span>
  );
}

interface CountBadgeProps {
  count:     number;
  max?:      number;
  variant?:  BadgeVariant;
}

export function CountBadge({ count, max = 99, variant = 'danger' }: CountBadgeProps) {
  if (count === 0) return null;
  const label = count > max ? `${max}+` : String(count);
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full text-[10px] font-bold leading-none',
        'min-w-[18px] h-[18px] px-1',
        variantMap[variant],
      )}
    >
      {label}
    </span>
  );
}
