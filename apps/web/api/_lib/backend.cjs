/**
 * Backend leve para Vercel (sem Fastify).
 * Usado por api/geocode.js, api/route.js e api/optimize.js.
 */

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function orsKey() {
  return (process.env.ORS_API_KEY || '').trim();
}

function orsBase() {
  return process.env.ORS_BASE_URL || 'https://api.openrouteservice.org';
}

async function orsFetch(path, init = {}) {
  const key = orsKey();
  if (!key) {
    const err = new Error('ORS_API_KEY não configurada');
    err.status = 503;
    throw err;
  }
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', key);
  headers.set('Accept', 'application/json, application/geo+json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${orsBase()}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`ORS ${path} → ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

async function nominatimSearch(query, limit = 5) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: String(limit),
    'accept-language': 'pt',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'DocitoMapas/1.0 (travel route planner)' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((item) => ({
    label: item.display_name,
    location: { lat: Number(item.lat), lng: Number(item.lon) },
  }));
}

async function orsGeocode(query, limit = 6, focus) {
  const params = new URLSearchParams({ text: query, size: String(limit), lang: 'pt' });
  if (focus) {
    params.set('focus.point.lat', String(focus.lat));
    params.set('focus.point.lon', String(focus.lng));
  }
  const res = await orsFetch(`/geocode/search?${params}`, { method: 'GET' });
  const data = await res.json();
  return (data.features || []).map((f) => {
    const [lng, lat] = f.geometry.coordinates;
    return {
      label: f.properties.label,
      location: { lat, lng },
      countryCode: f.properties.country_a,
    };
  });
}

function mergeResults(primary, secondary, limit) {
  const seen = new Set();
  const out = [];
  for (const r of [...primary, ...secondary]) {
    const key = `${r.location.lat.toFixed(5)}:${r.location.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

function decodePolyline(str, precision = 5) {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];
  const factor = 10 ** precision;
  while (index < str.length) {
    let shift = 0;
    let result = 0;
    let byte;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([lng / factor, lat / factor]);
  }
  return coordinates;
}

async function orsDirections(coordinates, mode, preferences) {
  const body = {
    coordinates,
    instructions: true,
    geometry: true,
    preference: 'fastest',
    units: 'm',
    language: 'pt',
  };
  const avoid = [];
  if (preferences?.avoidTolls) avoid.push('tollways');
  if (preferences?.avoidHighways) avoid.push('highways');
  if (preferences?.avoidFerries) avoid.push('ferries');
  if (avoid.length) body.options = { avoid_features: avoid };

  const res = await orsFetch(`/v2/directions/${mode}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) {
    const err = new Error('ORS não retornou rota');
    err.status = 502;
    throw err;
  }

  const coords = decodePolyline(route.geometry);
  const wayPointIndices = route.way_points || [];
  const legs = route.segments.map((seg, i) => {
    const startIdx = wayPointIndices[i] ?? 0;
    const endIdx = wayPointIndices[i + 1] ?? coords.length - 1;
    return {
      fromId: `wp-${i}`,
      toId: `wp-${i + 1}`,
      distanceMeters: seg.distance,
      durationSeconds: seg.duration,
      geometry: { type: 'LineString', coordinates: coords.slice(startIdx, endIdx + 1) },
      instructions: (seg.steps || []).map((s) => {
        const wp = s.way_points?.[0] ?? 0;
        return {
          distanceMeters: s.distance,
          durationSeconds: s.duration,
          instruction: s.instruction,
          location: coords[wp] || [0, 0],
        };
      }),
    };
  });

  return {
    totalDistanceMeters: route.summary.distance,
    totalDurationSeconds: route.summary.duration,
    fullGeometry: { type: 'LineString', coordinates: coords },
    legs,
  };
}

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Ordem simples por distância (origem → mais próximo sucessivo). */
function nearestNeighborOrder(origin, stops) {
  const remaining = stops.map((s, i) => ({ s, i }));
  const order = [];
  let cur = origin;
  while (remaining.length) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineMeters(cur, remaining[i].s.location);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const [picked] = remaining.splice(best, 1);
    order.push(picked.s.id);
    cur = picked.s.location;
  }
  return order;
}

async function handleGeocode(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.end();
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const body = readBody(req);
    const query = String(body.query || '').trim();
    if (query.length < 2) return json(res, 400, { error: 'bad_request', message: 'query curta' });
    const limit = Math.min(20, Math.max(1, Number(body.limit) || 6));
    const focus = body.focus;

    let orsResults = [];
    if (orsKey()) {
      try {
        orsResults = await orsGeocode(query, limit, focus);
      } catch {
        /* fallback Nominatim */
      }
    }
    const nominatim = await nominatimSearch(query, limit);
    const results = mergeResults(orsResults, nominatim, limit);
    return json(res, 200, { results });
  } catch (err) {
    return json(res, err.status || 500, {
      error: 'geocode_failed',
      message: err.message || 'internal_error',
    });
  }
}

async function handleRoute(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.end();
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const body = readBody(req);
    const waypoints = body.waypoints;
    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      return json(res, 400, { error: 'bad_request', message: 'waypoints inválidos' });
    }
    const mode = body.mode || 'driving-car';
    const coords = waypoints.map((w) => [w.lng, w.lat]);
    const dir = await orsDirections(coords, mode, body.preferences);
    return json(res, 200, dir);
  } catch (err) {
    return json(res, err.status || 500, {
      error: 'route_failed',
      message: err.message || 'internal_error',
    });
  }
}

async function handleOptimize(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.end();
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  try {
    const body = readBody(req);
    const { origin, destination, stops = [], mode = 'driving-car', preferences } = body;
    if (!origin?.location) {
      return json(res, 400, { error: 'bad_request', message: 'origin obrigatória' });
    }

    const free = stops.filter((s) => !s.fixedOrder);
    const fixed = stops.filter((s) => s.fixedOrder);
    // Ordem: origem → livres (nearest) intercalados com fixos na ordem do array
    let optimizedOrder = [];
    if (fixed.length === 0) {
      optimizedOrder = nearestNeighborOrder(origin.location, free);
    } else {
      // Mantém fixos na posição relativa; livres por nearest neighbor entre âncoras
      const ordered = [];
      let anchor = origin.location;
      let batch = [];
      const flush = () => {
        if (!batch.length) return;
        ordered.push(...nearestNeighborOrder(anchor, batch));
        batch = [];
      };
      for (const stop of stops) {
        if (stop.fixedOrder) {
          flush();
          ordered.push(stop.id);
          anchor = stop.location;
        } else {
          batch.push(stop);
        }
      }
      flush();
      optimizedOrder = ordered;
    }

    const orderedStops = optimizedOrder
      .map((id) => stops.find((s) => s.id === id))
      .filter(Boolean);

    const coords = [
      [origin.location.lng, origin.location.lat],
      ...orderedStops.map((s) => [s.location.lng, s.location.lat]),
    ];
    if (destination?.location) {
      coords.push([destination.location.lng, destination.location.lat]);
    }

    const dir = await orsDirections(coords, mode, preferences);
    const ids = [origin.id, ...orderedStops.map((s) => s.id)];
    if (destination) ids.push(destination.id);
    const legs = dir.legs.map((leg, i) => ({
      ...leg,
      fromId: ids[i] ?? leg.fromId,
      toId: ids[i + 1] ?? leg.toId,
    }));

    return json(res, 200, {
      optimizedOrder,
      route: {
        totalDistanceMeters: dir.totalDistanceMeters,
        totalDurationSeconds: dir.totalDurationSeconds,
        legs,
        fullGeometry: dir.fullGeometry,
      },
    });
  } catch (err) {
    return json(res, err.status || 500, {
      error: 'optimize_failed',
      message: err.message || 'internal_error',
    });
  }
}

module.exports = { handleGeocode, handleRoute, handleOptimize, json };
