import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MAP_BASE_STYLE_OPTIONS } from '@/features/map/mapStyle';
import { useMapStore } from '@/stores/mapStore';

/** Seletor de estilo do mapa base (planner). */
export function MapStylePicker() {
  const mapBaseStyle = useMapStore((s) => s.mapBaseStyle);
  const setMapBaseStyle = useMapStore((s) => s.setMapBaseStyle);

  return (
    <div className="pointer-events-auto rounded-full border border-border/60 bg-card/90 px-2 py-1 shadow-soft backdrop-blur">
      <Select value={mapBaseStyle} onValueChange={(v) => setMapBaseStyle(v as typeof mapBaseStyle)}>
        <SelectTrigger className="h-8 w-[148px] border-0 bg-transparent text-xs shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MAP_BASE_STYLE_OPTIONS.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
