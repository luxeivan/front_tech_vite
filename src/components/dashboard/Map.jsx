import React, { useMemo, useEffect, useState, useRef } from "react";
import { YMaps, Map as YMap, ObjectManager } from "@pbe/react-yandex-maps";

export default function MapPanel({
  height = "100%",
  initialState = { center: [55.751244, 37.618423], zoom: 8 },
  // если передали готовые точки — нарисуем их как раньше
  points = [],
  // НОВОЕ: список ФИАС, который надо пробить в координаты
  fiasCodes = [],
  // НОВОЕ: backend и коллекция для Strapi поиска
  url,
  fiasCollection,
  objectOptions = {},
  clusterOptions = {},
}) {
  /* ---------------- helpers (FIAS -> coords via Strapi) ---------------- */
  const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

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

  const cacheRef = useRef(new Map()); // fias -> {lat, lon}
  const abortRef = useRef(null);
  const [resolvedPoints, setResolvedPoints] = useState([]);

  // Пробиваем ФИАС в координаты (если они переданы)
  useEffect(() => {
    if (!Array.isArray(fiasCodes) || fiasCodes.length === 0) {
      setResolvedPoints([]);
      return;
    }
    if (!url || !fiasCollection) {
      setResolvedPoints([]);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const uniq = Array.from(new Set(fiasCodes.filter(Boolean)));
    const cache = cacheRef.current;

    // что уже есть в кэше — отрисуем сразу
    const initial = uniq
      .filter((c) => cache.has(c))
      .map((c) => ({ id: c, ...cache.get(c) }));
    setResolvedPoints(initial);

    const toResolve = uniq.filter((c) => !cache.has(c));
    if (!toResolve.length) return;

    const BATCH_SIZE = 100;
    const CONCURRENCY = 4;
    const batches = chunk(toResolve, BATCH_SIZE);

    const loadBatch = async (batch) => {
      const query = encodeStrapiQuery({
        ...buildInParams("fiasId", batch),
        "pagination[page]": 1,
        "pagination[pageSize]": BATCH_SIZE,
        fields: [
          "fiasId",
          "lat",
          "lon",
          "latitude",
          "longitude",
          "geo_lat",
          "geo_lon",
        ],
      });

      const resp = await fetch(`${url}/api/${fiasCollection}?${query}`, {
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
        if (fias && ll) {
          cache.set(fias, ll);
          out.push({ id: fias, ...ll });
        }
      }
      return out;
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
            setResolvedPoints([...collected]);
          })
          .catch(() => {})
          .finally(() => {
            active--;
            if (idx < batches.length) pump();
          });
      }
    };

    pump();
    return () => ac.abort();
  }, [fiasCodes, url, fiasCollection]);

  /* ---------------- points -> features ---------------- */
  const features = useMemo(() => {
    // Если дали ФИАС — используем пробитые точки, иначе — переданные points
    const sourcePoints =
      Array.isArray(fiasCodes) && fiasCodes.length ? resolvedPoints : points;

    const toCoords = (p) => {
      if (Array.isArray(p.coordinates)) return p.coordinates;
      if (Array.isArray(p.coords)) return p.coords;
      if (typeof p.lat === "number" && typeof p.lon === "number")
        return [p.lat, p.lon];
      if (typeof p.latitude === "number" && typeof p.longitude === "number")
        return [p.latitude, p.longitude];
      return null;
    };

    const list = (Array.isArray(sourcePoints) ? sourcePoints : []).flatMap(
      (p, i) => {
        const coords = toCoords(p);
        if (!coords || coords.length !== 2) return [];
        const [lat, lon] = coords;
        return [
          {
            type: "Feature",
            id: p.id ?? p.fias ?? i,
            geometry: { type: "Point", coordinates: [lon, lat] },
            properties: {
              iconCaption: p.iconCaption ?? p.caption ?? "",
              hintContent: p.hintContent ?? p.caption ?? "",
              balloonContent: p.balloonContent ?? "",
              ...p.properties,
            },
          },
        ];
      }
    );

    return { type: "FeatureCollection", features: list };
  }, [points, fiasCodes, resolvedPoints]);

  const omOptions = {
    clusterize: true,
    gridSize: 64,
    clusterDisableClickZoom: false,
    clusterOpenBalloonOnClick: false,
    ...clusterOptions,
  };

  const omObjects = {
    preset: "islands#blueCircleDotIconWithCaption",
    openBalloonOnClick: false,
    ...objectOptions,
  };

  const omClusters = { preset: "islands#invertedVioletClusterIcons" };

  const modules = [
    "objectManager.addon.objectsHint",
    "objectManager.addon.objectsBalloon",
    "objectManager.addon.clustersBalloon",
  ];

  return (
    <YMaps enterprise={false}>
      <YMap
        state={initialState}
        options={{
          suppressMapOpenBlock: true,
          yandexMapDisablePoiInteractivity: true,
        }}
        width="100%"
        height={height}
      >
        <ObjectManager
          options={omOptions}
          objects={omObjects}
          clusters={omClusters}
          modules={modules}
          defaultFeatures={features}
          features={features}
        />
      </YMap>
    </YMaps>
  );
}
