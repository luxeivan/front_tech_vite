import React, { useMemo, useEffect, useState, useRef } from "react";
import { YMaps, Map as YMap, ObjectManager } from "@pbe/react-yandex-maps";

export default function MapPanel({
  height = "100%",
  initialState = { center: [55.751244, 37.618423], zoom: 8 },
  points = [],
  fiasCodes = [],
  url,
  fiasCollection = "adress",
  objectOptions = {},
  clusterOptions = {},
  fiasOwners = {},
}) {
  const [zoom, setZoom] = useState(initialState?.zoom ?? 8);

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

  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);
  const omRef = useRef(null);
  const mapRef = useRef(null);
  const fittedRef = useRef(false);
  const [resolvedPoints, setResolvedPoints] = useState([]);

  useEffect(() => {
    console.log("[MapPanel] Original FIAS codes:", fiasCodes.length);

    const uniqueFias = [...new Set(fiasCodes.filter(Boolean))];
    console.log("[MapPanel] Unique FIAS codes:", uniqueFias.length);

    if (uniqueFias.length !== fiasCodes.length) {
      console.log(
        "[MapPanel] FIAS duplicates found:",
        fiasCodes.length - uniqueFias.length
      );
    }
    console.log("[MapPanel] FIAS resolution effect started");

    if (!Array.isArray(fiasCodes) || fiasCodes.length === 0) {
      console.log("[MapPanel] No fiasCodes provided");
      setResolvedPoints([]);
      return;
    }
    if (!url || !fiasCollection) {
      console.log("[MapPanel] Missing url or fiasCollection:", {
        url,
        fiasCollection,
      });
      setResolvedPoints([]);
      return;
    }

    console.log(
      "[MapPanel] Starting FIAS resolution for",
      fiasCodes.length,
      "codes"
    );

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const uniq = Array.from(new Set(fiasCodes.filter(Boolean)));
    const cache = cacheRef.current;

    // что уже есть в кэше — отрисуем сразу
    const initial = uniq
      .filter((c) => cache.has(c))
      .map((c) => ({ id: c, ...cache.get(c) }));
    console.log("[MapPanel] Cached points:", initial.length);
    setResolvedPoints(initial);

    const toResolve = uniq.filter((c) => !cache.has(c));
    console.log("[MapPanel] Points to resolve:", toResolve.length);

    if (!toResolve.length) return;

    const CONCURRENCY = 4;

    const BASE = String(url).replace(/\/$/, "");
    const MAX_URL_LEN = 1800; // безопасный лимит для большинства прокси

    const buildQuery = (ids) =>
      encodeStrapiQuery({
        ...buildInParams("fiasId", ids),
        "pagination[page]": 1,
        "pagination[pageSize]": Math.min(ids.length, 100),
        fields: ["fiasId", "lat", "lon"],
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

    console.log("[MapPanel] Batches to load:", batches.length);

    const loadBatch = async (batch) => {
      const urlStr = buildUrl(batch);
      console.log("[MapPanel] Fetching batch from:", urlStr);

      try {
        const resp = await fetch(urlStr, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwt") || ""}`,
          },
          signal: ac.signal,
        });

        console.log("[MapPanel] Response status:", resp.status);

        if (!resp.ok) throw new Error(`FIAS lookup failed: ${resp.status}`);

        const json = await resp.json();
        console.log("[MapPanel] Response data structure:", {
          hasData: !!json.data,
          dataIsArray: Array.isArray(json.data),
          dataLength: Array.isArray(json.data) ? json.data.length : "not array",
        });

        const arr = Array.isArray(json?.data) ? json.data : [];
        const out = [];
        for (const item of arr) {
          const a = item?.attributes ? item.attributes : item;
          const fias =
            a.fiasId || a.fias || a.FIAS || a.fias_code || a.FIAS_CODE;
          const ll = pickLatLon(a);
          //   console.log("[MapPanel] Processing item:", { fias, ll, a });
          if (fias && ll) {
            cache.set(fias, ll);
            out.push({ id: fias, ...ll });
          }
        }
        // console.log("[MapPanel] Batch processed, valid points:", out.length);
        return out;
      } catch (error) {
        console.error("[MapPanel] Error loading batch:", error);
        throw error;
      }
    };

    let idx = 0;
    let active = 0;
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
            // console.log("[MapPanel] Total collected points:", collected.length);
            setResolvedPoints([...collected]);
          })
          .catch((error) => {
            console.error("[MapPanel] Error in batch processing:", error);
          })
          .finally(() => {
            active--;
            if (idx < batches.length) pump();
          });
      }
    };

    pump();
    return () => ac.abort();
  }, [fiasCodes, url, fiasCollection]);

  const features = useMemo(() => {
    if (fiasCodes.length > 0 && resolvedPoints.length === 0) {
      console.log("[MapPanel] FIAS codes provided but no resolved points yet");
      return { type: "FeatureCollection", features: [] };
    }

    const sourcePoints = fiasCodes.length > 0 ? resolvedPoints : points;
    const toCoords = (p) => {
      if (Array.isArray(p.coordinates) && p.coordinates.length === 2)
        return p.coordinates;
      if (Array.isArray(p.coords) && p.coords.length === 2) return p.coords;

      if (p.lat != null && p.lon != null) {
        const lat = typeof p.lat === "number" ? p.lat : parseFloat(p.lat);
        const lon = typeof p.lon === "number" ? p.lon : parseFloat(p.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
      }
      if (p.latitude != null && p.longitude != null) {
        const lat =
          typeof p.latitude === "number" ? p.latitude : parseFloat(p.latitude);
        const lon =
          typeof p.longitude === "number"
            ? p.longitude
            : parseFloat(p.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
      }
      return null;
    };

    const list = (Array.isArray(sourcePoints) ? sourcePoints : []).flatMap(
      (p, i) => {
        const coords = toCoords(p);
        if (!coords || coords.length !== 2) {
          console.log("[MapPanel] Invalid coordinates for point:", p);
          return [];
        }
        const [lat, lon] = coords;

        const fiasKey = p.id ?? p.fias ?? p.fiasId;
        const tnNums = Array.isArray(fiasOwners?.[fiasKey])
          ? fiasOwners[fiasKey]
          : Array.isArray(fiasOwners?.[p.fias])
          ? fiasOwners[p.fias]
          : [];

        const hintListMax = 8;
        const tnList = tnNums.slice(0, hintListMax).join(", ");
        const tnMore = tnNums.length > hintListMax ? ` и ещё ${tnNums.length - hintListMax}` : "";
        const hintText = tnNums.length ? `ТН: ${tnList}${tnMore}` : (p.hintContent ?? p.caption ?? "");
        const iconCap = p.iconCaption ?? (tnNums.length ? `ТН ${tnNums[0]}` : p.caption ?? "");
        const balloonText =
          p.balloonContent ??
          (tnNums.length
            ? `<div><b>ТН (в этой точке):</b><br/>${tnNums.map((n) => `№ ${n}`).join(", ")}</div>`
            : "");

        return [
          {
            type: "Feature",
            id: fiasKey ?? i,
            geometry: { type: "Point", coordinates: [lat, lon] },
            properties: {
              iconCaption: iconCap,
              hintContent: hintText,
              balloonContent: balloonText,
              ...p.properties,
            },
          },
        ];
      }
    );

    return { type: "FeatureCollection", features: list };
  }, [points, fiasCodes, resolvedPoints, fiasOwners]);

  const omOptions = useMemo(
    () => ({
      clusterize: zoom < 18, // Полностью отключаем кластеризацию при сильном приближении
      gridSize: zoom > 16 ? 1 : zoom > 12 ? 32 : 64,
      clusterDisableClickZoom: false,
      clusterOpenBalloonOnClick: true,
      ...clusterOptions,
    }),
    [zoom, clusterOptions]
  );

  const omObjects = {
    preset: "islands#blueCircleDotIconWithCaption",
    openBalloonOnClick: true,
    ...objectOptions,
  };

  const omClusters = {
    preset: "islands#invertedBlueClusterIcons",
    clusterNumbers: [10, 50, 100],
  };

  const modules = [
    "objectManager.addon.objectsHint",
    "objectManager.addon.objectsBalloon",
    "objectManager.addon.clustersBalloon",
  ];

  const shownCount = features.features.length;

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <YMaps query={{ lang: "ru_RU", load: "package.full" }}>
        <YMap
          state={initialState}
          options={{
            suppressMapOpenBlock: true,
            yandexMapDisablePoiInteractivity: true,
          }}
          width="100%"
          height={height}
          onLoad={(ymaps) => console.log("[MapPanel] ymaps loaded:", !!ymaps)}
          instanceRef={(ref) => (mapRef.current = ref)}
          onBoundsChange={(e) => setZoom(e.get("newZoom"))}
        >
          <ObjectManager
            key={`om-${zoom}-${shownCount}`}
            options={omOptions}
            objects={omObjects}
            clusters={omClusters}
            modules={modules}
            features={features}
            instanceRef={(ref) => (omRef.current = ref)}
          />
        </YMap>
      </YMaps>
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
