import * as React from 'react';
import { cn } from '@/lib/utils';

export const Chip = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-3.5 py-1.5 text-xs font-semibold text-secondary-foreground shadow-soft backdrop-blur',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  ),
);
Chip.displayName = 'Chip';
