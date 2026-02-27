import { type ElementType, type ReactNode } from 'react';
import { cn } from './cn';

interface CardProps {
  children:   ReactNode;
  className?: string;
  as?:        ElementType;
  onClick?:   () => void;
}

export function Card({ children, className, as: Tag = 'div', onClick }: CardProps) {
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'bg-surface-raised border border-border rounded-card shadow-card',
        'transition-shadow duration-150',
        onClick && 'cursor-pointer hover:shadow-card-hover',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  title:     string;
  subtitle?: string;
  action?:   ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between px-5 pt-5 pb-3', className)}>
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-5 pb-5', className)}>{children}</div>;
}
