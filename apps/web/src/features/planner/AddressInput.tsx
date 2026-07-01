import { useEffect, useRef, useState } from 'react';
import type { GeocodeResult, Waypoint } from '@docitomapas/shared';
import { Input } from '@/components/ui/input';
import { geocode } from '@/services/api';
import { uid } from '@/lib/utils';
import { MapPin, Loader2 } from 'lucide-react';

export interface AddressInputProps {
  value: Waypoint | null;
  onSelect: (wp: Waypoint) => void;
  placeholder?: string;
  iconColor?: string;
  autoFocus?: boolean;
}

export function AddressInput({
  value,
  onSelect,
  placeholder = 'Digite um endereço...',
  iconColor = 'text-primary',
  autoFocus,
}: AddressInputProps) {
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
    if (query.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await geocode(query.trim());
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
  }, [query]);

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

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin
          className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${iconColor}`}
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-9 pr-9"
          autoFocus={autoFocus}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && (results.length > 0 || error) && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-md border bg-background shadow-lg">
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
              className="flex w-full items-start gap-2 border-b px-3 py-2 text-left text-sm hover:bg-accent last:border-b-0"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
