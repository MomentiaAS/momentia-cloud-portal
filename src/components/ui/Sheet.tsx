import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './cn';
import { Button } from './Button';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Full-screen on small viewports (search, filters). */
  fullScreenMobile?: boolean;
}

/**
 * Bottom sheet on mobile, centered panel from `sm` up.
 * Prefer over centered modals for thumb reach and keyboard overlap.
 */
export function Sheet({ open, onClose, title, children, footer, fullScreenMobile }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex justify-center',
        fullScreenMobile ? 'items-stretch sm:items-end md:items-center p-0 sm:p-4' : 'items-end sm:items-center p-0 sm:p-4',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          'relative z-10 w-full bg-surface-raised border border-border shadow-modal flex flex-col',
          'max-h-[min(92dvh,100%)] pb-[env(safe-area-inset-bottom,0px)]',
          fullScreenMobile
            ? 'h-full max-h-full rounded-none sm:h-auto sm:max-h-[92dvh] sm:rounded-t-2xl sm:max-w-lg md:rounded-xl'
            : 'rounded-t-2xl sm:rounded-xl sm:max-w-lg max-h-[92dvh]',
        )}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
          <h2 id="sheet-title" className="text-base font-semibold text-text-primary truncate">
            {title}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="shrink-0">
            <X className="size-5" />
          </Button>
        </div>
        <div className="overflow-y-auto flex-1 overscroll-contain px-4 py-4">{children}</div>
        {footer && (
          <div className="shrink-0 px-4 py-3 border-t border-border flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
