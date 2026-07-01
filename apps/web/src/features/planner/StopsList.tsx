import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouteStore } from '@/stores/routeStore';
import { StopItem } from './StopItem';

export function StopsList() {
  const stops = useRouteStore((s) => s.stops);
  const addStop = useRouteStore((s) => s.addStop);
  const reorder = useRouteStore((s) => s.reorderStops);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = stops.findIndex((s) => s.id === active.id);
    const to = stops.findIndex((s) => s.id === over.id);
    if (from === -1 || to === -1) return;
    reorder(from, to);
    // arrayMove disponível caso queiramos calcular localmente sem passar por store.
    void arrayMove;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Paradas · {stops.length}/25
        </span>
      </div>

      {stops.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {stops.map((s, i) => (
                <StopItem key={s.id} stop={s} index={i} />
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
        <Plus className="h-4 w-4" /> Adicionar parada
      </button>
    </div>
  );
}
