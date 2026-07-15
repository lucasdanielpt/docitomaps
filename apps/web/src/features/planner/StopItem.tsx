import type { Waypoint } from '@docitomapas/shared';
import { Trash2 } from 'lucide-react';
import { AddressInput } from './AddressInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouteStore } from '@/stores/routeStore';

interface StopItemProps {
  stop: Waypoint;
  /** Número na ordem otimizada (1-based), se rota já calculada. */
  routeOrder?: number;
}

export function StopItem({ stop, routeOrder }: StopItemProps) {
  const updateStop = useRouteStore((s) => s.updateStop);
  const removeStop = useRouteStore((s) => s.removeStop);

  const stopPlaceholders = [
    'Uma docinho no caminho…',
    'Outra paradinha? Ex: Padaria da esquina',
    'Que tal um café? Ex: Cafeteria Doce',
    'Uma parada extra? Ex: Sorveteria',
  ];
  const displayIndex = routeOrder ?? 0;
  const placeholder =
    stopPlaceholders[(displayIndex - 1) % stopPlaceholders.length] ?? 'Mais uma parada…';

  return (
    <div
      className="rounded-2xl border border-border bg-card p-2 shadow-soft"
      aria-label={routeOrder ? `Parada ${routeOrder} na rota` : 'Parada'}
    >
      <div className="flex items-center gap-1">
        <div className="flex h-9 w-8 shrink-0 items-center justify-center">
          <span
            className={
              'text-xs font-bold ' + (routeOrder ? 'text-primary' : 'text-muted-foreground')
            }
            title={routeOrder ? `Ordem ${routeOrder} na rota otimizada` : undefined}
          >
            {routeOrder ?? '·'}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <AddressInput
            value={stop}
            onSelect={(wp) => updateStop(stop.id, { address: wp.address, location: wp.location })}
            placeholder={placeholder}
            icon={
              <span className="text-xs font-semibold text-primary">{routeOrder ?? '?'}</span>
            }
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => removeStop(stop.id)}
          title="Remover parada"
          aria-label="Remover parada"
          className="h-9 w-9"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <div className="mt-2 flex items-center gap-2 pl-9">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tempo parado
        </label>
        <Input
          type="number"
          min={0}
          max={480}
          value={stop.stopDurationMin ?? 0}
          onChange={(e) =>
            updateStop(stop.id, { stopDurationMin: Math.max(0, Number(e.target.value) || 0) })
          }
          className="h-8 w-20 rounded-full text-center text-xs"
          aria-label="Minutos parado nesta parada"
        />
        <span className="text-[10px] text-muted-foreground">min</span>
      </div>
    </div>
  );
}
