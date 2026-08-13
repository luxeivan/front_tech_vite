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
import Point from "ol/geom/Point";
import { fromLonLat } from "ol/proj";
import { defaults as defaultInteractions } from "ol/interaction/defaults";
import Style from "ol/style/Style";
import Fill from "ol/style/Fill";
import Icon from "ol/style/Icon";
import Stroke from "ol/style/Stroke";
import Text from "ol/style/Text";
import GeoJSON from "ol/format/GeoJSON";
import "ol/ol.css";

import pesKamazVectorSvgRaw from "../../../../../assets/pes-kamaz-vector.svg?raw";
import useOperationalDashboardStore from "../../../../../stores/operationalDashboard/useOperationalDashboardStore";
import usePesModuleDataStore from "../../../../../stores/pes/usePesModuleDataStore";
import useAuth from "../../../../../stores/useAuth";
import {
  PES_STATUS_LEGEND,
  pesIconDataUrl,
} from "../../../../dashboard/js/pesLayer";
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
} from "../../../../../utils/tnOkrugaApi";
import {
  getOperationalFilialPathForBase,
  getOperationalPoPath,
  getOperationalPoSlug,
  normalizeOperationalFilialName,
} from "../../../../../utils/operationalFilialRoutes";
import {
  buildTnFilialyTopologyOkrugaRows,
  fetchTnFilialyModeRows,
  fetchTnFilialyRows,
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
import { normalizeBranchName } from "../../districts/js/operationalDistrictsPanel.utils";
import { formatPowerKw } from "../../../../pes/js/pesModuleMeta";
import { sortPesNumber } from "../../../../pes/js/pesTilesBoard.utils";
import "../css/OperationalMapPanel.css";

const SERVICES_URL =
  import.meta.env.VITE_URL_BACKEND_SERVICES ||
  import.meta.env.VITE_URL_BACKEND;
const BACKEND_URL = import.meta.env.VITE_URL_BACKEND;
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const FILIAL_MODE_POLL_MS = 5000;

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
      width: feature.get("strokeWidth") || OPERATIONAL_MAP_MODE_STROKE_WIDTH,
    }),
  });
const MAP_FALLBACK_CENTER = [38.25, 55.58];
const MAP_FALLBACK_ZOOM = 8;
const MAP_FIT_PADDING = [10, 6, 8, 6];
const TN_OKRUGA_MAP_CACHE_KEY = "operationalDashboard.tnFilialyTopologyRows.legacy.v2";
const PES_MARKER_AREA_POINTS = [
  [-0.24, -0.16],
  [0.24, 0.16],
  [-0.18, 0.24],
  [0.18, -0.24],
  [-0.34, 0.04],
  [0.34, -0.04],
  [-0.06, -0.34],
  [0.06, 0.34],
  [-0.34, -0.26],
  [0.34, 0.26],
  [-0.28, 0.32],
  [0.28, -0.32],
];
const PES_MARKER_FALLBACK_OFFSETS = [
  [0, -5400],
  [5400, 0],
  [-5400, 0],
  [0, 5400],
  [7800, -3600],
  [-7800, 3600],
  [3600, 7800],
  [-3600, -7800],
];
const PES_MARKER_ACTIVE_STATUSES = new Set([
  "command_sent",
  "delay",
  "en_route",
  "connected",
]);
const PES_MARKER_ICON_BY_STATUS = Object.fromEntries(
  PES_STATUS_LEGEND.map((item) => [
    item.status,
    pesIconDataUrl(item.color, {
      svgRaw: pesKamazVectorSvgRaw,
      recolorAllFills: true,
    }),
  ])
);
const PES_MARKER_STYLE_CACHE = new Map();
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

const toFeatureNameList = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  const name = String(value || "").trim();
  return name ? [name] : [];
};

const getFeatureFilialNames = (feature) => {
  const names = toFeatureNameList(feature?.get?.("filial_names"));
  return names.length ? names : toFeatureNameList(feature?.get?.("filial_name"));
};

const getFeaturePoNames = (feature) => {
  const visibleNames = feature?.get?.("visible_po_names");
  if (Array.isArray(visibleNames)) return toFeatureNameList(visibleNames);

  const names = toFeatureNameList(feature?.get?.("po_names"));
  return names.length ? names : toFeatureNameList(feature?.get?.("po_name"));
};

const getFeatureFilialName = (feature) => getFeatureFilialNames(feature)[0] || "";

const getFeaturePoName = (feature) =>
  String(feature?.get?.("primary_po_name") || "").trim() || getFeaturePoNames(feature)[0] || "";

const getFeatureAreaName = (feature, areaGroup) => {
  if (areaGroup === "po") return getFeaturePoName(feature);
  return getFeatureFilialName(feature);
};

const getFeaturePoRelations = (feature) => {
  const relations = feature?.get?.("po_relations");
  return Array.isArray(relations) ? relations : [];
};

const assignVisiblePoNames = (features, activeFilialName) => {
  const normalizedFilialName = normalizeOperationalFilialName(activeFilialName);

  features.forEach((feature) => {
    if (!normalizedFilialName) {
      feature.set("visible_po_names", getFeaturePoNames(feature));
      return;
    }

    const visiblePoNames = getFeaturePoRelations(feature)
      .filter(
        (relation) =>
          normalizeOperationalFilialName(relation?.filial_name) === normalizedFilialName
      )
      .map((relation) => relation?.name)
      .filter(Boolean);

    feature.set("visible_po_names", [...new Set(visiblePoNames)]);
  });
};

const getFeatureLabelName = (feature, labelGroup) => {
  const areaLabel = String(feature?.get?.("area_label") || "").trim();
  if (areaLabel) return areaLabel;
  if (labelGroup === "po") return "";
  return getFeatureDistrictLabel(feature);
};

const getFeatureHoverName = (feature, hoverGroup) => {
  if (hoverGroup === "po") return getFeaturePoName(feature);
  if (hoverGroup === "none") return "";
  return getFeatureFilialName(feature);
};

const getFeatureHoverLabel = (feature, hoverGroup) => {
  if (hoverGroup === "po") return getFeaturePoNames(feature).join("\n");
  return getFeatureHoverName(feature, hoverGroup);
};

const getPoNameAtPixel = (
  map,
  feature,
  pixel,
  compactLabels = false,
  isWallDisplay = false
) => {
  const poNames = getFeaturePoNames(feature);
  if (poNames.length <= 1) return poNames[0] || "";

  const anchor = getGeometryAnchorCoordinate(feature?.getGeometry?.());
  if (!anchor || !Array.isArray(pixel)) return getFeaturePoName(feature);

  const anchorPixel = map?.getPixelFromCoordinate?.(anchor);
  if (!Array.isArray(anchorPixel)) return getFeaturePoName(feature);

  const offsets = getPoLabelOffsets(poNames.length, compactLabels, isWallDisplay);
  return poNames
    .map((poName, index) => {
      const [offsetX, offsetY] = offsets[index] || [0, 0];
      const labelPixel = [anchorPixel[0] + offsetX, anchorPixel[1] + offsetY];
      return {
        poName,
        distance: Math.hypot(pixel[0] - labelPixel[0], pixel[1] - labelPixel[1]),
      };
    })
    .sort((left, right) => left.distance - right.distance)[0]?.poName || getFeaturePoName(feature);
};

const getFeatureHoverNames = (feature, hoverGroup) => {
  if (hoverGroup === "po") return getFeaturePoNames(feature);
  if (hoverGroup === "none") return [];
  return getFeatureFilialNames(feature);
};

const normalizePesFilialName = (value) =>
  normalizeOperationalMapAreaName(normalizeBranchName(value));

const isActivePesMarkerItem = (item) =>
  PES_MARKER_ACTIVE_STATUSES.has(
    String(item?.effectiveStatus || item?.status || "")
      .trim()
      .toLowerCase()
  );

const isFeatureInHoverGroup = (feature, hoverGroup, hoverName) => {
  if (!hoverName) return false;
  const normalizedHoverName = normalizeOperationalMapAreaName(hoverName);
  return getFeatureHoverNames(feature, hoverGroup).some(
    (featureHoverName) =>
      featureHoverName === hoverName ||
      normalizeOperationalMapAreaName(featureHoverName) === normalizedHoverName
  );
};

const applyHoverBoundary = (hoverSource, districtSource, hoverGroup, hoverName) => {
  hoverSource?.clear();
  if (!hoverSource || !districtSource || !hoverName) return;

  const nextFeatures = districtSource
    .getFeatures()
    .filter((feature) => isFeatureInHoverGroup(feature, hoverGroup, hoverName));
  const boundaryFeature = buildBoundaryFeature(nextFeatures, { groupName: hoverName });
  if (boundaryFeature) hoverSource.addFeature(boundaryFeature);
};

const getFeatureDistrictLabel = (feature) =>
  String(feature?.get?.("name") || feature?.get?.("district") || "")
    .replace(/\s+городской\s+округ$/i, "")
    .replace(/\s+муниципальный\s+округ$/i, "")
    .replace(/\s+/g, " ")
    .trim();

const getGeometryAnchorCoordinate = (geometry) => {
  if (!geometry) return null;

  if (geometry.getType() === "Polygon" && typeof geometry.getInteriorPoint === "function") {
    return geometry.getInteriorPoint().getCoordinates();
  }

  if (geometry.getType() === "MultiPolygon" && typeof geometry.getInteriorPoints === "function") {
    const points = geometry.getInteriorPoints().getCoordinates();
    if (Array.isArray(points) && points.length) {
      const extent = geometry.getExtent();
      const centerX = (extent[0] + extent[2]) / 2;
      const centerY = (extent[1] + extent[3]) / 2;
      return points
        .map((point) => ({
          point,
          distance: Math.hypot(point[0] - centerX, point[1] - centerY),
        }))
        .sort((a, b) => a.distance - b.distance)[0].point;
    }
  }

  const extent = geometry.getExtent?.();
  if (Array.isArray(extent) && extent.every(Number.isFinite)) {
    return [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
  }

  return null;
};

const getFeatureExtentArea = (feature) => {
  const extent = feature?.getGeometry?.()?.getExtent?.();
  if (!Array.isArray(extent) || !extent.every(Number.isFinite)) return 0;
  return Math.max(0, extent[2] - extent[0]) * Math.max(0, extent[3] - extent[1]);
};

const getCombinedFeatureGeometry = (features) => {
  const list = (Array.isArray(features) ? features : []).filter((feature) => feature?.getGeometry?.());
  if (!list.length) return null;
  if (list.length === 1) return list[0].getGeometry();

  const extent = [Infinity, Infinity, -Infinity, -Infinity];
  list.forEach((feature) => {
    const featureExtent = feature.getGeometry().getExtent?.();
    if (!Array.isArray(featureExtent) || !featureExtent.every(Number.isFinite)) return;
    extent[0] = Math.min(extent[0], featureExtent[0]);
    extent[1] = Math.min(extent[1], featureExtent[1]);
    extent[2] = Math.max(extent[2], featureExtent[2]);
    extent[3] = Math.max(extent[3], featureExtent[3]);
  });

  if (!extent.every(Number.isFinite)) return list[0].getGeometry();

  return {
    getExtent: () => extent,
    intersectsCoordinate: (coordinate) =>
      list.some((feature) => feature.getGeometry()?.intersectsCoordinate?.(coordinate)),
  };
};

const isCoordinateInsideGeometry = (geometry, coordinate) => {
  if (!geometry || !Array.isArray(coordinate)) return false;
  if (typeof geometry.intersectsCoordinate === "function") {
    return geometry.intersectsCoordinate(coordinate);
  }
  return true;
};

const pushUniquePesCoordinate = (coordinates, geometry, coordinate, minDistance) => {
  if (!isCoordinateInsideGeometry(geometry, coordinate)) return;
  const hasNearPoint = coordinates.some(
    (point) => Math.hypot(point[0] - coordinate[0], point[1] - coordinate[1]) < minDistance
  );
  if (!hasNearPoint) coordinates.push(coordinate);
};

const getPesFallbackCoordinate = (center, index, compact = false) => {
  const [x, y] = PES_MARKER_FALLBACK_OFFSETS[index % PES_MARKER_FALLBACK_OFFSETS.length];
  const ring = Math.floor(index / PES_MARKER_FALLBACK_OFFSETS.length);
  const multiplier = compact ? 0.7 : 1;
  return [
    center[0] + (x + ring * 2200) * multiplier,
    center[1] + (y + ring * 2200) * multiplier,
  ];
};

const getPesMarkerCoordinates = (geometry, count, compact = false, fallbackCoordinate = null) => {
  const center = getGeometryAnchorCoordinate(geometry) || fallbackCoordinate;
  if (!center || !Number.isFinite(count) || count <= 0) return [];

  const extent = geometry?.getExtent?.();
  if (!Array.isArray(extent) || !extent.every(Number.isFinite)) {
    return Array.from({ length: count }, (_, index) =>
      getPesFallbackCoordinate(center, index, compact)
    );
  }

  const extentWidth = extent[2] - extent[0];
  const extentHeight = extent[3] - extent[1];
  const spreadWidth = Math.max(extentWidth, compact ? 8000 : 12000);
  const spreadHeight = Math.max(extentHeight, compact ? 8000 : 12000);
  const minDistance = Math.min(spreadWidth, spreadHeight) * (compact ? 0.1 : 0.12);
  const coordinates = [];

  PES_MARKER_AREA_POINTS.forEach(([xRatio, yRatio]) => {
    if (coordinates.length >= count) return;
    pushUniquePesCoordinate(
      coordinates,
      geometry,
      [center[0] + spreadWidth * xRatio, center[1] + spreadHeight * yRatio],
      minDistance
    );
  });

  const columns = Math.ceil(Math.sqrt(count * 2));
  const rows = columns;
  for (let row = 1; row <= rows && coordinates.length < count; row += 1) {
    for (let column = 1; column <= columns && coordinates.length < count; column += 1) {
      const coordinate = [
        extent[0] + (extentWidth * column) / (columns + 1),
        extent[1] + (extentHeight * row) / (rows + 1),
      ];
      pushUniquePesCoordinate(coordinates, geometry, coordinate, minDistance * 0.85);
    }
  }

  while (coordinates.length < count) {
    coordinates.push(getPesFallbackCoordinate(center, coordinates.length, compact));
  }

  return coordinates;
};

const findPesAnchorArea = (districtFeatures, item) => {
  const districtKey = normalizeOperationalMapAreaName(item?.district);
  if (districtKey) {
    const districtFeature = districtFeatures.find((feature) => {
      const featureKey = normalizeOperationalMapAreaName(getFeatureDistrictLabel(feature));
      return (
        featureKey === districtKey ||
        featureKey.includes(districtKey) ||
        districtKey.includes(featureKey)
      );
    });
    if (districtFeature) {
      const geometry = districtFeature.getGeometry?.();
      return {
        key:
          districtFeature.getId?.() ||
          normalizeOperationalMapAreaName(getFeatureDistrictLabel(districtFeature)),
        coordinate: getGeometryAnchorCoordinate(geometry),
        geometry,
      };
    }
  }

  const poKey = normalizeOperationalMapAreaName(item?.po);
  if (!poKey) return null;
  const poFeatures = districtFeatures.filter((feature) => {
    const featurePoKey = normalizeOperationalMapAreaName(getFeaturePoName(feature));
    return (
      featurePoKey &&
      (featurePoKey === poKey || featurePoKey.includes(poKey) || poKey.includes(featurePoKey))
    );
  });
  if (!poFeatures.length) return null;

  const geometry = getCombinedFeatureGeometry(poFeatures);
  const biggestFeature = [...poFeatures].sort((a, b) => getFeatureExtentArea(b) - getFeatureExtentArea(a))[0];
  return {
    key: poKey,
    coordinate: getGeometryAnchorCoordinate(biggestFeature?.getGeometry?.()) || getGeometryAnchorCoordinate(geometry),
    geometry,
  };
};

const getPesMarkerStyle = (feature) => {
  const compact = Boolean(feature.get("compact"));
  const status = String(feature.get("status") || "ready");
  const priority = Boolean(feature.get("priority"));
  const key = `${compact ? "compact" : "default"}:${status}:${priority ? "priority" : "regular"}`;
  if (PES_MARKER_STYLE_CACHE.has(key)) return PES_MARKER_STYLE_CACHE.get(key);

  const scale = compact ? 0.036 : 0.048;
  const style = new Style({
    image: new Icon({
      src: PES_MARKER_ICON_BY_STATUS[status] || PES_MARKER_ICON_BY_STATUS.ready,
      scale,
      anchor: [0.5, 0.5],
    }),
    zIndex: priority ? 48 : 46,
  });
  PES_MARKER_STYLE_CACHE.set(key, style);
  return style;
};

const buildPesMarkerFeatures = ({ items, districtFeatures, compact }) => {
  const groupedItems = new Map();
  const fallbackGeometry = districtFeatures[0]?.getGeometry?.();
  const fallbackCoordinate = getGeometryAnchorCoordinate(fallbackGeometry);

  (Array.isArray(items) ? items : []).forEach((item) => {
    const anchorArea = findPesAnchorArea(districtFeatures, item);
    const anchorCoordinate = anchorArea?.coordinate || fallbackCoordinate;
    if (!anchorCoordinate) return;

    const anchorKey = anchorArea?.key || normalizeOperationalMapAreaName(item?.po) || "fallback";

    if (!groupedItems.has(anchorKey)) {
      groupedItems.set(anchorKey, {
        coordinate: anchorCoordinate,
        geometry: anchorArea?.geometry || fallbackGeometry,
        items: [],
      });
    }
    groupedItems.get(anchorKey).items.push(item);
  });

  const features = [];
  groupedItems.forEach(({ coordinate, geometry, items: groupItems }) => {
    const sortedItems = [...groupItems].sort(sortPesNumber);
    const markerCoordinates = getPesMarkerCoordinates(
      geometry,
      sortedItems.length,
      compact,
      coordinate
    );

    sortedItems.forEach((item, index) => {
      const feature = new Feature({
        geometry: new Point(markerCoordinates[index] || coordinate),
      });
      feature.set("number", item.number || "");
      feature.set("po", item.po || "");
      feature.set("powerKw", formatPowerKw(item.powerKw));
      feature.set("status", item.effectiveStatus || item.status || "ready");
      feature.set("priority", Boolean(item.prioritet));
      feature.set("compact", compact);
      features.push(feature);
    });
  });

  return features;
};

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

const getPoLabelOffsets = (count, compactLabels = false, isWallDisplay = false) => {
  if (count <= 1) return [[0, 0]];

  const baseX = isWallDisplay ? 56 : compactLabels ? 22 : 34;
  const baseY = isWallDisplay ? 44 : compactLabels ? 18 : 28;
  const center = (count - 1) / 2;

  return Array.from({ length: count }, (_, index) => {
    const row = index - center;
    const side = index % 2 === 0 ? -1 : 1;
    return [side * baseX * Math.ceil((index + 1) / 2), row * baseY];
  });
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

const getBoundaryGroupNames = (feature, group) => {
  if (group === "po") return getFeaturePoNames(feature);
  return getFeatureFilialNames(feature);
};

const buildGroupBoundaryFeatures = (features, group, getProperties) => {
  const groups = new Map();

  features.forEach((feature) => {
    getBoundaryGroupNames(feature, group).forEach((groupName) => {
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
  });

  return Array.from(groups.values())
    .map((item) => buildBoundaryFeature(item.features, getProperties(item.name, item.features)))
    .filter(Boolean);
};

const assignAreaLabels = (features, labelGroup) => {
  features.forEach((feature) => {
    feature.set("area_label", "");
    feature.set("primary_po_name", "");
  });
  if (labelGroup !== "po") return;

  const groups = new Map();
  features.forEach((feature) => {
    const areaNames =
      labelGroup === "po" ? getFeaturePoNames(feature) : [getFeatureAreaName(feature, labelGroup)];
    areaNames.forEach((areaName) => {
      const areaKey = normalizeOperationalMapAreaName(areaName);
      if (!areaKey) return;

      if (!groups.has(areaKey)) {
        groups.set(areaKey, {
          name: areaName,
          features: [],
        });
      }
      groups.get(areaKey).features.push(feature);
    });
  });

  const usedLabelFeatures = new Set();
  Array.from(groups.values())
    .sort((left, right) => left.features.length - right.features.length)
    .forEach((group) => {
      const labelFeature = [...group.features].sort(
        (left, right) => {
          const leftUsed = usedLabelFeatures.has(left) ? 1 : 0;
          const rightUsed = usedLabelFeatures.has(right) ? 1 : 0;
          if (leftUsed !== rightUsed) return leftUsed - rightUsed;
          return getFeatureExtentArea(right) - getFeatureExtentArea(left);
        }
      )[0];
      if (!labelFeature) return;
      usedLabelFeatures.add(labelFeature);
      const currentLabel = String(labelFeature.get("area_label") || "").trim();
      labelFeature.set("area_label", currentLabel ? `${currentLabel}\n${group.name}` : group.name);
      if (!String(labelFeature.get("primary_po_name") || "").trim()) {
        labelFeature.set("primary_po_name", group.name);
      }
    });
};

const getDistrictStyle = (
  feature,
  areaDataByKey,
  {
    districtDetailMode = false,
    fillGroup = "filial",
    isWallDisplay = false,
  } = {}
) => {
  const areaName = getFeatureAreaName(feature, fillGroup);
  const areaData = findOperationalMapAreaData(areaDataByKey, areaName);
  const people = areaData?.people || 0;
  const fillColor = people > 0 ? areaData.color : "rgba(255, 255, 255, 0.96)";
  const strokeColor = districtDetailMode
    ? "#7faad0"
    : fillGroup === "po"
      ? "rgba(207, 214, 222, 0)"
      : "#cfd6de";

  return new Style({
    zIndex: 1,
    fill: new Fill({ color: fillColor }),
    stroke: new Stroke({
      color: strokeColor,
      width: isWallDisplay
        ? districtDetailMode
          ? 3.4
          : OPERATIONAL_MAP_DISTRICT_STROKE_WIDTH * 1.8
        : districtDetailMode
          ? 1.8
          : OPERATIONAL_MAP_DISTRICT_STROKE_WIDTH,
    }),
  });
};

const getDistrictLabelStyle = (
  feature,
  compactLabels = false,
  labelGroup = "district",
  districtDetailMode = false,
  isWallDisplay = false
) => {
  if (labelGroup === "po") {
    const poNames = getFeaturePoNames(feature);
    const offsets = getPoLabelOffsets(poNames.length, compactLabels, isWallDisplay);
    const fontSize = isWallDisplay ? 18 : compactLabels ? 10 : 11;

    return poNames
      .map((poName, index) => {
        const label = wrapMapLabel(poName, true);
        if (!label) return null;
        const [offsetX, offsetY] = offsets[index] || [0, 0];

        return new Style({
          zIndex: districtDetailMode ? 70 : 50,
          text: new Text({
            text: label,
            offsetX,
            offsetY,
            overflow: true,
            padding: [2, 4, 2, 4],
            fill: new Fill({ color: "#1575bc" }),
            stroke: new Stroke({ color: "#ffffff", width: isWallDisplay ? 7 : 3 }),
            font: `700 ${fontSize}px Arial, sans-serif`,
          }),
        });
      })
      .filter(Boolean);
  }

  const label = wrapMapLabel(getFeatureLabelName(feature, labelGroup), compactLabels);
  if (!label) return null;

  const fontSize = isWallDisplay
    ? compactLabels
      ? 18
      : 22
    : compactLabels
      ? 10
      : 12;

  return new Style({
    zIndex: districtDetailMode ? 70 : 50,
    text: new Text({
      text: label,
      overflow: true,
      padding: [3, 5, 3, 5],
      fill: new Fill({ color: "#1575bc" }),
      stroke: new Stroke({ color: "#ffffff", width: isWallDisplay ? 7 : 4 }),
      font: `700 ${fontSize}px Arial, sans-serif`,
    }),
  });
};

const getIsCompactMapViewport = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 768px)").matches;

const getIsWallDisplayMapViewport = () =>
  typeof window !== "undefined" &&
  window.innerWidth === 3840 &&
  window.innerHeight === 2160;

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
  basePath = "/dashboard-oo",
  filialName = "",
  poName = "",
  poSlug = "",
  enableFilialNavigation = true,
  externalHoverName = "",
  fillGroup = "filial",
  hoverGroup = "filial",
  districtDetailMode = false,
  showDistrictLabels = false,
  showPesMarkers = false,
  showTopline = true,
  showMobileTopline = false,
  variant = "",
}) {
  const navigate = useNavigate();
  const user = useAuth((store) => store.user);
  const rows = useOperationalDashboardStore((store) => store.rows);
  const pesItems = usePesModuleDataStore((store) => store.items);
  const loadPesItems = usePesModuleDataStore((store) => store.loadItems);
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const districtSourceRef = useRef(null);
  const districtLayerRef = useRef(null);
  const districtLabelLayerRef = useRef(null);
  const filialHoverSourceRef = useRef(null);
  const externalHoverNameRef = useRef("");
  const modeBoundarySourceRef = useRef(null);
  const pesMarkerSourceRef = useRef(null);
  const pesMarkerLayerRef = useRef(null);
  const [mapFeaturesVersion, setMapFeaturesVersion] = useState(0);
  const [hoveredArea, setHoveredArea] = useState(null);
  const [isCompactViewport, setIsCompactViewport] = useState(getIsCompactMapViewport);
  const [isWallDisplayViewport, setIsWallDisplayViewport] = useState(getIsWallDisplayMapViewport);
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
  const filialPesItems = useMemo(() => {
    if (!showPesMarkers || !filialName) return [];
    const normalizedFilialName = normalizePesFilialName(filialName);
    return (Array.isArray(pesItems) ? pesItems : []).filter(
      (item) =>
        normalizePesFilialName(item?.branch) === normalizedFilialName &&
        isActivePesMarkerItem(item)
    );
  }, [filialName, pesItems, showPesMarkers]);

  useEffect(() => {
    if (!showPesMarkers || !filialName) return undefined;

    const loadCurrentPesItems = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadPesItems(user, { silent: true });
    };

    loadCurrentPesItems();
    const timer = window.setInterval(loadCurrentPesItems, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [filialName, loadPesItems, showPesMarkers, user]);

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
    if (typeof window === "undefined") return undefined;

    const handleResize = () => setIsWallDisplayViewport(getIsWallDisplayMapViewport());
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
    const pesMarkerSource = new VectorSource();
    const pesMarkerLayer = new VectorLayer({
      source: pesMarkerSource,
      style: getPesMarkerStyle,
      zIndex: 45,
    });
    const view = new View({
      center: fromLonLat(MAP_FALLBACK_CENTER),
      zoom: MAP_FALLBACK_ZOOM,
    });
    const map = new OlMap({
      target: mapElRef.current,
      layers: [
        districtLayer,
        filialHoverLayer,
        modeBoundaryLayer,
        pesMarkerLayer,
        districtLabelLayer,
      ],
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
    filialHoverSourceRef.current = filialHoverSource;
    modeBoundarySourceRef.current = modeBoundarySource;
    pesMarkerSourceRef.current = pesMarkerSource;
    pesMarkerLayerRef.current = pesMarkerLayer;

    let cancelled = false;
    const format = new GeoJSON();

    const refreshBoundaryLayers = (features = districtSourceRef.current?.getFeatures() || []) => {
      filialHoverSource.clear();
      modeBoundarySource.clear();
      const areaBoundaryFeatures =
        fillGroup === "po"
          ? buildGroupBoundaryFeatures(
              features,
              "po",
              (groupName) => ({
                groupName,
                strokeColor: "#cfd6de",
                strokeWidth: OPERATIONAL_MAP_DISTRICT_STROKE_WIDTH,
              })
            )
          : [];
      const modeBoundaryFeatures = buildGroupBoundaryFeatures(
        features,
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
      modeBoundarySource.addFeatures([...areaBoundaryFeatures, ...modeBoundaryFeatures]);
    };

    const applyFeatureCollection = (featureCollection, { fit = false } = {}) => {
      if (cancelled || !mapRef.current || !districtSourceRef.current) return;
      const features = format.readFeatures(featureCollection, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });
      districtSourceRef.current.clear();
      assignVisiblePoNames(features, filialName);
      assignAreaLabels(features, fillGroup);
      districtSourceRef.current.addFeatures(features);
      refreshBoundaryLayers(features);
      districtLayerRef.current?.changed();
      districtLabelLayerRef.current?.changed();
      setMapFeaturesVersion((version) => version + 1);
      if (fit) fitMapToSource(view, districtSourceRef.current);
    };

    const getDistrictFeatureAtPixel = (pixel) =>
      map.forEachFeatureAtPixel(pixel, (item) => item, {
        layerFilter: (layer) => layer === districtLayer,
      });

    const highlightHoverGroup = (hoverName) => {
      filialHoverSource.clear();
      if (!hoverName) return;

      applyHoverBoundary(filialHoverSource, districtSource, hoverGroup, hoverName);
    };

    const applyDistrictRows = (rows, options) => {
      const topologyOkrugaRows = buildTnFilialyTopologyOkrugaRows(rows, {
        filialName,
        poName,
        poSlug,
        normalizeFilialName: normalizeOperationalFilialName,
        normalizePoName: normalizeOperationalFilialName,
        getPoSlug: getOperationalPoSlug,
      });
      applyFeatureCollection(buildTnOkrugaFeatureCollection(topologyOkrugaRows), options);
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

    const loadDistrictFeatures = async ({ fit = false, force = false } = {}) => {
      try {
        const rows = await fetchTnFilialyRows({ force });
        if (cancelled || !mapRef.current || !districtSourceRef.current) return;
        writeCachedTnOkrugaRows(rows);
        applyDistrictRows(rows, { fit });
      } catch {
        // Если Strapi временно недоступен, оставляем текущую карту на экране.
      }
    };

    const getFilialModeEventPayload = (event) => {
      if (event?.detail) return event.detail?.payload || event.detail;
      if (!event?.newValue) return null;
      try {
        const payload = JSON.parse(event.newValue);
        return payload?.payload || payload;
      } catch {
        return null;
      }
    };

    const applyFilialModePayload = (payload) => {
      const rezim = payload?.rezim;
      const filialIds = new Set((payload?.filialIds || []).map((id) => String(id)));
      const filialNames = new Set(
        (payload?.filials || [])
          .map((item) => normalizeOperationalMapAreaName(item?.name))
          .filter(Boolean)
      );

      if (!rezim || (!filialIds.size && !filialNames.size)) return false;

      const features = districtSourceRef.current?.getFeatures() || [];
      let changed = false;
      features.forEach((feature) => {
        const featureFilialIds = toFeatureNameList(feature.get("filial_ids"));
        const featureFilialNames = toFeatureNameList(feature.get("filial_names")).map(
          normalizeOperationalMapAreaName
        );
        const hasTargetId = featureFilialIds.some((id) => filialIds.has(String(id)));
        const hasTargetName = featureFilialNames.some((name) => filialNames.has(name));
        if (!hasTargetId && !hasTargetName) return;

        feature.set("rezim", rezim);
        feature.set("filial_rezim", rezim);
        changed = true;
      });

      if (!changed) return false;

      refreshBoundaryLayers(features);
      districtLayerRef.current?.changed();
      districtLabelLayerRef.current?.changed();
      setMapFeaturesVersion((version) => version + 1);
      return true;
    };

    const applyFilialModeRows = (rows) => {
      const modeById = new Map();
      const modeByName = new Map();

      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const mode = row?.rezim || "bez_rezhima";
        const id = row?.documentId || row?.id;
        const name = normalizeOperationalMapAreaName(row?.name);
        if (id) modeById.set(String(id), mode);
        if (name) modeByName.set(name, mode);
      });

      if (!modeById.size && !modeByName.size) return false;

      const features = districtSourceRef.current?.getFeatures() || [];
      let changed = false;
      features.forEach((feature) => {
        const featureFilialIds = toFeatureNameList(feature.get("filial_ids"));
        const featureFilialNames = toFeatureNameList(feature.get("filial_names")).map(
          normalizeOperationalMapAreaName
        );
        const modeByFeatureId = featureFilialIds
          .map((id) => modeById.get(String(id)))
          .find((mode) => mode !== undefined);
        const modeByFeatureName = featureFilialNames
          .map((name) => modeByName.get(name))
          .find((mode) => mode !== undefined);
        const nextMode = modeByFeatureId ?? modeByFeatureName;
        if (nextMode === undefined || feature.get("rezim") === nextMode) return;

        feature.set("rezim", nextMode);
        feature.set("filial_rezim", nextMode);
        changed = true;
      });

      if (!changed) return false;

      refreshBoundaryLayers(features);
      districtLayerRef.current?.changed();
      districtLabelLayerRef.current?.changed();
      setMapFeaturesVersion((version) => version + 1);
      return true;
    };

    let modeRowsRefreshTimer = null;
    let modeRowsPollingTimer = null;
    let isModeRowsRefreshPending = false;

    const refreshFilialModeRows = async () => {
      if (isModeRowsRefreshPending) return;
      isModeRowsRefreshPending = true;
      try {
        const rows = await fetchTnFilialyModeRows({ force: true });
        if (cancelled || !mapRef.current || !districtSourceRef.current) return;
        applyFilialModeRows(rows);
      } catch {
        // Live-режимы не должны ломать карту, если легкий endpoint временно недоступен.
      } finally {
        isModeRowsRefreshPending = false;
      }
    };

    const scheduleFilialModeRowsRefresh = (delay = 350) => {
      window.clearTimeout(modeRowsRefreshTimer);
      modeRowsRefreshTimer = window.setTimeout(refreshFilialModeRows, delay);
    };

    const cachedRows = readCachedTnOkrugaRows();
    if (cachedRows.length) {
      applyDistrictRows(cachedRows, { fit: true });
    }
    loadFallbackFeatures();
    loadDistrictFeatures({ fit: !cachedRows.length });
    const handleFilialModeUpdated = (event) => {
      const applied = applyFilialModePayload(getFilialModeEventPayload(event));
      scheduleFilialModeRowsRefresh(applied ? 1200 : 150);
      return applied;
    };
    const handleFilialModeStorageUpdated = (event) => {
      if (event.key === TN_FILIALY_REZIM_UPDATED_STORAGE_KEY) {
        handleFilialModeUpdated(event);
      }
    };
    window.addEventListener(TN_FILIALY_REZIM_UPDATED_EVENT, handleFilialModeUpdated);
    window.addEventListener("storage", handleFilialModeStorageUpdated);
    modeRowsPollingTimer = window.setInterval(
      () => scheduleFilialModeRowsRefresh(0),
      FILIAL_MODE_POLL_MS
    );

    const handlePointerMove = (event) => {
      const feature = getDistrictFeatureAtPixel(event.pixel);
      const hoverName =
        hoverGroup === "po"
          ? getPoNameAtPixel(map, feature, event.pixel, isCompactViewport, isWallDisplayViewport)
          : getFeatureHoverName(feature, hoverGroup);

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
        name: getFeatureHoverLabel(feature, hoverGroup),
        x: event.originalEvent.clientX - rect.left,
        y: event.originalEvent.clientY - rect.top,
      });
    };

    const handlePointerLeave = () => {
      map.getTargetElement().style.cursor = "";
      highlightHoverGroup(externalHoverNameRef.current);
      setHoveredArea(null);
    };

    const handleSingleClick = (event) => {
      if (!enableFilialNavigation) return;

      const feature = getDistrictFeatureAtPixel(event.pixel);
      const featureFilialName = getFeatureFilialName(feature);
      const featurePoName =
        hoverGroup === "po" || fillGroup === "po"
          ? getPoNameAtPixel(map, feature, event.pixel, isCompactViewport, isWallDisplayViewport)
          : getFeaturePoName(feature);
      const poPath =
        filialName && featurePoName
          ? getOperationalPoPath(filialName, featurePoName, basePath)
          : "";
      const filialPath = getOperationalFilialPathForBase(featureFilialName, basePath);
      if (poPath) {
        navigate(poPath);
        return;
      }
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
      window.clearTimeout(modeRowsRefreshTimer);
      window.clearInterval(modeRowsPollingTimer);
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
      filialHoverSourceRef.current = null;
      modeBoundarySourceRef.current = null;
      pesMarkerSourceRef.current = null;
      pesMarkerLayerRef.current = null;
    };
  }, [
    basePath,
    enableFilialNavigation,
    filialName,
    fillGroup,
    hoverGroup,
    isCompactViewport,
    isWallDisplayViewport,
    navigate,
    poName,
    poSlug,
  ]);

  useEffect(() => {
    externalHoverNameRef.current = externalHoverName;
    if (hoveredArea?.name) return;

    applyHoverBoundary(
      filialHoverSourceRef.current,
      districtSourceRef.current,
      hoverGroup,
      externalHoverName
    );
  }, [externalHoverName, hoverGroup, hoveredArea?.name, mapFeaturesVersion]);

  useEffect(() => {
    const markerSource = pesMarkerSourceRef.current;
    const districtSource = districtSourceRef.current;
    if (!markerSource) return;

    markerSource.clear();
    if (!showPesMarkers || !districtSource) return;

    const districtFeatures = districtSource.getFeatures();
    if (!districtFeatures.length || !filialPesItems.length) return;

    markerSource.addFeatures(
      buildPesMarkerFeatures({
        items: filialPesItems,
        districtFeatures,
        compact: isCompactViewport,
      })
    );
    pesMarkerLayerRef.current?.changed();
  }, [filialPesItems, isCompactViewport, mapFeaturesVersion, showPesMarkers]);

  useEffect(() => {
    const layer = districtLayerRef.current;
    const labelLayer = districtLabelLayerRef.current;
    if (!layer) return;

    layer.setStyle((feature) =>
      getDistrictStyle(feature, areaDataByKey, {
        districtDetailMode,
        fillGroup,
        showDistrictLabels,
        isWallDisplay: isWallDisplayViewport,
      })
    );
    layer.changed();

    if (labelLayer) {
      labelLayer.setStyle(
        showDistrictLabels
          ? (feature) =>
              getDistrictLabelStyle(
                feature,
                isCompactViewport,
                fillGroup,
                districtDetailMode,
                isWallDisplayViewport
              )
          : null
      );
      labelLayer.changed();
    }
  }, [
    areaDataByKey,
    districtDetailMode,
    fillGroup,
    isCompactViewport,
    isWallDisplayViewport,
    mapFeaturesVersion,
    showDistrictLabels,
  ]);

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
