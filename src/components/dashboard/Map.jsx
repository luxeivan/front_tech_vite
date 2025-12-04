import React, { useEffect, useMemo, useRef, useState } from "react";
import { Radio, Space } from "antd";

import OlMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import { fromLonLat } from "ol/proj";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { Icon, Style } from "ol/style";
import Text from "ol/style/Text";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Cluster from "ol/source/Cluster";
import Overlay from "ol/Overlay";
import { containsCoordinate } from "ol/extent";

import arrTp from "../../tp.json";
import tpNashe from "../../assets/ТП_наша.svg";
import tpNeNashe from "../../assets/ТП_НЕнаша.svg";

// import tpNashe from "../../assets/tpNashe.svg";
// import tpNeNashe from "../../assets/tpNeNashe.svg";

export default function MapPanel({
  height = "100%",
  initialState = { center: [55.751244, 37.618423], zoom: 8 },
  points = [],
  fiasCodes = [],
  url,
  fiasCollection = "adress",
  objectOptions = {}, // (зарезервировано) настройки объектов
  clusterOptions = {}, // (зарезервировано) настройки кластеров
  fiasOwners = {},
}) {
  const buildInParams = (field, values) => {
    const params = {};
    params[`filters[${field}][$in]`] = values;
    return params;
  };

  const encodeStrapiQuery = (params) => {
    const parts = [];
    const push = (k, v) =>
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value))
        value.forEach((v, i) => push(`${key}[${i}]`, v));
      else push(key, value);
    }
    return parts.join("&");
  };

  const pickLatLon = (obj) => {
    if (!obj) return null;
    const a = obj.attributes ? obj.attributes : obj;
    const latRaw =
      a.lat ??
      a.latitude ??
      a.geo_lat ??
      a.geoLat ??
      (Array.isArray(a?.coords) ? a.coords[0] : undefined);
    const lonRaw =
      a.lon ??
      a.longitude ??
      a.geo_lon ??
      a.geoLon ??
      (Array.isArray(a?.coords) ? a.coords[1] : undefined);
    const lat = typeof latRaw === "number" ? latRaw : parseFloat(latRaw);
    const lon = typeof lonRaw === "number" ? lonRaw : parseFloat(lonRaw);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    return null;
  };

  const [zoom, setZoom] = useState(initialState?.zoom ?? 8);
  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);
  const mapRef = useRef(null);
  const olMapRef = useRef(null);
  const viewRef = useRef(null);
  const overlayRef = useRef(null);
  const overlayElRef = useRef(null);
  const overlayContentRef = useRef(null);
  const layersRef = useRef({});
  const tpSourceRef = useRef(null);
  const tpLayerRef = useRef(null);
  const accSourceRef = useRef(null);
  const accLayerRef = useRef(null);
  const tpIndexRef = useRef([]);

  const [activeLayer, setActiveLayer] = useState("gis2");
  const [resolvedPoints, setResolvedPoints] = useState([]);

  useEffect(() => {
    // Подложки
    const baseLayers = {
      osm: new TileLayer({
        source: new OSM(),
        visible: false,
      }),
      cartoLight: new TileLayer({
        source: new XYZ({
          url: "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        }),
        visible: false,
      }),
      cartoDark: new TileLayer({
        source: new XYZ({
          url: "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        }),
        visible: false,
      }),
      stamenTerrain: new TileLayer({
        source: new XYZ({
          url: "https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg",
        }),
        visible: false,
      }),
      openTopoMap: new TileLayer({
        source: new XYZ({
          url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
        }),
        visible: false,
      }),
      rgis: new TileLayer({
        source: new XYZ({
          url: "https://rgis.mosreg.ru/wmts/m10/{z}/{x}/{y}.png",
        }),
        visible: false,
      }),
      yandex: new TileLayer({
        source: new XYZ({
          url: "https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=ru_RU&projection=web_mercator",
          crossOrigin: "anonymous",
        }),
        visible: false,
      }),
      gis2: new TileLayer({
        source: new XYZ({
          url: "https://tile1.maps.2gis.com/tiles?x={x}&y={y}&z={z}&v=1.1",
          crossOrigin: "anonymous",
        }),
        visible: false,
      }),
    };
    layersRef.current = baseLayers;

    const container = document.createElement("div");
    Object.assign(container.style, {
      position: "relative",
      background: "#fff",
      padding: "8px 12px",
      borderRadius: "6px",
      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
      minWidth: "160px",
      maxWidth: "320px",
      fontSize: "13px",
      lineHeight: 1.25,
    });
    const closer = document.createElement("a");
    closer.textContent = "×";
    Object.assign(closer.style, {
      position: "absolute",
      top: "4px",
      right: "8px",
      cursor: "pointer",
      color: "#333",
      textDecoration: "none",
      fontSize: "16px",
      fontWeight: "bold",
    });
    const content = document.createElement("div");
    container.appendChild(content);
    container.appendChild(closer);

    const overlay = new Overlay({
      element: container,
      positioning: "bottom-center",
      stopEvent: false,
      offset: [0, -10],
    });
    overlayRef.current = overlay;
    overlayElRef.current = container;
    overlayContentRef.current = content;

    closer.addEventListener("click", (e) => {
      e.stopPropagation();
      overlay.setPosition(undefined);
      return false;
    });

    // Источник ТП + кластеризация
    const tpSource = new VectorSource();
    tpSourceRef.current = tpSource;

    const tpCluster = new Cluster({
      distance: 40, // px
      source: tpSource,
    });

    const tpLayer = new VectorLayer({
      source: tpCluster,
      style: (feature) => {
        const z = viewRef.current?.getZoom?.() ?? zoom;
        if (z < 12) return null;
        const clustered = feature.get("features");
        const base =
          Array.isArray(clustered) && clustered.length ? clustered[0] : feature;
        const property = (base.get("property") || "").toString();
        let scale;
        if (z < 13) scale = 0.003;
        else if (z < 14) scale = 0.00375;
        else if (z < 15) scale = 0.0045;
        else if (z < 16) scale = 0.00525;
        else if (z < 17) scale = 0.006;
        else scale = 0.007;

        return new Style({
          image: new Icon({
            src: /мособлэнерго/i.test(property) ? tpNashe : tpNeNashe,
            scale,
            anchor: [0.5, 1],
            anchorXUnits: "fraction",
            anchorYUnits: "fraction",
          }),
        });
      },
    });
    tpLayerRef.current = tpLayer;
    const accSource = new VectorSource();
    accSourceRef.current = accSource;

    const accCluster = new Cluster({
      distance: 60, // px
      source: accSource,
    });

    const accStyleCache = {};

    const accLayer = new VectorLayer({
      source: accCluster,
      style: (feature) => {
        const z = viewRef.current?.getZoom?.() ?? zoom;
        const members = feature.get("features");
        const count = Array.isArray(members) ? members.length : 1;
        if (count > 1 && z <= 12) {
          const key = `c:${count}`;
          if (!accStyleCache[key]) {
            const radius = Math.min(28, 10 + Math.log2(count + 1) * 5);
            accStyleCache[key] = new Style({
              image: new CircleStyle({
                radius,
                fill: new Fill({ color: "#1677ff" }),
                stroke: new Stroke({ color: "#ffffff", width: 3 }),
              }),
              text: new Text({
                text: String(count),
                fill: new Fill({ color: "#ffffff" }),
                font: "bold 12px system-ui, sans-serif",
              }),
            });
          }
          return accStyleCache[key];
        }
        let r;
        if (z < 10) r = 5;
        else if (z < 12) r = 7;
        else if (z < 14) r = 9;
        else if (z < 16) r = 11;
        else r = 13;

        const key = `p:${r}`;
        if (!accStyleCache[key]) {
          accStyleCache[key] = new Style({
            image: new CircleStyle({
              radius: r,
              fill: new Fill({ color: "#1677ff" }),
              stroke: new Stroke({ color: "#ffffff", width: 2 }),
            }),
          });
        }
        return accStyleCache[key];
      },
    });
    accLayerRef.current = accLayer;

    const lat = initialState?.center?.[0] ?? 55.751244;
    const lon = initialState?.center?.[1] ?? 37.618423;
    const view = new View({
      center: fromLonLat([lon, lat]),
      zoom: initialState?.zoom ?? 8,
      maxZoom: 19,
      minZoom: 5,
    });
    viewRef.current = view;
    const map = new OlMap({
      target: mapRef.current,
      layers: [...Object.values(baseLayers), tpLayer, accLayer],
      overlays: [overlay],
      view,
    });
    olMapRef.current = map;

    view.on("change:resolution", () => {
      const vz = view.getZoom();
      setZoom(vz);
      tpLayer.changed();
      accLayer.changed();
    });

    map.on("click", (evt) => {
      const f = map.forEachFeatureAtPixel(evt.pixel, (feat) => feat);
      if (!f) {
        overlay.setPosition(undefined);
        return;
      }

      const members = f && f.get && f.get("features");
      if (Array.isArray(members) && members.length > 1) {
        ппа;
        const current = viewRef.current?.getZoom?.() ?? 10;
        viewRef.current?.setZoom(current + 1);
      }

      const clustered = f.get("features");
      if (Array.isArray(clustered) && clustered.length > 1) {
        if (overlayContentRef.current) {
          overlayContentRef.current.innerHTML = `<div><b>Кластер ТП:</b> ${clustered.length} шт</div>`;
        }
        overlay.setPosition(evt.coordinate);
        return;
      }

      const base =
        Array.isArray(clustered) && clustered.length ? clustered[0] : f;
      const props = base.getProperties() || {};
      const html = props._popupHtml || props.name || "—";

      if (overlayContentRef.current) {
        overlayContentRef.current.innerHTML = html;
      }
      overlay.setPosition(evt.coordinate);
    });
    baseLayers.gis2.setVisible(true);
    return () => {
      map.setTarget(null);
    };
  }, []);

  useEffect(() => {
    const layers = layersRef.current;
    Object.keys(layers).forEach((key) => {
      layers[key]?.setVisible?.(key === activeLayer);
    });
  }, [activeLayer]);

  useEffect(() => {
    if (!tpSourceRef.current || !viewRef.current || !olMapRef.current) return;

    const raw = Array.isArray(arrTp?.features) ? arrTp.features : [];
    const idx = [];
    for (const item of raw) {
      const props = item?.properties || {};
      const name = props["Наименование подстанции"] || props.name || "ТП";
      const lon = Number(props?.x);
      const lat = Number(props?.y);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      const xy = fromLonLat([lon, lat]); // [x,y] в 3857
      const type = props["Тип подстанции"] || "";
      const zone = props["Зона ответственности"] || "";
      const property = props["Вид собственности"] || "";
      idx.push({ xy, lon, lat, name, type, zone, property });
    }
    tpIndexRef.current = idx;

    const TP_ZOOM_ON = 11;
    const TP_MAX_POINTS = 5000;

    const updateTpLayer = () => {
      const map = olMapRef.current;
      const view = viewRef.current;
      if (!map || !view || !tpSourceRef.current) return;

      const z = view.getZoom();
      if (z < TP_ZOOM_ON) {
        tpSourceRef.current.clear(true);
        return;
      }

      const extent = view.calculateExtent(map.getSize());
      const buffer = 0; // можно увеличить при желании
      const feats = [];
      const selected = [];
      for (const it of tpIndexRef.current) {
        if (containsCoordinate(extent, it.xy)) selected.push(it);
      }

      let stride = 1;
      if (selected.length > TP_MAX_POINTS) {
        stride = Math.ceil(selected.length / TP_MAX_POINTS);
      }

      for (let i = 0; i < selected.length; i += stride) {
        const it = selected[i];
        const f = new Feature({
          geometry: new Point(it.xy),
        });
        f.setProperties({
          name: it.name,
          type: it.type,
          zone: it.zone,
          property: it.property,
        });
        f.set(
          "_popupHtml",
          `<div><b>${it.name}</b>
            <br/>Тип: ${it.type || "—"}
            <br/>Зона: ${it.zone || "—"}
            <br/>Собственность: ${it.property || "—"}
            <br/>Коорд.: ${it.lat.toFixed(6)}, ${it.lon.toFixed(6)}
          </div>`
        );
        feats.push(f);
      }

      tpSourceRef.current.clear(true);
      tpSourceRef.current.addFeatures(feats);
    };

    updateTpLayer();
    const map = olMapRef.current;

    const onMoveEnd = () => updateTpLayer();
    const onRes = () => updateTpLayer();

    map.on("moveend", onMoveEnd);
    viewRef.current.on("change:resolution", onRes);

    return () => {
      if (map) map.un("moveend", onMoveEnd);
      if (viewRef.current) viewRef.current.un("change:resolution", onRes);
    };
  }, []);

  useEffect(() => {
    console.log(
      "[MapOL] FIAS resolution start, codes:",
      fiasCodes?.length || 0
    );

    if (!(cacheRef.current instanceof globalThis.Map)) {
      cacheRef.current = new globalThis.Map();
    }

    const uniqueFias = Array.from(new Set((fiasCodes || []).filter(Boolean)));
    if (!uniqueFias.length) {
      setResolvedPoints([]);
      return;
    }
    if (!url || !fiasCollection) {
      console.log("[MapOL] Missing url or fiasCollection", {
        url,
        fiasCollection,
      });
      setResolvedPoints([]);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const cacheMap = cacheRef.current;
    const initial = uniqueFias
      .filter((c) => cacheMap.has(c))
      .map((c) => ({ id: c, ...cacheMap.get(c) }));
    setResolvedPoints(initial);

    const toResolve = uniqueFias.filter((c) => !cacheMap.has(c));
    if (!toResolve.length) return;

    const BASE = String(url).replace(/\/$/, "");
    const MAX_URL_LEN = 1800;
    const buildQuery = (ids) =>
      encodeStrapiQuery({
        ...buildInParams("fiasId", ids),
        "pagination[page]": 1,
        "pagination[pageSize]": Math.min(ids.length, 100),
        fields: ["fiasId", "lat", "lon", "fullAddress"],
      });
    const buildUrl = (ids) =>
      `${BASE}/api/${fiasCollection}?${buildQuery(ids)}`;

    let innerSize = Math.min(50, toResolve.length || 50);
    while (
      innerSize > 1 &&
      buildUrl(toResolve.slice(0, innerSize)).length > MAX_URL_LEN
    ) {
      innerSize = Math.max(1, Math.floor(innerSize * 0.7));
    }

    const batches = [];
    for (let i = 0; i < toResolve.length; i += innerSize) {
      batches.push(toResolve.slice(i, i + innerSize));
    }

    const loadBatch = async (batch) => {
      const urlStr = buildUrl(batch);
      const resp = await fetch(urlStr, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("jwt") || ""}`,
        },
        signal: ac.signal,
      });
      if (!resp.ok) throw new Error(`FIAS lookup failed: ${resp.status}`);
      const json = await resp.json();
      const arr = Array.isArray(json?.data) ? json.data : [];
      const out = [];
      for (const item of arr) {
        const a = item?.attributes ? item.attributes : item;
        const fias = a.fiasId || a.fias || a.FIAS || a.fias_code || a.FIAS_CODE;
        const ll = pickLatLon(a);
        const fullAddress =
          a.fullAddress ?? a.address ?? a.full_address ?? a.FullAddress ?? null;
        if (fias && ll) {
          const payload = { lat: ll.lat, lon: ll.lon, fullAddress };
          cacheMap.set(fias, payload);
          out.push({ id: fias, fiasId: fias, ...payload });
        }
      }
      return out;
    };

    let idx = 0;
    let active = 0;
    const CONCURRENCY = 4;
    const collected = [...initial];

    const pump = () => {
      if (ac.signal.aborted) return;
      while (active < CONCURRENCY && idx < batches.length) {
        const b = batches[idx++];
        active++;
        loadBatch(b)
          .then((pts) => {
            if (ac.signal.aborted) return;
            pts.forEach((p) => collected.push(p));
            setResolvedPoints([...collected]);
          })
          .catch((e) => console.error("[MapOL] batch error:", e))
          .finally(() => {
            active--;
            if (idx < batches.length) pump();
          });
      }
    };

    pump();
    return () => ac.abort();
  }, [fiasCodes, url, fiasCollection]);

  const accidentPoints = useMemo(() => {
    const src =
      Array.isArray(fiasCodes) && fiasCodes.length > 0
        ? resolvedPoints
        : Array.isArray(points)
        ? points
        : [];

    const toLngLat = (p) => {
      if (Array.isArray(p.coordinates) && p.coordinates.length === 2) {
        я;
        const [a, b] = p.coordinates;
        const latFirst = Math.abs(a) <= 90 && Math.abs(b) <= 180;
        return latFirst ? [b, a] : [a, b];
      }
      if (Array.isArray(p.coords) && p.coords.length === 2) {
        const [a, b] = p.coords;
        const latFirst = Math.abs(a) <= 90 && Math.abs(b) <= 180;
        return latFirst ? [b, a] : [a, b];
      }
      const lat = p.lat ?? p.latitude;
      const lon = p.lon ?? p.longitude;
      if (Number.isFinite(lat) && Number.isFinite(lon)) return [lon, lat];
      const latN = parseFloat(lat);
      const lonN = parseFloat(lon);
      if (Number.isFinite(latN) && Number.isFinite(lonN)) return [lonN, latN];
      return null;
    };

    return (src || []).flatMap((p, i) => {
      const coords = toLngLat(p);
      if (!coords) return [];
      const [lon, lat] = coords;

      const fiasKey = p.id ?? p.fias ?? p.fiasId ?? null;
      const tnNums = Array.isArray(fiasOwners?.[fiasKey])
        ? fiasOwners[fiasKey]
        : Array.isArray(fiasOwners?.[p.fias])
        ? fiasOwners[p.fias]
        : [];

      const addr = p.fullAddress ?? p.address ?? "";
      const coordsStr =
        Number.isFinite(lat) && Number.isFinite(lon)
          ? `${lat.toFixed(6)}, ${lon.toFixed(6)}`
          : "";

      const hintListMax = 8;
      const tnList = tnNums
        .slice(0, hintListMax)
        .map((n) => `№ ${n}`)
        .join(", ");
      const tnMore =
        tnNums.length > hintListMax
          ? ` и ещё ${tnNums.length - hintListMax}`
          : "";

      const tnBlock = tnNums.length
        ? `<div><b>ТН (в этой точке):</b> ${tnList}${tnMore}</div>`
        : "";

      const fiasBlock = fiasKey ? `<div><b>FIAS:</b> ${fiasKey}</div>` : "";
      const addrBlock = addr ? `<div><b>Адрес:</b> ${addr}</div>` : "";
      const coordBlock = coordsStr
        ? `<div><b>Координаты:</b> ${coordsStr}</div>`
        : "";

      const popupHtml = `<div>${tnBlock}${addrBlock}${fiasBlock}${coordBlock}</div>`;

      return [
        {
          lon,
          lat,
          fiasKey,
          popupHtml,
        },
      ];
    });
  }, [points, resolvedPoints, fiasCodes, fiasOwners]);

  useEffect(() => {
    if (!accSourceRef.current) return;
    const feats = [];
    for (const p of accidentPoints) {
      const feature = new Feature({
        geometry: new Point(fromLonLat([p.lon, p.lat])),
      });
      feature.set("_popupHtml", p.popupHtml);
      feats.push(feature);
    }
    accSourceRef.current.clear(true);
    accSourceRef.current.addFeatures(feats);
  }, [accidentPoints]);

  const shownCount = accidentPoints.length;

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      {/* Переключатель подложек */}
      <div style={{ marginBottom: 8 }}>
        <Space>
          Подложка:
          <Radio.Group
            value={activeLayer}
            onChange={(e) => setActiveLayer(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            options={[
              { label: "2GIS", value: "gis2" },
              { label: "Yandex", value: "yandex" },
              { label: "Rgis", value: "rgis" },
              { label: "OSM", value: "osm" },
              { label: "Carto Light", value: "cartoLight" },
              { label: "Carto Dark", value: "cartoDark" },
              { label: "Terrain", value: "stamenTerrain" },
              { label: "Topo", value: "openTopoMap" },
            ]}
          />
        </Space>
      </div>

      {/* Карта */}
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height,
          background: "#f0f0f0",
          borderRadius: 4,
        }}
      />

      {/* Счётчик */}
      <div
        style={{
          position: "absolute",
          bottom: 6,
          right: 10,
          fontSize: 12,
          opacity: 0.75,
          background: "rgba(255,255,255,0.8)",
          padding: "2px 6px",
          borderRadius: 3,
        }}
      >
        Точек на карте: {shownCount}
      </div>
    </div>
  );
}
