import { cn } from '@/lib/utils';

interface LogoProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 48, className }: LogoProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-gradient-candy shadow-candy',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 40 40" width={size * 0.6} height={size * 0.6}>
        <path
          d="M8 20c2-3 5-3 6 0s4 3 6 0 5-3 6 0 4 3 6 0"
          fill="none"
          stroke="#fff"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle cx="20" cy="20" r="3.6" fill="#fff" />
      </svg>
    </span>
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <LogoMark size={44} />
      <div className="flex flex-col leading-tight">
        <span className="font-display text-xl font-semibold text-foreground">
          Docito<span className="text-primary">Mapas</span>
        </span>
        <span className="text-xs text-muted-foreground">Roteiros com sabor de caramelo</span>
      </div>
    </div>
  );
}
