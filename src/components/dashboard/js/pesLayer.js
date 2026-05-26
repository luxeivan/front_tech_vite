import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { fromLonLat } from "ol/proj";
import { Circle as CircleStyle, Icon, Style } from "ol/style";
import Text from "ol/style/Text";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";

import pesIconSvgRaw from "../../../assets/PES.svg?raw";

const PES_ICON_SCALE_MULT = 0.04;

export const PES_POLL_MS_DEFAULT = 120_000;

const PES_MOVING_SPEED_THRESHOLD = 0;
const PES_ICON_COLOR_READY = "#52c41a";
const PES_ICON_COLOR_COMMAND_SENT = "#4096ff";
const PES_ICON_COLOR_DELAY = "#4096ff";
const PES_ICON_COLOR_EN_ROUTE = "#fadb14";
const PES_ICON_COLOR_CONNECTED = "#ff4d4f";
const PES_ICON_COLOR_REPAIR = "#bfbfbf";
const PES_ICON_COLOR_MOVING = PES_ICON_COLOR_EN_ROUTE;
const PES_ICON_COLOR_IDLE = PES_ICON_COLOR_READY;
const PES_HALO_COLOR_CONNECTED = "#722ed1";
const PES_ALLOWLIST_COLLECTION =
  import.meta.env.VITE_PES_MAP_ALLOWLIST_COLLECTION || "pes-map-allowlists";
const PES_ALLOWLIST_CACHE_TTL_MS = 5 * 60 * 1000;

let pesAllowlistCache = {
  loadedAt: 0,
  ids: null,
};

const toIntId = (v) => {
  const n = typeof v === "number" ? v : parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

const extractPesId = (row) => {
  const src = row?.attributes || row || {};
  return toIntId(src?.pesId ?? src?.pesid ?? src?.pes_id);
};

async function fetchPesAllowlistIds(signal) {
  const base = String(import.meta.env.VITE_URL_BACKEND || "").replace(/\/$/, "");
  if (!base) return new Set();

  const headers = {};
  try {
    const jwt = localStorage.getItem("jwt");
    if (jwt) headers.Authorization = `Bearer ${jwt}`;
  } catch {
    // ignore localStorage issues
  }

  const out = new Set();
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount) {
    const qs = new URLSearchParams({
      "fields[0]": "pesId",
      "pagination[page]": String(page),
      // На сервере Strapi pageSize ограничен до 100.
      "pagination[pageSize]": "100",
      publicationState: "preview",
    });
    const url = `${base}/api/${PES_ALLOWLIST_COLLECTION}?${qs.toString()}`;
    const resp = await fetch(url, { signal, headers });
    if (!resp.ok) {
      throw new Error(`PES allowlist fetch failed: ${resp.status}`);
    }
    const json = await resp.json();
    const rows = Array.isArray(json?.data) ? json.data : [];
    rows.forEach((it) => {
      const id = extractPesId(it);
      if (Number.isFinite(id)) out.add(id);
    });
    pageCount = Number(json?.meta?.pagination?.pageCount || 1);
    page += 1;
  }

  return out;
}

async function getPesAllowlistIds(signal) {
  const now = Date.now();
  const cache = pesAllowlistCache;
  if (cache.ids && now - cache.loadedAt < PES_ALLOWLIST_CACHE_TTL_MS) {
    return cache.ids;
  }

  const ids = await fetchPesAllowlistIds(signal);
  pesAllowlistCache = { loadedAt: now, ids };
  return ids;
}

export const pesIconDataUrl = (fillColor = PES_ICON_COLOR_IDLE) => {
  const patched = String(pesIconSvgRaw || "")
    .replace(/fill:\s*#000000/gi, `fill:${fillColor}`)
    .replace(/fill="#000000"/gi, `fill="${fillColor}"`);
  return `data:image/svg+xml;utf8,${encodeURIComponent(patched.trim())}`;
};

const PES_ICON_SRC_IDLE = pesIconDataUrl(PES_ICON_COLOR_IDLE);
const PES_ICON_SRC_MOVING = pesIconDataUrl(PES_ICON_COLOR_MOVING);
const PES_ICON_SRC_CONNECTED = pesIconDataUrl(PES_ICON_COLOR_CONNECTED);
const PES_ICON_SRC_BY_STATUS = {
  ready: pesIconDataUrl(PES_ICON_COLOR_READY),
  command_sent: pesIconDataUrl(PES_ICON_COLOR_COMMAND_SENT),
  delay: pesIconDataUrl(PES_ICON_COLOR_DELAY),
  en_route: pesIconDataUrl(PES_ICON_COLOR_EN_ROUTE),
  connected: PES_ICON_SRC_CONNECTED,
  repair: pesIconDataUrl(PES_ICON_COLOR_REPAIR),
};

export const PES_STATUS_LEGEND = [
  {
    status: "ready",
    label: "Готова к выезду (в резерве)",
    legendLabel: "Готов",
    color: PES_ICON_COLOR_READY,
  },
  {
    status: "command_sent",
    label: "Дана команда на выезд",
    legendLabel: "Выезд",
    color: PES_ICON_COLOR_COMMAND_SENT,
  },
  {
    status: "delay",
    label: "Задержка выезда",
    legendLabel: "Задержка",
    color: PES_ICON_COLOR_DELAY,
    blink: true,
  },
  {
    status: "en_route",
    label: "В пути",
    legendLabel: "В пути",
    color: PES_ICON_COLOR_EN_ROUTE,
  },
  {
    status: "connected",
    label: "Подключена (в работе)",
    legendLabel: "Подключена",
    color: PES_ICON_COLOR_CONNECTED,
    haloColor: PES_HALO_COLOR_CONNECTED,
  },
  {
    status: "repair",
    label: "В ремонте",
    legendLabel: "В ремонте",
    color: PES_ICON_COLOR_REPAIR,
  },
];

const PES_STATUS_LABEL_BY_STATUS = PES_STATUS_LEGEND.reduce((acc, item) => {
  acc[item.status] = item.label;
  return acc;
}, {});

const normalizePesNumber = (value) => {
  const raw = String(value == null ? "" : value);
  if (!raw.trim()) return "";

  const explicit = raw.match(/№\s*0*(\d{1,3})(?!\d)/i);
  if (explicit) return explicit[1].padStart(3, "0");

  const named = raw.match(/(?:^|[_\s-])0*(\d{1,3})(?=[_\s-]|$)/i);
  if (named) return named[1].padStart(3, "0");

  return "";
};

const extractVehiclePesNumber = (vehicle) => {
  const sources = [vehicle?.name, vehicle?.model, vehicle?.caption];
  for (const value of sources) {
    const number = normalizePesNumber(value);
    if (number) return number;
  }
  return "";
};

async function fetchPesModuleStatusMap(signal) {
  const base = String(import.meta.env.VITE_URL_BACKEND || "").replace(/\/$/, "");
  if (!base) return new Map();

  const resp = await fetch(`${base}/services/pes/module/items`, { signal });
  if (!resp.ok) throw new Error(`PES module status fetch failed: ${resp.status}`);

  const json = await resp.json();
  const rows = Array.isArray(json?.items) ? json.items : [];
  const map = new Map();

  rows.forEach((item) => {
    const number = normalizePesNumber(item?.number);
    if (!number) return;
    map.set(number, {
      status: item?.effectiveStatus || item?.status || "ready",
      branch: item?.branch || "",
      po: item?.po || "",
    });
  });

  return map;
}

const formatTime = (ms) => {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "—";
  try {
    return new Date(n).toLocaleString();
  } catch {
    return String(n);
  }
};

const pesStatusLabel = (status) => {
  return PES_STATUS_LABEL_BY_STATUS[status] || "—";
};

export const buildPesPopupHtml = ({
  name,
  model,
  speed,
  time,
  lat,
  lon,
  moduleStatus,
}) => {
  const sp = Number.isFinite(Number(speed)) ? Number(speed) : 0;
  const latS = Number.isFinite(lat) ? lat.toFixed(6) : "—";
  const lonS = Number.isFinite(lon) ? lon.toFixed(6) : "—";
  return `<div><b>${name || "ПЭС"}</b>
    <br/>Статус: ${pesStatusLabel(moduleStatus)}
    <br/>Модель: ${model || "—"}
    <br/>Скорость: ${sp}
    <br/>Время: ${formatTime(time)}
    <br/>Коорд.: ${latS}, ${lonS}
  </div>`;
};

/**
 * Создаёт source+layer для ПЭС.
 * @param {object} params
 * @param {() => number} params.getZoom - функция, возвращающая текущий zoom (из viewRef)
 * @param {() => number} params.getFallbackZoom - запасной zoom (из React state)
 */
export const createPesLayer = ({ getZoom, getFallbackZoom }) => {
  const source = new VectorSource();

  const layer = new VectorLayer({
    source,
    zIndex: 9999,
    declutter: true,
    style: (feature) => {
      const z =
        (getZoom && getZoom()) ?? (getFallbackZoom && getFallbackZoom()) ?? 10;

      const name = (feature.get("name") || "").toString();
      const speed = Number(feature.get("speed") ?? 0);
      const moduleStatus = String(feature.get("moduleStatus") || "");
      const connected = moduleStatus === "connected";
      const moving =
        Number.isFinite(speed) && speed > PES_MOVING_SPEED_THRESHOLD;
      const showLabel = z >= 12;
      const iconSrc =
        PES_ICON_SRC_BY_STATUS[moduleStatus] ||
        (moving ? PES_ICON_SRC_MOVING : PES_ICON_SRC_IDLE);

      const iconStyle = new Style({
        image: new Icon({
          src: iconSrc,
          imgSize: [64, 64],
          opacity: 0.6,
          scale:
            (z < 10
              ? 0.55
              : z < 12
                ? 0.65
                : z < 14
                  ? 0.75
                  : z < 16
                    ? 0.85
                    : 0.95) * PES_ICON_SCALE_MULT,
          anchor: [0.5, 1],
          anchorXUnits: "fraction",
          anchorYUnits: "fraction",
        }),

        text: showLabel
          ? new Text({
              text: name,
              font: "600 12px system-ui, sans-serif",
              fill: new Fill({ color: "#001529" }),
              stroke: new Stroke({ color: "#ffffff", width: 3 }),
              textAlign: "left",
              textBaseline: "middle",
              offsetX: 14,
              offsetY: -10,
            })
          : undefined,
      });

      if (!connected) return iconStyle;

      return [
        new Style({
          image: new CircleStyle({
            radius:
              z < 10
                ? 11
                : z < 12
                  ? 13
                  : z < 14
                    ? 15
                    : z < 16
                      ? 17
                      : 19,
            fill: new Fill({ color: "rgba(255, 255, 255, 0.9)" }),
            stroke: new Stroke({
              color: PES_HALO_COLOR_CONNECTED,
              width: 4,
            }),
          }),
          zIndex: -1,
        }),
        iconStyle,
      ];
    },
  });

  return { source, layer };
};

export const startPesPolling = ({
  source,
  endpoint,
  pollMs = PES_POLL_MS_DEFAULT,
  onError,
}) => {
  if (!source || !endpoint) {
    return { stop: () => {} };
  }

  let timer = null;
  let stopped = false;
  const ac = new AbortController();

  const load = async () => {
    try {
      const resp = await fetch(endpoint, { signal: ac.signal });
      if (!resp.ok) throw new Error(`PES fetch failed: ${resp.status}`);
      const json = await resp.json();
      const vehiclesRaw = Array.isArray(json?.vehicles) ? json.vehicles : [];
      const [allowedIds, statusMap] = await Promise.all([
        getPesAllowlistIds(ac.signal),
        fetchPesModuleStatusMap(ac.signal).catch((e) => {
          console.warn("[MapOL] PES module status error:", e?.message || e);
          return new Map();
        }),
      ]);

      const vehicles = vehiclesRaw.filter((v) => {
        const idNum = toIntId(v?.id);
        return Number.isFinite(idNum) && allowedIds.has(idNum);
      });

      const feats = [];
      for (const v of vehicles) {
        const lat = typeof v?.lat === "number" ? v.lat : parseFloat(v?.lat);
        const lon = typeof v?.lon === "number" ? v.lon : parseFloat(v?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        const feature = new Feature({
          geometry: new Point(fromLonLat([lon, lat])),
        });

        const name = v?.name || v?.caption || `PES ${v?.id ?? ""}`;
        const model = v?.model || "—";
        const speed = Number(v?.speed ?? 0);
        const time = v?.time ?? null;
        const pesNumber = extractVehiclePesNumber(v);
        const moduleInfo = pesNumber ? statusMap.get(pesNumber) : null;
        const moduleStatus = moduleInfo?.status || "";

        const idNum = typeof v?.id === "number" ? v.id : parseInt(v?.id, 10);
        feature.setProperties({
          id: idNum,
          name,
          model,
          speed,
          time,
          pesNumber,
          moduleStatus,
          moduleBranch: moduleInfo?.branch || "",
          modulePo: moduleInfo?.po || "",
        });
        feature.set(
          "_popupHtml",
          buildPesPopupHtml({
            name,
            model,
            speed,
            time,
            lat,
            lon,
            moduleStatus,
          }),
        );

        feats.push(feature);
      }

      if (!stopped) {
        source.clear(true);
        source.addFeatures(feats);
      }
    } catch (e) {
      if (e?.name === "AbortError") return;
      if (onError) onError(e);
      else console.error("[MapOL] PES vehicles error:", e);
    }
  };

  load();
  timer = setInterval(load, pollMs);

  return {
    stop: () => {
      stopped = true;
      if (timer) clearInterval(timer);
      ac.abort();
    },
    reload: load,
  };
};

export const getPesEndpointFromEnv = () => {
  const base = String(
    // import.meta.env.VITE_URL_BACKEND_SERVICES ||
    import.meta.env.VITE_URL_BACKEND || "",
  ).replace(/\/$/, "");

  if (!base) return "";
  return `${base}/services/pes/vehicles`;
};
