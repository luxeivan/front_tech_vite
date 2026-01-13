import React, { useEffect, useMemo, useRef, useState } from "react";
import { Radio, Space } from "antd";

import {
  attachMapClickPopup,
  buildTpIndex,
  createAccLayer,
  createBaseLayers,
  createOlMap,
  createPopupOverlay,
  createTpLayer,
  createTpViewportUpdater,
  createView,
  setAccidentFeatures,
  setActiveBaseLayer,
} from "./olLayers";

import arrTp from "../../../tp.json";
import tpNashe from "../../../assets/tpNashe.svg";
import tpNeNashe from "../../../assets/tpNeNashe.svg";
import {
  createPesLayer,
  startPesPolling,
  getPesEndpointFromEnv,
  PES_POLL_MS_DEFAULT,
} from "./pesLayer";

export default function MapPanel({
  height = "100%",
  initialState = { center: [55.751244, 37.618423], zoom: 8 },
  points = [],
  fiasCodes = [],
  url,
  fiasCollection = "adress",
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
  const wrapperRef = useRef(null);
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
  const pesSourceRef = useRef(null);
  const tpIndexRef = useRef([]);
  const tpUpdaterRef = useRef(null);
  const clickDetachRef = useRef(null);
  const popupDisposeRef = useRef(null);
  const baseCleanupRef = useRef(null);

  const [activeLayer, setActiveLayer] = useState("yandex");
  const [resolvedPoints, setResolvedPoints] = useState([]);


  const mapHeight = useMemo(() => {
    if (height === "100%" || height === "100vh") return "520px";
    return height;
  }, [height]);

  useEffect(() => {
    const { baseLayers, cleanup: baseCleanup } = createBaseLayers({
      onProviderError: () => setActiveLayer("osm"),
    });
    layersRef.current = baseLayers;
    baseCleanupRef.current = baseCleanup;

    const { overlay, contentEl, dispose: popupDispose } = createPopupOverlay();
    overlayRef.current = overlay;
    overlayContentRef.current = contentEl;
    popupDisposeRef.current = popupDispose;

    const { tpSource, tpLayer } = createTpLayer({
      tpNashe,
      tpNeNashe,
      getZoom: () => viewRef.current?.getZoom?.(),
      getFallbackZoom: () => zoom,
    });
    tpSourceRef.current = tpSource;
    tpLayerRef.current = tpLayer;

    const { accSource, accLayer } = createAccLayer({
      getZoom: () => viewRef.current?.getZoom?.(),
      getFallbackZoom: () => zoom,
    });
    accSourceRef.current = accSource;
    accLayerRef.current = accLayer;

    const { source: pesSource, layer: pesLayer } = createPesLayer({
      getZoom: () => viewRef.current?.getZoom?.(),
      getFallbackZoom: () => zoom,
    });
    pesSourceRef.current = pesSource;

    const view = createView({ initialState });
    viewRef.current = view;

    const map = createOlMap({
      target: mapRef.current,
      baseLayers,
      view,
      overlays: [overlay],
      layers: [tpLayer, accLayer, pesLayer],
    });
    olMapRef.current = map;

    const resizeOnFs = () => {
      requestAnimationFrame(() => olMapRef.current?.updateSize());
    };
    document.addEventListener("fullscreenchange", resizeOnFs);

    const onRes = () => {
      const vz = view.getZoom();
      setZoom(vz);
      tpLayer.changed();
      accLayer.changed();
      pesLayer.changed();
    };
    view.on("change:resolution", onRes);

    // popup on click
    const { detach } = attachMapClickPopup({
      map,
      view,
      overlay,
      overlayContentEl: contentEl,
    });
    clickDetachRef.current = detach;

    // TP: index + viewport loader
    tpIndexRef.current = buildTpIndex(arrTp);
    const tpUpdater = createTpViewportUpdater({
      map,
      view,
      tpSource,
      tpIndex: tpIndexRef.current,
      zoomOn: 11,
      maxPoints: 5000,
    });
    tpUpdaterRef.current = tpUpdater;
    tpUpdater.update();
    tpUpdater.bind();

    // default base layer
    baseLayers.yandex?.setVisible?.(true);

    return () => {
      document.removeEventListener("fullscreenchange", resizeOnFs);
      try {
        view.un("change:resolution", onRes);
      } catch (_) {}

      try {
        clickDetachRef.current?.();
      } catch (_) {}

      try {
        tpUpdaterRef.current?.unbind?.();
      } catch (_) {}

      try {
        popupDisposeRef.current?.();
      } catch (_) {}

      try {
        baseCleanupRef.current?.();
      } catch (_) {}

      try {
        map.setTarget(null);
      } catch (_) {}
    };
  }, []);

  useEffect(() => {
    setActiveBaseLayer(layersRef.current, activeLayer);
  }, [activeLayer]);


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
    setAccidentFeatures(accSourceRef.current, accidentPoints);
  }, [accidentPoints]);

  const shownCount = accidentPoints.length;

  const handleZoomIn = () => {
    const v = viewRef.current;
    if (!v) return;
    const z = v.getZoom() ?? 8;
    v.setZoom(z + 1);
  };

  const handleZoomOut = () => {
    const v = viewRef.current;
    if (!v) return;
    const z = v.getZoom() ?? 8;
    v.setZoom(z - 1);
  };

  const handleFullscreen = () => {
    const el = wrapperRef.current || mapRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      document.exitFullscreen?.();
      return;
    }
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
      setTimeout(() => el.requestFullscreen?.(), 0);
    }
  };

  // --- Load and refresh moving PES vehicles from backend services ---
  useEffect(() => {
    if (!pesSourceRef.current) return;

    const endpoint = getPesEndpointFromEnv();
    if (!endpoint) return;

    const { stop } = startPesPolling({
      source: pesSourceRef.current,
      endpoint,
      pollMs: PES_POLL_MS_DEFAULT,
      onError: (e) => console.error("[MapOL] PES vehicles error:", e),
    });

    return () => stop();
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="mo-map-wrapper"
      style={{ position: "relative", width: "100%", height: "auto" }}
    >
      <style>{`.mo-map-wrapper .ol-control{display:none!important}`}</style>
      <div style={{ marginBottom: 8 }}>
        <Space>
          {/* Подложка: */}
          <Radio.Group
            value={activeLayer}
            onChange={(e) => setActiveLayer(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            options={[
              { label: "Yandex", value: "yandex" },
              { label: "2GIS", value: "gis2" },
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
      <div style={{ position: "relative" }}>
        <div
          ref={mapRef}
          style={{
            width: "100%",
            height: mapHeight,
            background: "#f0f0f0",
            borderRadius: 4,
          }}
        />

        {/* Custom top-right controls */}
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            display: "flex",
            gap: 8,
            zIndex: 1000,
          }}
        >
          <button
            onClick={handleZoomIn}
            title="Приблизить"
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              border: "1px solid #d9d9d9",
              background: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              fontSize: 24,
              lineHeight: "42px",
              cursor: "pointer",
              padding: 0,
            }}
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            title="Отдалить"
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              border: "1px solid #d9d9d9",
              background: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              fontSize: 24,
              lineHeight: "42px",
              cursor: "pointer",
              padding: 0,
            }}
          >
            −
          </button>
          <button
            onClick={handleFullscreen}
            title="Полный экран"
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              border: "1px solid #d9d9d9",
              background: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              fontSize: 22,
              lineHeight: "42px",
              cursor: "pointer",
              padding: 0,
            }}
          >
            ⛶
          </button>
        </div>

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
    </div>
  );
}
