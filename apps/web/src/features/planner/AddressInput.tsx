import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { GeocodeResult, LatLng, Waypoint } from '@docitomapas/shared';
import { Input } from '@/components/ui/input';
import { geocode } from '@/services/api';
import { cn, uid } from '@/lib/utils';
import { useMapStore } from '@/stores/mapStore';
import { useRouteStore } from '@/stores/routeStore';
import { MapPin, Loader2 } from 'lucide-react';

export interface AddressInputProps {
  value: Waypoint | null;
  onSelect: (wp: Waypoint) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  autoFocus?: boolean;
  /** Viés geográfico explícito (sobrescreve heurística automática). */
  focus?: LatLng;
}

function resolveGeocodeFocus(
  explicit: LatLng | undefined,
  mapCenter: LatLng | null,
  destination: Waypoint | null,
  origin: Waypoint | null,
): LatLng | undefined {
  if (explicit) return explicit;
  if (destination?.location.lat) return destination.location;
  if (origin?.location.lat) return origin.location;
  if (mapCenter) return mapCenter;
  return undefined;
}

export function AddressInput({
  value,
  onSelect,
  placeholder = 'Digite um endereço...',
  icon,
  autoFocus,
  focus: explicitFocus,
}: AddressInputProps) {
  const mapCenter = useMapStore((s) => s.center);
  const destination = useRouteStore((s) => s.destination);
  const origin = useRouteStore((s) => s.origin);
  const [query, setQuery] = useState(value?.address ?? '');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value?.address ?? '');
  }, [value?.address]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const focus = resolveGeocodeFocus(explicitFocus, mapCenter, destination, origin);
        const res = await geocode(query.trim(), focus);
        setResults(res.results);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao buscar');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mapCenter, destination, origin, explicitFocus]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function handleSelect(r: GeocodeResult) {
    const wp: Waypoint = {
      id: value?.id ?? uid(),
      address: r.label,
      location: r.location,
      fixedOrder: value?.fixedOrder,
      stopDurationMin: value?.stopDurationMin,
    };
    onSelect(wp);
    setQuery(r.label);
    setOpen(false);
  }

  const defaultIcon = <MapPin className="h-4 w-4 text-primary" aria-hidden />;

  const hasDropdown = open && (results.length > 0 || error);

  return (
    <div ref={containerRef} className={cn('relative', hasDropdown && 'z-20')}>
      <div
        className={cn(
          'relative rounded-full bg-card shadow-soft ring-1 ring-border/80 transition-shadow',
          hasDropdown && 'shadow-candy ring-primary/30',
        )}
      >
        <span className="pointer-events-none absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-secondary">
          {icon ?? defaultIcon}
        </span>
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="border-0 bg-transparent pl-12 pr-10 text-foreground shadow-none ring-0 focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 [&:not(:focus)]:truncate"
          autoFocus={autoFocus}
          aria-autocomplete="list"
          aria-expanded={open}
          title={query.length > 40 ? query : undefined}
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}

        {hasDropdown && (
          <div
            className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-auto rounded-2xl border border-border bg-card shadow-candy"
            role="listbox"
          >
            {error && (
              <div className="p-3 text-sm text-destructive" role="alert">
                {error}
              </div>
            )}
            {results.map((r, i) => (
              <button
                type="button"
                key={`${r.label}-${i}`}
                onClick={() => handleSelect(r)}
                className="flex w-full items-start gap-2 border-b border-border/40 px-4 py-2.5 text-left text-sm text-foreground last:border-b-0 hover:bg-secondary"
                role="option"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="line-clamp-2">{r.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
