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
        <span className="text-sm font-medium text-muted-foreground">
          Paradas intermediárias ({stops.length}/25)
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addStop()}
          disabled={stops.length >= 25}
        >
          <Plus className="h-4 w-4" />
          Adicionar parada
        </Button>
      </div>

      {stops.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Nenhuma parada. Clique em <span className="font-medium">Adicionar parada</span>.
        </div>
      ) : (
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
    </div>
  );
}
