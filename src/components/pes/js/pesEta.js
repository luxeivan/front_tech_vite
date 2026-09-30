// ETA до точки назначения: позиция ГЛОНАСС-трекера + бесплатный OSRM (OSM).
const OSRM_ROUTE_URL = "https://router.project-osrm.org/route/v1/driving";
const ROUTE_CACHE_TTL_MS = 2 * 60 * 1000;
const ROUTE_CACHE_MAX = 300;
const FALLBACK_ROAD_FACTOR = 1.35;
const FALLBACK_SPEED_KMH = 50;

function getBackendBase() {
  const a = String(import.meta.env.VITE_URL_BACKEND_SERVICES || "").trim();
  const b = String(import.meta.env.VITE_URL_BACKEND || "").trim();
  return (a || b).replace(/\/$/, "");
}

const routeCache = new Map();

export function normalizePesNumber(value) {
  const raw = String(value == null ? "" : value);
  if (!raw.trim()) return "";
  const explicit = raw.match(/№\s*0*(\d{1,3})(?!\d)/i);
  if (explicit) return explicit[1].padStart(3, "0");
  const named = raw.match(/(?:^|[_\s-])0*(\d{1,3})(?=[_\s-]|$)/i);
  if (named) return named[1].padStart(3, "0");
  return "";
}

export function extractVehiclePlate(value) {
  const raw = String(value || "")
    .toUpperCase()
    .replace(/Ё/g, "Е")
    .replace(/№\s*\d+/g, " ");
  const match = raw.match(/([АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{1,2})/);
  return match ? match[1] : "";
}

export function matchVehicleForPes(item, vehicles) {
  const number =
    normalizePesNumber(item?.number) || normalizePesNumber(item?.name) || "";
  if (!number || !Array.isArray(vehicles) || !vehicles.length) return null;

  const plate = extractVehiclePlate(item?.name);
  const candidates = [];

  for (const vehicle of vehicles) {
    const vehicleNumber =
      normalizePesNumber(vehicle?.name) ||
      normalizePesNumber(vehicle?.model) ||
      normalizePesNumber(vehicle?.caption);
    if (vehicleNumber !== number) continue;

    const vehiclePlate = extractVehiclePlate(vehicle?.name);
    const hasCoords = Number.isFinite(Number(vehicle?.lat)) && Number.isFinite(Number(vehicle?.lon));
    const speed = Number(vehicle?.speed) || 0;

    let score = 0;
    if (plate && vehiclePlate && plate === vehiclePlate) score += 10;
    if (hasCoords) score += 5;
    if (speed > 0) score += 2;
    if (vehiclePlate) score += 1;

    candidates.push({ vehicle, score, hasCoords });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].hasCoords ? candidates[0].vehicle : null;
}

function haversineKm(from, to) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

function estimateEtaMinutes(from, to) {
  const km = haversineKm(from, to);
  if (!Number.isFinite(km)) return null;
  const hours = (km * FALLBACK_ROAD_FACTOR) / FALLBACK_SPEED_KMH;
  return hours * 60;
}

function cacheKey(from, to) {
  const round = (n) => Number(n).toFixed(3);
  return `${round(from.lat)},${round(from.lon)}->${round(to.lat)},${round(to.lon)}`;
}

export async function fetchRouteEtaMinutes(from, to) {
  const key = cacheKey(from, to);
  const cached = routeCache.get(key);
  if (cached && Date.now() - cached.loadedAt < ROUTE_CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const url = `${OSRM_ROUTE_URL}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false&alternatives=false&steps=false`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error(`OSRM ${resp.status}`);
    const data = await resp.json();
    const durationSec = Number(data?.routes?.[0]?.duration);
    if (!Number.isFinite(durationSec)) throw new Error("OSRM: empty route");

    const value = {
      minutes: Math.max(0, Math.round(durationSec / 60)),
      source: "osrm",
    };
    if (routeCache.size >= ROUTE_CACHE_MAX) {
      const oldest = routeCache.keys().next().value;
      routeCache.delete(oldest);
    }
    routeCache.set(key, { value, loadedAt: Date.now() });
    return value;
  } catch {
    const minutes = estimateEtaMinutes(from, to);
    const value = minutes == null
      ? { minutes: null, source: null }
      : { minutes: Math.max(0, Math.round(minutes)), source: "estimate" };
    routeCache.set(key, { value, loadedAt: Date.now() });
    return value;
  }
}

export async function fetchPesVehicles(signal) {
  const base = getBackendBase();
  if (!base) return [];
  const resp = await fetch(`${base}/services/pes/vehicles`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) throw new Error(`PES vehicles fetch failed: ${resp.status}`);
  const data = await resp.json();
  return Array.isArray(data?.vehicles) ? data.vehicles : [];
}

export function getDestinationPoint(item) {
  const dest = item?.destination;
  if (!dest) return null;
  const lat = Number(dest.lat ?? dest.latitude);
  const lon = Number(dest.lon ?? dest.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

export function getVehiclePoint(vehicle) {
  if (!vehicle) return null;
  const lat = Number(vehicle.lat ?? vehicle.latitude);
  const lon = Number(vehicle.lon ?? vehicle.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

export function isActiveEtaStatus(status) {
  return status === "en_route" || status === "delay";
}

export async function computePesEta(item, vehicles) {
  const to = getDestinationPoint(item);
  const from = getVehiclePoint(matchVehicleForPes(item, vehicles));
  if (!to || !from) return { minutes: null, source: null };
  return fetchRouteEtaMinutes(from, to);
}
