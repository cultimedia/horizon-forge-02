import { cn } from '@/lib/utils';

interface StarIconProps {
  className?: string;
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StarIcon({ className, active = false, size = 'md' }: StarIconProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn(
        sizeClasses[size],
        'transition-all duration-300',
        active ? 'text-star animate-star-pulse' : 'text-muted-foreground',
        className
      )}
    >
      <circle
        cx="12"
        cy="12"
        r={active ? 4 : 3}
        fill="currentColor"
        className={cn(
          'transition-all duration-300',
          active && 'drop-shadow-[0_0_8px_hsl(175,70%,52%)]'
        )}
      />
      {active && (
        <>
          <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="0.3" opacity="0.15" />
        </>
      )}
    </svg>
  );
}
