import { cn } from './cn';

interface AvatarProps {
  name:       string;
  src?:       string | null;
  size?:      'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { sm: 'size-7 text-xs', md: 'size-9 text-sm', lg: 'size-11 text-base' };

function initials(name: string) {
  return name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  return (
    <span
      aria-label={name}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold select-none shrink-0',
        'bg-accent text-white',
        sizeMap[size],
        className,
      )}
    >
      {src ? (
        <img src={src} alt={name} className="size-full rounded-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
