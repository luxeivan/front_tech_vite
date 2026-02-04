import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { fromLonLat } from "ol/proj";
import { Icon, Style } from "ol/style";
import Text from "ol/style/Text";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";

import pesIcon from "../../../assets/PES.svg";

// Размер ПЭС-иконки
const PES_ICON_SCALE_MULT = 0.04;

export const PES_POLL_MS_DEFAULT = 120_000; 

export const PES_ALLOWED_IDS = new Set([
  52957, 
  53945, 
  52455,
  51547, 
  53835, 
  54111, 
  // 51556, 
  54117, 
  51479, 
  54132, 
  54123, 
  53949,
]);

export const pesIconDataUrl = (fillColor = "#d46b08") => {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <path d="M10 26h26l8 8h10v14H10z" fill="${fillColor}" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>
  <path d="M36 26h8l8 8h-8z" fill="${fillColor}" opacity="0.9"/>
  <path d="M30 18l-6 12h6l-4 16 12-18h-6l4-10z" fill="#ffd666" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="20" cy="48" r="6" fill="#262626" stroke="#ffffff" stroke-width="3"/>
  <circle cx="44" cy="48" r="6" fill="#262626" stroke="#ffffff" stroke-width="3"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
};

const formatTime = (ms) => {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "—";
  try {
    return new Date(n).toLocaleString();
  } catch {
    return String(n);
  }
};

export const buildPesPopupHtml = ({ name, model, speed, time, lat, lon }) => {
  const sp = Number.isFinite(Number(speed)) ? Number(speed) : 0;
  const latS = Number.isFinite(lat) ? lat.toFixed(6) : "—";
  const lonS = Number.isFinite(lon) ? lon.toFixed(6) : "—";
  return `<div><b>${name || "ПЭС"}</b>
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
      const showLabel = z >= 12;

      return new Style({
        image: new Icon({
          src: pesIcon,
          imgSize: [64, 64],
          opacity: 0.65,
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
    },
  });

  return { source, layer };
};

/**
 * Запускает поллинг ПЭС и обновляет source.
 * Возвращает stop() для корректного cleanup.
 */
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

      // Filter only real PES units by known IDs
      const vehicles = vehiclesRaw.filter((v) => {
        const idNum = typeof v?.id === "number" ? v.id : parseInt(v?.id, 10);
        return Number.isFinite(idNum) && PES_ALLOWED_IDS.has(idNum);
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

        const idNum = typeof v?.id === "number" ? v.id : parseInt(v?.id, 10);
        feature.setProperties({ id: idNum, name, model, speed, time });
        feature.set(
          "_popupHtml",
          buildPesPopupHtml({ name, model, speed, time, lat, lon }),
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
