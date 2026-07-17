import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import OlMap from "ol/Map";
import View from "ol/View";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
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
  OPERATIONAL_MAP_ACTIVE_DISTRICT_STROKE_WIDTH,
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
  TN_FILIALY_REZIM_UPDATED_EVENT,
  TN_FILIALY_REZIM_UPDATED_STORAGE_KEY,
} from "../../../../../utils/tnFilialyApi";
import {
  buildOperationalMapBranchData,
  formatMapNumber,
  getBranchByDistrictName,
  getWeatherView,
} from "../js/operationalMapPanel.utils";
import "../css/OperationalMapPanel.css";

const SERVICES_URL =
  import.meta.env.VITE_URL_BACKEND_SERVICES ||
  import.meta.env.VITE_URL_BACKEND;
const BACKEND_URL = import.meta.env.VITE_URL_BACKEND;
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

const normalizeWeatherPayload = (payload) => {
  const current = payload?.current || {};
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
    weatherCode: payload?.weatherCode ?? current.weather_code,
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
        "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,cloud_cover,precipitation,weather_code",
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

const getDistrictStyle = (feature, branchDataByBranch) => {
  const districtName = feature.get("district");
  const modeStrokeColor = getModeStrokeColor(feature.get("rezim"));
  const branch = getBranchByDistrictName(districtName);
  const branchData = branch ? branchDataByBranch.get(branch) : null;
  const people = branchData?.people || 0;
  const fillColor = people > 0 ? branchData.color : "rgba(255, 255, 255, 0.96)";
  const strokeColor = modeStrokeColor || (people > 0 ? "#ffffff" : "#cfd6de");
  const label = people > 0 ? `${branch}\n${formatMapNumber(people)}` : "";

  return new Style({
    zIndex: modeStrokeColor ? 10 : 1,
    fill: new Fill({ color: fillColor }),
    stroke: new Stroke({
      color: strokeColor,
      width: modeStrokeColor
        ? OPERATIONAL_MAP_MODE_STROKE_WIDTH
        : people > 0
          ? OPERATIONAL_MAP_ACTIVE_DISTRICT_STROKE_WIDTH
          : OPERATIONAL_MAP_DISTRICT_STROKE_WIDTH,
    }),
    text: new Text({
      text: label,
      overflow: false,
      fill: new Fill({ color: "#1575bc" }),
      stroke: new Stroke({ color: "#ffffff", width: 3 }),
      font: "600 10px Arial, sans-serif",
    }),
  });
};

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

  return (
    <div className="operational-map-panel__weather" aria-label="Погода">
      <div className="operational-map-panel__weather-main">
        <span className="operational-map-panel__weather-icon" aria-hidden="true">
          {view.icon}
        </span>
        <div>
          <strong>{tempText}</strong>
          <span>{view.label}</span>
        </div>
      </div>
      <div className="operational-map-panel__weather-details">
        <span>Ветер {formatMapNumber(weather.windSpeed, 1)} м/с</span>
        <span>Влажн. {formatMapNumber(weather.humidity)}%</span>
        <span>Осадки {formatMapNumber(weather.precipitation, 1)} мм</span>
      </div>
    </div>
  );
}

export default function OperationalMapPanel() {
  const rows = useOperationalDashboardStore((store) => store.rows);
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const districtSourceRef = useRef(null);
  const districtLayerRef = useRef(null);
  const [now, setNow] = useState(() => dayjs());

  const branchData = useMemo(() => buildOperationalMapBranchData(rows), [rows]);
  const branchDataByBranch = useMemo(
    () => new Map(branchData.map((item) => [item.branch, item])),
    [branchData]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(dayjs()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mapElRef.current) return undefined;

    const districtSource = new VectorSource();
    const districtLayer = new VectorLayer({
      source: districtSource,
      style: EMPTY_DISTRICT_STYLE,
      zIndex: 1,
    });
    const view = new View({
      center: fromLonLat(MAP_FALLBACK_CENTER),
      zoom: MAP_FALLBACK_ZOOM,
    });
    const map = new OlMap({
      target: mapElRef.current,
      layers: [districtLayer],
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
      districtLayerRef.current?.changed();
      if (fit) fitMapToSource(view, districtSourceRef.current);
    };

    const applyDistrictRows = (rows, options) => {
      applyFeatureCollection(buildTnOkrugaFeatureCollection(rows), options);
    };

    const loadFallbackFeatures = async () => {
      try {
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
      resizeObserver.disconnect();
      map.setTarget(null);
      mapRef.current = null;
      districtSourceRef.current = null;
      districtLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = districtLayerRef.current;
    if (!layer) return;

    layer.setStyle((feature) => getDistrictStyle(feature, branchDataByBranch));
    layer.changed();
  }, [branchDataByBranch]);

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
    <div className="operational-dashboard__panel operational-dashboard__panel--map operational-map-panel">
      <div className="operational-dashboard__panel-body">
        <div className="operational-map-panel__surface">
          <div className="operational-map-panel__topline">
            <div className="operational-map-panel__time">
              <strong>{now.format("DD.MM.YYYY")}</strong>
              <span>{now.format("HH:mm")}</span>
            </div>
            <OperationalWeatherCard />
          </div>
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
                до 5000 чел.
              </span>
              <span>
                <i style={{ background: OPERATIONAL_MAP_COLORS.medium }} />
                от 5000 до 20000 чел.
              </span>
              <span>
                <i style={{ background: OPERATIONAL_MAP_COLORS.high }} />
                более 20000 чел.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
