import type { Waypoint } from '@docitomapas/shared';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Lock, LockOpen, Trash2 } from 'lucide-react';
import { AddressInput } from './AddressInput';
import { Button } from '@/components/ui/button';
import { useRouteStore } from '@/stores/routeStore';

interface StopItemProps {
  stop: Waypoint;
  index: number;
}

export function StopItem({ stop, index }: StopItemProps) {
  const updateStop = useRouteStore((s) => s.updateStop);
  const removeStop = useRouteStore((s) => s.removeStop);
  const toggleFixed = useRouteStore((s) => s.toggleFixed);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-md border bg-card p-2 shadow-sm"
      aria-label={`Parada ${index + 1}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent active:cursor-grabbing"
          aria-label="Reordenar"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <AddressInput
            value={stop}
            onSelect={(wp) => updateStop(stop.id, { address: wp.address, location: wp.location })}
            placeholder={`Parada ${index + 1}...`}
            iconColor="text-orange-500"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => toggleFixed(stop.id)}
          title={stop.fixedOrder ? 'Ordem fixa (clique para liberar)' : 'Ordem livre (clique para fixar)'}
          aria-label="Alternar ordem fixa"
        >
          {stop.fixedOrder ? (
            <Lock className="h-4 w-4 text-primary" />
          ) : (
            <LockOpen className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => removeStop(stop.id)}
          title="Remover parada"
          aria-label="Remover parada"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
