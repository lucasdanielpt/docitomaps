import { GOOGLE_MAPS_API_KEY } from '@/config/maps';

let loadPromise: Promise<typeof google> | null = null;

/** Carrega Google Maps JavaScript API (Street View) uma vez por sessão. */
export function loadGoogleMapsApi(): Promise<typeof google> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps só funciona no navegador.'));
  }
  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) {
      reject(new Error('VITE_GOOGLE_MAPS_API_KEY não configurada.'));
      return;
    }
    const id = 'docito-google-maps-js';
    if (document.getElementById(id)) {
      const poll = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(poll);
          resolve(window.google);
        }
      }, 50);
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;
    script.onload = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error('Google Maps API não inicializou.'));
    };
    script.onerror = () => reject(new Error('Falha ao carregar Google Maps JavaScript API.'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
