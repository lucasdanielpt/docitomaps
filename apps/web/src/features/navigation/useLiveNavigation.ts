import { useEffect } from 'react';
import { useRouteStore } from '@/stores/routeStore';
import { useNavigationStore } from '@/stores/navigationStore';
import { computeCumulativeDistances } from '@/lib/geometry';
import { getNavigationInstruction, snapToRoute } from '@/lib/navigation';

const OFF_ROUTE_THRESHOLD_M = 80;

/**
 * Observa GPS e projeta posição na rota ativa (modo navegação ao vivo).
 */
export function useLiveNavigation() {
  const route = useRouteStore((s) => s.route);
  const active = useNavigationStore((s) => s.active);
  const setGpsUpdate = useNavigationStore((s) => s.setGpsUpdate);
  const setGpsError = useNavigationStore((s) => s.setGpsError);
  const setWatchId = useNavigationStore((s) => s.setWatchId);

  useEffect(() => {
    if (!active || !route) return;
    if (!navigator.geolocation) {
      setGpsError('Geolocalização não suportada neste navegador.');
      return;
    }

    const cumulative = computeCumulativeDistances(route.fullGeometry);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const raw = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const snapped = snapToRoute(raw.lng, raw.lat, route.fullGeometry, cumulative);
        if (!snapped) {
          setGpsError('Não foi possível encaixar posição na rota.');
          return;
        }
        const instruction = getNavigationInstruction(route, snapped.progress, cumulative);
        setGpsUpdate({
          raw,
          snapped: { lat: snapped.lat, lng: snapped.lng },
          progress: snapped.progress,
          offRouteMeters: snapped.offRouteMeters,
          heading:
            pos.coords.heading != null && pos.coords.heading >= 0
              ? pos.coords.heading
              : snapped.heading,
          instruction,
        });
        if (snapped.offRouteMeters > OFF_ROUTE_THRESHOLD_M) {
          setGpsError(`Fora da rota (${Math.round(snapped.offRouteMeters)} m)`);
        }
      },
      (err) => {
        setGpsError(err.message || 'Erro ao obter localização.');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );

    setWatchId(watchId);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    };
  }, [active, route, setGpsUpdate, setGpsError, setWatchId]);
}
