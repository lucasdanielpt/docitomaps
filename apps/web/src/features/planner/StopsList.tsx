import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pin, PinOff } from 'lucide-react';
import type { Waypoint } from '@docitomapas/shared';
import { StopItem } from './StopItem';
import { useRouteStore } from '@/stores/routeStore';

interface SortableStopProps {
  stop: Waypoint;
  routeOrder?: number;
}

function SortableStop({ stop, routeOrder }: SortableStopProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id,
  });
  const toggleFixed = useRouteStore((s) => s.toggleFixed);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch gap-1">
      <button
        type="button"
        className="mt-3 flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary active:cursor-grabbing"
        aria-label="Arrastar parada"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <StopItem stop={stop} routeOrder={routeOrder} />
      </div>
      <button
        type="button"
        onClick={() => toggleFixed(stop.id)}
        className={
          'mt-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ' +
          (stop.fixedOrder
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:bg-secondary')
        }
        title={stop.fixedOrder ? 'Parada fixa na ordem' : 'Fixar ordem desta parada'}
        aria-label={stop.fixedOrder ? 'Desafixar parada' : 'Fixar parada'}
      >
        {stop.fixedOrder ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function StopsList() {
  const stops = useRouteStore((s) => s.stops);
  const optimizedOrder = useRouteStore((s) => s.optimizedOrder);
  const optimize = useRouteStore((s) => s.optimize);
  const reorderStops = useRouteStore((s) => s.reorderStops);
  const addStop = useRouteStore((s) => s.addStop);

  const orderMap = new Map(optimizedOrder?.map((id, i) => [id, i + 1]) ?? []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = stops.findIndex((s) => s.id === active.id);
    const to = stops.findIndex((s) => s.id === over.id);
    if (from >= 0 && to >= 0) reorderStops(from, to);
  }

  const displayStops = stops;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Paradas · {stops.length}/25
        </span>
        <span className="text-[10px] text-muted-foreground">
          {optimize ? 'Ordem otimizada ao calcular' : 'Ordem manual — arraste'}
        </span>
      </div>

      {stops.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {displayStops.map((s) => (
                <SortableStop
                  key={s.id}
                  stop={s}
                  routeOrder={optimize ? orderMap.get(s.id) : undefined}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        type="button"
        onClick={() => addStop()}
        disabled={stops.length >= 25}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-dashed border-primary/40 bg-transparent text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Adicionar parada
      </button>
    </div>
  );
}
