import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import Feature from "ol/Feature";
import OlMap from "ol/Map";
import View from "ol/View";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import MultiLineString from "ol/geom/MultiLineString";
import { fromLonLat } from "ol/proj";
import { defaults as defaultInteractions } from "ol/interaction/defaults";
import Style from "ol/style/Style";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Text from "ol/style/Text";
import GeoJSON from "ol/format/GeoJSON";
import "ol/ol.css";

import useOperationalDashboardStore from "../../../../../stores/operationalDashboard/useOperationalDashboardStore";
import {
  OPERATIONAL_MAP_COLORS,
  OPERATIONAL_MAP_DISTRICT_STROKE_WIDTH,
  OPERATIONAL_MAP_FALLBACK_GEOJSON_URL,
  OPERATIONAL_MAP_MODE_STROKE_COLORS,
  OPERATIONAL_MAP_MODE_STROKE_WIDTH,
  OPERATIONAL_MAP_OFFSET_Y,
  OPERATIONAL_MAP_SCALE,
  OPERATIONAL_MAP_STRETCH_Y,
  OPERATIONAL_WEATHER_LOCATION,
} from "../js/operationalMapPanel.config";
import {
  buildTnOkrugaFeatureCollection,
  fetchTnOkrugaRows,
} from "../../../../../utils/tnOkrugaApi";
import {
  getOperationalFilialPath,
  normalizeOperationalFilialName,
} from "../../../../../utils/operationalFilialRoutes";
import {
  TN_FILIALY_REZIM_UPDATED_EVENT,
  TN_FILIALY_REZIM_UPDATED_STORAGE_KEY,
} from "../../../../../utils/tnFilialyApi";
import {
  buildOperationalMapFilialData,
  buildOperationalMapPoData,
  findOperationalMapAreaData,
  formatMapNumber,
  getWeatherView,
  normalizeOperationalMapAreaName,
} from "../js/operationalMapPanel.utils";
import "../css/OperationalMapPanel.css";

const SERVICES_URL =
  import.meta.env.VITE_URL_BACKEND_SERVICES ||
  import.meta.env.VITE_URL_BACKEND;
const BACKEND_URL = import.meta.env.VITE_URL_BACKEND;
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

const getWeatherHour = (time) => {
  const match = String(time || "").match(/T(\d{2})/);
  return match ? Number(match[1]) : NaN;
};

const formatPressureMmHg = (pressureHpa) => {
  const pressure = Number(pressureHpa);
  return Number.isFinite(pressure) ? formatMapNumber(pressure * 0.750061683) : "—";
};

const normalizeWeatherPayload = (payload) => {
  const current = payload?.current || {};
  const hourly = payload?.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const temperatures = Array.isArray(hourly.temperature_2m) ? hourly.temperature_2m : [];
  const weatherCodes = Array.isArray(hourly.weather_code) ? hourly.weather_code : [];
  const fallbackParts = [
    { key: "night", label: "Ночь", hour: 3 },
    { key: "morning", label: "Утро", hour: 9 },
    { key: "day", label: "День", hour: 15 },
    { key: "evening", label: "Вечер", hour: 21 },
  ].map((part) => {
    const index = times.findIndex((time) => getWeatherHour(time) === part.hour);

    return {
      ...part,
      time: index >= 0 ? times[index] : null,
      temperature: index >= 0 ? temperatures[index] : null,
      weatherCode: index >= 0 ? weatherCodes[index] : null,
    };
  });

  return {
    ok: true,
    source: payload?.source || "open-meteo",
    label: payload?.label || OPERATIONAL_WEATHER_LOCATION.label,
    latitude: payload?.latitude || OPERATIONAL_WEATHER_LOCATION.latitude,
    longitude: payload?.longitude || OPERATIONAL_WEATHER_LOCATION.longitude,
    updatedAt: payload?.updatedAt || current.time,
    temperature: payload?.temperature ?? current.temperature_2m,
    apparentTemperature: payload?.apparentTemperature ?? current.apparent_temperature,
    humidity: payload?.humidity ?? current.relative_humidity_2m,
    windSpeed: payload?.windSpeed ?? current.wind_speed_10m,
    cloudCover: payload?.cloudCover ?? current.cloud_cover,
    precipitation: payload?.precipitation ?? current.precipitation,
    pressure: payload?.pressure ?? current.surface_pressure,
    weatherCode: payload?.weatherCode ?? current.weather_code,
    parts: Array.isArray(payload?.parts) ? payload.parts : fallbackParts,
  };
};

const requestWeatherFromBackend = async (baseUrl) => {
  if (!baseUrl) return null;

  const { data } = await axios.get(`${baseUrl}/services/weather/current`, {
    params: OPERATIONAL_WEATHER_LOCATION,
    timeout: 12000,
  });
  if (data?.ok === false) throw new Error(data?.message || "Погода недоступна");
  return normalizeWeatherPayload(data);
};

const requestWeatherDirectly = async () => {
  const { data } = await axios.get(OPEN_METEO_URL, {
    params: {
      latitude: OPERATIONAL_WEATHER_LOCATION.latitude,
      longitude: OPERATIONAL_WEATHER_LOCATION.longitude,
      current:
        "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,cloud_cover,precipitation,weather_code,surface_pressure",
      hourly: "temperature_2m,weather_code",
      forecast_days: 1,
      wind_speed_unit: "ms",
      timezone: "Europe/Moscow",
    },
    timeout: 12000,
  });
  return normalizeWeatherPayload(data);
};

const loadOperationalWeather = async () => {
  const backends = [...new Set([SERVICES_URL, BACKEND_URL].filter(Boolean))];
  let lastError = null;

  if (import.meta.env.DEV) {
    try {
      return await requestWeatherDirectly();
    } catch (error) {
      lastError = error;
    }
  }

  for (const baseUrl of backends) {
    try {
      const data = await requestWeatherFromBackend(baseUrl);
      if (data) return data;
    } catch (error) {
      lastError = error;
    }
  }

  if (!import.meta.env.DEV) {
    try {
      return await requestWeatherDirectly();
    } catch (error) {
      throw lastError || error;
    }
  }

  throw lastError || new Error("Погода недоступна");
};

const EMPTY_DISTRICT_STYLE = new Style({
  fill: new Fill({ color: "rgba(255, 255, 255, 0.96)" }),
  stroke: new Stroke({ color: "#b8c4d0", width: OPERATIONAL_MAP_DISTRICT_STROKE_WIDTH }),
});
const FILIAL_HOVER_STYLE = new Style({
  zIndex: 30,
  fill: new Fill({ color: "rgba(0, 97, 170, 0)" }),
  stroke: new Stroke({ color: "#0061aa", width: 3 }),
});
const MODE_BOUNDARY_STYLE = (feature) =>
  new Style({
    zIndex: 40,
    stroke: new Stroke({
      color: feature.get("strokeColor") || "#0061aa",
      width: OPERATIONAL_MAP_MODE_STROKE_WIDTH,
    }),
  });
const MAP_FALLBACK_CENTER = [38.25, 55.58];
const MAP_FALLBACK_ZOOM = 8;
const MAP_FIT_PADDING = [10, 6, 8, 6];
const TN_OKRUGA_MAP_CACHE_KEY = "operationalDashboard.tnOkrugaRows.filialModes.v1";
const MAP_ZOOM_DELTA =
  Number.isFinite(Number(OPERATIONAL_MAP_SCALE)) && Number(OPERATIONAL_MAP_SCALE) > 0
    ? Math.log2(Number(OPERATIONAL_MAP_SCALE))
    : 0;

const fitMapToSource = (view, source) => {
  const extent = source.getExtent();
  if (!extent?.every?.(Number.isFinite)) return;

  view.fit(extent, {
    padding: MAP_FIT_PADDING,
  });

  const zoom = view.getZoom();
  if (Number.isFinite(zoom) && Number.isFinite(MAP_ZOOM_DELTA) && MAP_ZOOM_DELTA !== 0) {
    view.setZoom(zoom + MAP_ZOOM_DELTA);
  }
};

const normalizeDistrictMode = (mode) =>
  String(mode || "")
    .trim()
    .toLowerCase();

const getModeStrokeColor = (mode) => {
  const normalizedMode = normalizeDistrictMode(mode);
  if (normalizedMode === "рпг") return OPERATIONAL_MAP_MODE_STROKE_COLORS.rpg;
  if (normalizedMode === "орр") return OPERATIONAL_MAP_MODE_STROKE_COLORS.orr;
  return OPERATIONAL_MAP_MODE_STROKE_COLORS[normalizedMode] || null;
};

const getFeatureFilialName = (feature) =>
  String(feature?.get?.("filial_name") || "").trim();

const getFeaturePoName = (feature) =>
  String(feature?.get?.("po_name") || "").trim();

const getFeatureAreaName = (feature, areaGroup) => {
  if (areaGroup === "po") return getFeaturePoName(feature);
  return getFeatureFilialName(feature);
};

const getFeatureHoverName = (feature, hoverGroup) => {
  if (hoverGroup === "po") return getFeaturePoName(feature);
  if (hoverGroup === "none") return "";
  return getFeatureFilialName(feature);
};

const isFeatureInHoverGroup = (feature, hoverGroup, hoverName) => {
  if (!hoverName) return false;
  return getFeatureHoverName(feature, hoverGroup) === hoverName;
};

const getFeatureDistrictLabel = (feature) =>
  String(feature?.get?.("name") || feature?.get?.("district") || "")
    .replace(/\s+городской\s+округ$/i, "")
    .replace(/\s+муниципальный\s+округ$/i, "")
    .replace(/\s+/g, " ")
    .trim();

const wrapMapLabel = (value, compact = false) => {
  const label = String(value || "").trim();
  if (!label) return "";

  const maxLineLength = compact ? 10 : 14;
  if (label.includes("-")) return label.replace(/-/g, "-\n");
  if (label.length <= maxLineLength) return label;

  const lines = [];
  let currentLine = "";
  label.split(" ").forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > maxLineLength && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines.join("\n");
};

const getRowsByFilialName = (rows, filialName) => {
  const normalizedFilialName = normalizeOperationalFilialName(filialName);
  if (!normalizedFilialName) return rows;

  return (Array.isArray(rows) ? rows : []).filter(
    (row) =>
      normalizeOperationalFilialName(
        row?.tn_filialy?.name || row?.tn_filialy?.data?.attributes?.name
      ) === normalizedFilialName
  );
};

const readCachedTnOkrugaRows = () => {
  try {
    const rawRows = window.localStorage.getItem(TN_OKRUGA_MAP_CACHE_KEY);
    const rows = rawRows ? JSON.parse(rawRows) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};

const writeCachedTnOkrugaRows = (rows) => {
  try {
    window.localStorage.setItem(TN_OKRUGA_MAP_CACHE_KEY, JSON.stringify(rows));
  } catch {
    // Кэш карты некритичен: если localStorage недоступен, Strapi/GeoJSON останутся источниками.
  }
};

const normalizeBoundaryPoint = ([x, y]) =>
  `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`;

const getBoundarySegmentKey = (start, end) => {
  const normalizedStart = normalizeBoundaryPoint(start);
  const normalizedEnd = normalizeBoundaryPoint(end);
  return normalizedStart < normalizedEnd
    ? `${normalizedStart}|${normalizedEnd}`
    : `${normalizedEnd}|${normalizedStart}`;
};

const collectGeometryRings = (geometry) => {
  if (!geometry) return [];

  if (geometry.getType() === "Polygon") return geometry.getCoordinates();
  if (geometry.getType() === "MultiPolygon") return geometry.getCoordinates().flat();
  return [];
};

const buildBoundaryFeature = (features, properties = {}) => {
  const segmentMap = new Map();

  features.forEach((feature) => {
    collectGeometryRings(feature.getGeometry()).forEach((ring) => {
      for (let index = 1; index < ring.length; index += 1) {
        const start = ring[index - 1];
        const end = ring[index];
        const key = getBoundarySegmentKey(start, end);
        const current = segmentMap.get(key);
        if (current) {
          current.count += 1;
        } else {
          segmentMap.set(key, {
            count: 1,
            coordinates: [start, end],
          });
        }
      }
    });
  });

  const externalSegments = Array.from(segmentMap.values())
    .filter((item) => item.count === 1)
    .map((item) => item.coordinates);

  if (!externalSegments.length) return null;

  const feature = new Feature({
    geometry: new MultiLineString(externalSegments),
  });
  Object.entries(properties).forEach(([key, value]) => feature.set(key, value));
  return feature;
};

const getBoundaryGroupName = (feature, group) => {
  if (group === "po") return getFeaturePoName(feature);
  return getFeatureFilialName(feature);
};

const buildGroupBoundaryFeatures = (features, group, getProperties) => {
  const groups = new Map();

  features.forEach((feature) => {
    const groupName = getBoundaryGroupName(feature, group);
    if (!groupName) return;

    const key = normalizeOperationalMapAreaName(groupName);
    if (!groups.has(key)) {
      groups.set(key, {
        name: groupName,
        features: [],
      });
    }
    groups.get(key).features.push(feature);
  });

  return Array.from(groups.values())
    .map((item) => buildBoundaryFeature(item.features, getProperties(item.name, item.features)))
    .filter(Boolean);
};

const getDistrictStyle = (
  feature,
  areaDataByKey,
  {
    fillGroup = "filial",
  } = {}
) => {
  const areaName = getFeatureAreaName(feature, fillGroup);
  const areaData = findOperationalMapAreaData(areaDataByKey, areaName);
  const people = areaData?.people || 0;
  const fillColor = people > 0 ? areaData.color : "rgba(255, 255, 255, 0.96)";
  const strokeColor = "#cfd6de";

  return new Style({
    zIndex: 1,
    fill: new Fill({ color: fillColor }),
    stroke: new Stroke({
      color: strokeColor,
      width: OPERATIONAL_MAP_DISTRICT_STROKE_WIDTH,
    }),
  });
};

const getDistrictLabelStyle = (feature, compactLabels = false) => {
  const label = wrapMapLabel(getFeatureDistrictLabel(feature), compactLabels);
  if (!label) return null;

  return new Style({
    zIndex: 50,
    text: new Text({
      text: label,
      overflow: true,
      fill: new Fill({ color: "#1575bc" }),
      stroke: new Stroke({ color: "#ffffff", width: 4 }),
      font: `700 ${compactLabels ? 10 : 12}px Arial, sans-serif`,
    }),
  });
};

const getIsCompactMapViewport = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 768px)").matches;

function OperationalWeatherCard() {
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadWeather = async () => {
      try {
        setError(null);
        const data = await loadOperationalWeather();
        if (cancelled) return;
        setWeather(data);
      } catch (requestError) {
        if (!cancelled) {
          setWeather(null);
          setError(requestError?.message || "Погода недоступна");
        }
      }
    };

    loadWeather();
    const timer = window.setInterval(loadWeather, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (error) {
    return (
      <div className="operational-map-panel__weather operational-map-panel__weather--error">
        <span>Погода недоступна</span>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="operational-map-panel__weather operational-map-panel__weather--loading">
        <span>Погода загружается</span>
      </div>
    );
  }

  const view = getWeatherView(weather.weatherCode);
  const temp = Number(weather.temperature);
  const tempText = Number.isFinite(temp)
    ? `${temp > 0 ? "+" : ""}${Math.round(temp)}°`
    : "—";
  const parts = Array.isArray(weather.parts) ? weather.parts : [];
  const formattedParts = parts.map((part) => {
    const partView = getWeatherView(part.weatherCode);
    const partTemp = Number(part.temperature);
    return {
      ...part,
      icon: partView.icon,
      temperatureText: Number.isFinite(partTemp)
        ? `${partTemp > 0 ? "+" : ""}${Math.round(partTemp)}°`
        : "—",
    };
  });

  return (
    <div className="operational-map-panel__weather" aria-label="Погода">
      <div className="operational-map-panel__weather-content">
        <div className="operational-map-panel__weather-main">
          <span className="operational-map-panel__weather-icon" aria-hidden="true">
            {view.icon}
          </span>
          <div>
            <strong>{tempText}</strong>
            <span>{view.label}</span>
          </div>
        </div>
        <div className="operational-map-panel__weather-parts" aria-label="Прогноз на сутки">
          {formattedParts.map((part) => (
            <span key={part.key} className="operational-map-panel__weather-part">
              <b>{part.label}</b>
              <i aria-hidden="true">{part.icon}</i>
              <em>{part.temperatureText}</em>
            </span>
          ))}
        </div>
      </div>
      <div className="operational-map-panel__weather-details">
        <span>Ветер {formatMapNumber(weather.windSpeed, 1)} м/с</span>
        <span>Давл. {formatPressureMmHg(weather.pressure)} мм рт. ст.</span>
        <span>Влажн. {formatMapNumber(weather.humidity)}%</span>
      </div>
    </div>
  );
}

export function OperationalMapTopline({ className = "" }) {
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(dayjs()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const classNames = [
    "operational-map-panel__topline",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div className={classNames}>
      <div className="operational-map-panel__time">
        <strong>{now.format("DD.MM.YYYY")}</strong>
        <span>{now.format("HH:mm")}</span>
      </div>
      <OperationalWeatherCard />
    </div>
  );
}

export default function OperationalMapPanel({
  filialName = "",
  enableFilialNavigation = true,
  fillGroup = "filial",
  hoverGroup = "filial",
  showDistrictLabels = false,
  showTopline = true,
  showMobileTopline = false,
  variant = "",
}) {
  const navigate = useNavigate();
  const rows = useOperationalDashboardStore((store) => store.rows);
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const districtSourceRef = useRef(null);
  const districtLayerRef = useRef(null);
  const districtLabelLayerRef = useRef(null);
  const modeBoundarySourceRef = useRef(null);
  const [hoveredArea, setHoveredArea] = useState(null);
  const [isCompactViewport, setIsCompactViewport] = useState(getIsCompactMapViewport);
  const panelClassName = [
    "operational-dashboard__panel",
    "operational-dashboard__panel--map",
    "operational-map-panel",
    variant ? `operational-map-panel--${variant}` : "",
  ].filter(Boolean).join(" ");

  const areaData = useMemo(
    () =>
      fillGroup === "po"
        ? buildOperationalMapPoData(rows)
        : buildOperationalMapFilialData(rows),
    [fillGroup, rows]
  );
  const areaDataByKey = useMemo(
    () => new Map(areaData.map((item) => [item.key, item])),
    [areaData]
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleChange = () => setIsCompactViewport(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  useEffect(() => {
    if (!mapElRef.current) return undefined;

    const districtSource = new VectorSource();
    const districtLayer = new VectorLayer({
      source: districtSource,
      style: EMPTY_DISTRICT_STYLE,
      zIndex: 1,
    });
    const filialHoverSource = new VectorSource();
    const filialHoverLayer = new VectorLayer({
      source: filialHoverSource,
      style: FILIAL_HOVER_STYLE,
      zIndex: 30,
    });
    const modeBoundarySource = new VectorSource();
    const modeBoundaryLayer = new VectorLayer({
      source: modeBoundarySource,
      style: MODE_BOUNDARY_STYLE,
      zIndex: 40,
    });
    const districtLabelLayer = new VectorLayer({
      source: districtSource,
      style: null,
      zIndex: 50,
    });
    const view = new View({
      center: fromLonLat(MAP_FALLBACK_CENTER),
      zoom: MAP_FALLBACK_ZOOM,
    });
    const map = new OlMap({
      target: mapElRef.current,
      layers: [districtLayer, filialHoverLayer, modeBoundaryLayer, districtLabelLayer],
      view,
      controls: [],
      interactions: defaultInteractions({
        altShiftDragRotate: false,
        doubleClickZoom: false,
        dragPan: false,
        keyboard: false,
        mouseWheelZoom: false,
        pinchRotate: false,
        pinchZoom: false,
      }),
    });

    mapRef.current = map;
    districtSourceRef.current = districtSource;
    districtLayerRef.current = districtLayer;
    districtLabelLayerRef.current = districtLabelLayer;
    modeBoundarySourceRef.current = modeBoundarySource;

    let cancelled = false;
    const format = new GeoJSON();

    const applyFeatureCollection = (featureCollection, { fit = false } = {}) => {
      if (cancelled || !mapRef.current || !districtSourceRef.current) return;
      const features = format.readFeatures(featureCollection, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });
      districtSourceRef.current.clear();
      districtSourceRef.current.addFeatures(features);
      filialHoverSource.clear();
      modeBoundarySource.clear();
      const modeBoundaryFeatures = buildGroupBoundaryFeatures(
        districtSourceRef.current.getFeatures(),
        "filial",
        (groupName, groupFeatures) => {
          const modeStrokeColor = groupFeatures
            .map((feature) => getModeStrokeColor(feature.get("rezim")))
            .find(Boolean);

          return {
            groupName,
            strokeColor: modeStrokeColor,
          };
        }
      ).filter((feature) => feature.get("strokeColor"));
      modeBoundarySource.addFeatures(modeBoundaryFeatures);
      districtLayerRef.current?.changed();
      districtLabelLayerRef.current?.changed();
      if (fit) fitMapToSource(view, districtSourceRef.current);
    };

    const getDistrictFeatureAtPixel = (pixel) =>
      map.forEachFeatureAtPixel(pixel, (item) => item, {
        layerFilter: (layer) => layer === districtLayer,
      });

    const highlightHoverGroup = (hoverName) => {
      filialHoverSource.clear();
      if (!hoverName) return;

      const nextFeatures = districtSource
        .getFeatures()
        .filter((feature) => isFeatureInHoverGroup(feature, hoverGroup, hoverName));
      const boundaryFeature = buildBoundaryFeature(nextFeatures, { groupName: hoverName });
      if (boundaryFeature) filialHoverSource.addFeature(boundaryFeature);
    };

    const applyDistrictRows = (rows, options) => {
      const filteredRows = getRowsByFilialName(rows, filialName);
      applyFeatureCollection(buildTnOkrugaFeatureCollection(filteredRows), options);
    };

    const loadFallbackFeatures = async () => {
      try {
        if (filialName) return;
        if (districtSourceRef.current?.getFeatures().length) return;
        const response = await fetch(OPERATIONAL_MAP_FALLBACK_GEOJSON_URL);
        if (!response.ok) return;
        const featureCollection = await response.json();
        if (districtSourceRef.current?.getFeatures().length) return;
        applyFeatureCollection(featureCollection, { fit: true });
      } catch {
        // Локальный fallback не должен ломать загрузку дашборда.
      }
    };

    const loadDistrictFeatures = async ({ fit = false } = {}) => {
      try {
        const rows = await fetchTnOkrugaRows();
        if (cancelled || !mapRef.current || !districtSourceRef.current) return;
        writeCachedTnOkrugaRows(rows);
        applyDistrictRows(rows, { fit });
      } catch {
        // Если Strapi временно недоступен, оставляем текущую карту на экране.
      }
    };

    const cachedRows = readCachedTnOkrugaRows();
    if (cachedRows.length) {
      applyDistrictRows(cachedRows, { fit: true });
    }
    loadFallbackFeatures();
    loadDistrictFeatures({ fit: !cachedRows.length });
    const handleFilialModeUpdated = () => loadDistrictFeatures();
    const handleFilialModeStorageUpdated = (event) => {
      if (event.key === TN_FILIALY_REZIM_UPDATED_STORAGE_KEY) {
        loadDistrictFeatures();
      }
    };
    window.addEventListener(TN_FILIALY_REZIM_UPDATED_EVENT, handleFilialModeUpdated);
    window.addEventListener("storage", handleFilialModeStorageUpdated);

    const handlePointerMove = (event) => {
      const feature = getDistrictFeatureAtPixel(event.pixel);
      const hoverName = getFeatureHoverName(feature, hoverGroup);

      if (!feature || !hoverName) {
        map.getTargetElement().style.cursor = "";
        highlightHoverGroup("");
        setHoveredArea(null);
        return;
      }

      map.getTargetElement().style.cursor = enableFilialNavigation ? "pointer" : "";
      highlightHoverGroup(hoverName);
      const rect = map.getTargetElement().getBoundingClientRect();
      setHoveredArea({
        name: hoverName,
        x: event.originalEvent.clientX - rect.left,
        y: event.originalEvent.clientY - rect.top,
      });
    };

    const handlePointerLeave = () => {
      map.getTargetElement().style.cursor = "";
      highlightHoverGroup("");
      setHoveredArea(null);
    };

    const handleSingleClick = (event) => {
      if (!enableFilialNavigation) return;

      const feature = getDistrictFeatureAtPixel(event.pixel);
      const filialPath = getOperationalFilialPath(getFeatureFilialName(feature));
      if (filialPath) navigate(filialPath);
    };

    map.on("pointermove", handlePointerMove);
    map.on("singleclick", handleSingleClick);
    map.getTargetElement().addEventListener("pointerleave", handlePointerLeave);

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        map.updateSize();
        fitMapToSource(view, districtSource);
      });
    });
    resizeObserver.observe(mapElRef.current);
    window.requestAnimationFrame(() => {
      map.updateSize();
    });

    return () => {
      cancelled = true;
      window.removeEventListener(TN_FILIALY_REZIM_UPDATED_EVENT, handleFilialModeUpdated);
      window.removeEventListener("storage", handleFilialModeStorageUpdated);
      map.un("pointermove", handlePointerMove);
      map.un("singleclick", handleSingleClick);
      map.getTargetElement().removeEventListener("pointerleave", handlePointerLeave);
      resizeObserver.disconnect();
      map.setTarget(null);
      mapRef.current = null;
      districtSourceRef.current = null;
      districtLayerRef.current = null;
      districtLabelLayerRef.current = null;
      modeBoundarySourceRef.current = null;
    };
  }, [enableFilialNavigation, filialName, hoverGroup, navigate]);

  useEffect(() => {
    const layer = districtLayerRef.current;
    const labelLayer = districtLabelLayerRef.current;
    if (!layer) return;

    layer.setStyle((feature) =>
      getDistrictStyle(feature, areaDataByKey, {
        fillGroup,
        showDistrictLabels,
      })
    );
    layer.changed();

    if (labelLayer) {
      labelLayer.setStyle(
        showDistrictLabels
          ? (feature) => getDistrictLabelStyle(feature, isCompactViewport)
          : null
      );
      labelLayer.changed();
    }
  }, [areaDataByKey, fillGroup, isCompactViewport, showDistrictLabels]);

  useEffect(() => {
    const map = mapRef.current;
    const source = districtSourceRef.current;
    const view = map?.getView?.();
    if (!map || !source || !view) return;

    window.requestAnimationFrame(() => {
      map.updateSize();
      fitMapToSource(view, source);
    });
  }, [OPERATIONAL_MAP_SCALE]);

  return (
    <div className={panelClassName}>
      <div className="operational-dashboard__panel-body">
        <div className="operational-map-panel__surface">
          {showTopline ? <OperationalMapTopline /> : null}
          {showMobileTopline ? (
            <OperationalMapTopline className="operational-map-panel__topline--mobile" />
          ) : null}
          <div className="operational-map-panel__map-frame">
            <div
              ref={mapElRef}
              className="operational-map-panel__map"
              style={{
                transform: `translateY(${OPERATIONAL_MAP_OFFSET_Y}px) scaleY(${OPERATIONAL_MAP_STRETCH_Y})`,
                transformOrigin: "center center",
              }}
              aria-label="Карта оперативной обстановки"
            />
            {hoveredArea ? (
              <div
                className="operational-map-panel__filial-tooltip"
                style={{
                  left: hoveredArea.x,
                  top: hoveredArea.y,
                }}
              >
                {hoveredArea.name}
              </div>
            ) : null}
          </div>
          <div className="operational-map-panel__mode-legend">
            <h4>Действующие режимы:</h4>
            <span>
              <i style={{ borderColor: OPERATIONAL_MAP_MODE_STROKE_COLORS.rpg }} />
              - введен РПГ
            </span>
            <span>
              <i style={{ borderColor: OPERATIONAL_MAP_MODE_STROKE_COLORS.orr }} />
              - введен ОРР
            </span>
          </div>
          <div className="operational-map-panel__legend">
            <div>
              <h4>Обесточено населения:</h4>
              <span>
                <i style={{ background: OPERATIONAL_MAP_COLORS.low }} />
                - до 5000 чел.
              </span>
              <span>
                <i style={{ background: OPERATIONAL_MAP_COLORS.medium }} />
                - от 5000 до 20000 чел.
              </span>
              <span>
                <i style={{ background: OPERATIONAL_MAP_COLORS.high }} />
                - более 20000 чел.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
