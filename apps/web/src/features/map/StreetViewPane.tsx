import { useEffect, useRef } from 'react';
import type { OptimizedRoute } from '@docitomapas/shared';
import { computeCumulativeDistances, haversineMeters, interpolatePosition } from '@/lib/geometry';
import { loadGoogleMapsApi } from '@/lib/googleMapsLoader';
import { usePlayerStore } from '@/stores/playerStore';

const MIN_MOVE_METERS = 12;
const PANORAMA_RADIUS_M = 50;

interface StreetViewPaneProps {
  route: OptimizedRoute;
  active: boolean;
}

/**
 * Google Street View — fotos panorâmicas reais ao nível da rua (qualidade Google Earth/Maps).
 * Usado no modo Foto 3D → 1ª pessoa.
 */
export function StreetViewPane({ route, active }: StreetViewPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const serviceRef = useRef<google.maps.StreetViewService | null>(null);
  const lastLookupRef = useRef<{ lng: number; lat: number } | null>(null);
  const cumulativeRef = useRef(computeCumulativeDistances(route.fullGeometry));

  const setStreetViewReady = usePlayerStore((s) => s.setStreetViewReady);
  const setStreetViewUnavailable = usePlayerStore((s) => s.setStreetViewUnavailable);
  const streetViewUnavailable = usePlayerStore((s) => s.streetViewUnavailable);

  useEffect(() => {
    cumulativeRef.current = computeCumulativeDistances(route.fullGeometry);
  }, [route]);

  useEffect(() => {
    if (!active) {
      panoRef.current?.setVisible(false);
      setStreetViewReady(false);
      return;
    }

    let cancelled = false;

    void loadGoogleMapsApi()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        if (!panoRef.current) {
          panoRef.current = new google.maps.StreetViewPanorama(containerRef.current, {
            disableDefaultUI: true,
            scrollwheel: true,
            motionTracking: false,
            motionTrackingControl: false,
          });
          serviceRef.current = new google.maps.StreetViewService();
        }
        panoRef.current.setVisible(true);
      })
      .catch(() => {
        setStreetViewUnavailable(true);
      });

    return () => {
      cancelled = true;
    };
  }, [active, setStreetViewReady, setStreetViewUnavailable]);

  useEffect(() => {
    if (!active) return;

    const updateFromProgress = async (progress: number) => {
      const pano = panoRef.current;
      const svc = serviceRef.current;
      if (!pano || !svc) return;

      const pos = interpolatePosition(route.fullGeometry, progress, cumulativeRef.current);
      if (!pos) return;

      const last = lastLookupRef.current;
      if (
        last &&
        haversineMeters([last.lng, last.lat], [pos.lng, pos.lat]) < MIN_MOVE_METERS
      ) {
        pano.setPov({ heading: pos.heading, pitch: 0 });
        return;
      }

      try {
        const { data } = await svc.getPanorama({
          location: { lat: pos.lat, lng: pos.lng },
          radius: PANORAMA_RADIUS_M,
          source: google.maps.StreetViewSource.OUTDOOR,
        });
        if (!data?.location?.pano) {
          setStreetViewUnavailable(true);
          return;
        }
        lastLookupRef.current = { lng: pos.lng, lat: pos.lat };
        pano.setPano(data.location.pano);
        pano.setPov({ heading: pos.heading, pitch: 0 });
        pano.setVisible(true);
        setStreetViewReady(true);
        setStreetViewUnavailable(false);
      } catch {
        setStreetViewUnavailable(true);
        setStreetViewReady(false);
      }
    };

    const unsub = usePlayerStore.subscribe((state, prev) => {
      if (!active) return;
      if (state.progress === prev.progress) return;
      void updateFromProgress(state.progress);
    });

    void updateFromProgress(usePlayerStore.getState().progress);

    return unsub;
  }, [active, route, setStreetViewReady, setStreetViewUnavailable]);

  if (!active) return null;

  return (
    <div className="absolute inset-0 z-[6] h-full w-full">
      <div ref={containerRef} className="h-full w-full" aria-label="Google Street View" />
      {streetViewUnavailable && (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex justify-center">
          <p className="max-w-md rounded-2xl border border-amber-300/70 bg-amber-50/95 px-4 py-3 text-center text-sm text-amber-950 shadow-candy backdrop-blur">
            <span className="font-semibold">Street View indisponível</span> neste trecho. Tente outra
            rota ou use a câmera isométrica.
          </p>
        </div>
      )}
    </div>
  );
}
