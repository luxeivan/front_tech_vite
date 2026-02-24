import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { fromLonLat } from "ol/proj";
import { Icon, Style } from "ol/style";
import Text from "ol/style/Text";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";

// Import the SVG as text so we can recolor it (moving vs idle) without changing shape.
import pesIconSvgRaw from "../../../assets/PES.svg?raw";

// Размер ПЭС-иконки
const PES_ICON_SCALE_MULT = 0.04;

export const PES_POLL_MS_DEFAULT = 120_000;

// If speed > threshold, treat the vehicle as "moving" and color it red.
const PES_MOVING_SPEED_THRESHOLD = 0;
const PES_ICON_COLOR_IDLE = "#000000";
const PES_ICON_COLOR_MOVING = "#cf1322";

export const PES_ALLOWED_IDS = new Set([
  52459, 53810, 24490, 53832, 52879, 53796, 53973, 54102, 54093, 21718, 52957,
  957, 54083, 24358, 1152, 53561, 52529, 53833, 977, 54099, 52878, 54113, 54092,
  53852, 54066, 1173, 54128, 54119, 53834, 53945, 52498, 52455, 54091, 54067,
  52465, 1142, 19808, 53001, 54071, 54127, 54105, 1138, 51598, 53835, 1072,
  54111, 1097, 52461, 54084, 51556, 962, 24807, 54090, 53850, 1066, 52466,
  51824, 24798, 54126, 52447, 21808, 53836, 24325, 24786, 54130, 54116, 53917,
  19847, 1110, 1153, 52462, 21812, 1160, 53851, 52467, 53956, 52882, 52212,
  1071, 54125, 54107, 53924, 51750, 53837, 54131, 54117, 1111, 52888, 54086,
  53939, 51479, 1213, 942, 53977, 54124, 54106, 54088, 54097, 19837, 54132,
  52967, 54087, 52494, 973, 53948, 52689, 53573, 52469, 53954, 19804, 54123,
  54101, 54089, 54096, 51605, 52718, 19850, 24800, 54115, 54080, 53989, 53830,
  54949, 53971, 54100, 53923, 54095, 54081, 53929, 53831, 53855, 996, 24344,
  53797, 1123, 53984, 19855, 53949, 51483, 51771, 51598,
]);

export const pesIconDataUrl = (fillColor = PES_ICON_COLOR_IDLE) => {
  // PES.svg uses a `style="fill:#000000"` declaration; replace it to recolor the icon.
  const patched = String(pesIconSvgRaw || "")
    .replace(/fill:\s*#000000/gi, `fill:${fillColor}`)
    .replace(/fill="#000000"/gi, `fill="${fillColor}"`);
  return `data:image/svg+xml;utf8,${encodeURIComponent(patched.trim())}`;
};

const PES_ICON_SRC_IDLE = pesIconDataUrl(PES_ICON_COLOR_IDLE);
const PES_ICON_SRC_MOVING = pesIconDataUrl(PES_ICON_COLOR_MOVING);

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
      const moving = Number.isFinite(speed) && speed > PES_MOVING_SPEED_THRESHOLD;
      const showLabel = z >= 12;

      return new Style({
        image: new Icon({
          src: moving ? PES_ICON_SRC_MOVING : PES_ICON_SRC_IDLE,
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
