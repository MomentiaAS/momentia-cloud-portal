import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize    = 'sm' | 'md' | 'lg' | 'icon';

const variantStyles: Record<ButtonVariant, string> = {
  primary:   'bg-accent text-white hover:bg-accent-600 focus-visible:ring-accent',
  secondary: 'bg-primary-100 text-primary-800 hover:bg-primary-200 dark:bg-primary-700 dark:text-primary-100 dark:hover:bg-primary-600',
  ghost:     'text-text-secondary hover:bg-primary-100 dark:hover:bg-primary-700/50',
  danger:    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  outline:   'border border-border text-text-secondary hover:bg-primary-100 dark:hover:bg-primary-700/50',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm:   'h-7 px-3 text-xs gap-1.5',
  md:   'h-9 px-4 text-sm gap-2',
  lg:   'h-11 px-5 text-base gap-2',
  icon: 'h-9 w-9 p-0',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant;
  size?:     ButtonSize;
  loading?:  boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, leftIcon, rightIcon, children, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised',
        'disabled:opacity-50 disabled:pointer-events-none',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  ),
);
Button.displayName = 'Button';
