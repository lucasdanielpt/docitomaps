import { GOOGLE_MAPS_API_KEY } from '@/config/maps';

export interface GoogleTilesCheckResult {
  ok: boolean;
  status: number;
  message: string;
}

let cachedCheck: GoogleTilesCheckResult | null = null;
let cachedCheckKey = '';

/** Verifica se a chave consegue aceder ao root.json (1× por sessão / chave). */
export async function verifyGooglePhotorealisticTilesKey(
  key: string = GOOGLE_MAPS_API_KEY,
): Promise<GoogleTilesCheckResult> {
  if (!key) {
    return {
      ok: false,
      status: 0,
      message: 'VITE_GOOGLE_MAPS_API_KEY não definida. Reinicie o dev server após editar .env.local.',
    };
  }

  if (cachedCheck && cachedCheckKey === key) {
    return cachedCheck;
  }

  const url = `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url);
    if (res.ok) {
      cachedCheck = { ok: true, status: res.status, message: '' };
      cachedCheckKey = key;
      return cachedCheck;
    }

    const body = await res.text();
    let result: GoogleTilesCheckResult;
    if (res.status === 403) {
      result = {
        ok: false,
        status: 403,
        message:
          'Chave rejeitada (403). Habilite a Map Tiles API, ative billing e confira restrições de referrer (localhost:5173).',
      };
    } else if (res.status === 404) {
      result = {
        ok: false,
        status: 404,
        message:
          'Endpoint 404 — quase sempre Map Tiles API não habilitada no projeto Google Cloud, ou chave de outro projeto.',
      };
    } else {
      result = {
        ok: false,
        status: res.status,
        message: `Google Tiles respondeu ${res.status}: ${body.slice(0, 160)}`,
      };
    }
    cachedCheck = result;
    cachedCheckKey = key;
    return result;
  } catch {
    const result: GoogleTilesCheckResult = {
      ok: false,
      status: 0,
      message: 'Falha de rede ao contactar tile.googleapis.com.',
    };
    cachedCheck = result;
    cachedCheckKey = key;
    return result;
  }
}

/** Intervalo mínimo entre setView automático (ms) — não afeta órbita manual. */
export const CESIUM_CAMERA_MIN_INTERVAL_MS = 150;

/** SSE equilibrado: mais detalhe para vista isométrica (menor = mais nítido). */
export const CESIUM_TILESET_SSE = 4;

/** Densidade do SSE dinâmico — mais detalhe perto da câmera. */
export const CESIUM_TILESET_SSE_DYNAMIC_DENSITY = 0.0001;

/** Velocidade máxima recomendada no Foto 3D (LOD estável). */
export const REALISTIC3D_MAX_SPEED = 2 as const;
