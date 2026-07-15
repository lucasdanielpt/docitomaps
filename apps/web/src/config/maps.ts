/** Chave Google Maps (Map Tiles / Photorealistic 3D). Nunca commitar .env.local. */
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';

export const hasGoogleMapsKey = GOOGLE_MAPS_API_KEY.length > 0;
