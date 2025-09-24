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
  tnByFias = {},
}) {
  const [zoom, setZoom] = useState(initialState?.zoom ?? 8);

  // Отладка (РУ): какие пропсы пришли
  useEffect(() => {
    console.log("[Карта] Принял пропсы:", {
      количествоТочек: points.length,
      количествоФИАС: fiasCodes.length,
      примерФИАС: fiasCodes.slice(0, 5),
      url,
      коллекция: fiasCollection,
    });
  }, [points, fiasCodes, url, fiasCollection]);

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

  // Пробиваем ФИАС в координаты (если они переданы)
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
    // console.log("[MapPanel] Building features...");

    // Если переданы fiasCodes, но resolvedPoints еще не загружены, не показываем ничего
    if (fiasCodes.length > 0 && resolvedPoints.length === 0) {
      console.log("[MapPanel] FIAS codes provided but no resolved points yet");
      return { type: "FeatureCollection", features: [] };
    }

    const sourcePoints = fiasCodes.length > 0 ? resolvedPoints : points;
    // console.log("[MapPanel] Using source points:", sourcePoints.length);

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
        return [
          {
            type: "Feature",
            id: p.id ?? p.fias ?? i,
            geometry: { type: "Point", coordinates: [lat, lon] },
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

    // console.log("[MapPanel] Final features count:", list.length);
    return { type: "FeatureCollection", features: list };
  }, [points, fiasCodes, resolvedPoints]);

  useEffect(() => {
    console.log(
      "[MapPanel] Current state:",
      "fiasCodes:",
      fiasCodes.length,
      "resolvedPoints:",
      resolvedPoints.length,
      "features:",
      features?.features?.length || 0
    );
  }, [features, fiasCodes, resolvedPoints]);

  useEffect(() => {
    if (fittedRef.current) return;
    try {
      if (!mapRef.current) return;
      const pts = resolvedPoints;
      if (!pts || !pts.length) return;
      const lats = pts
        .map((p) => (typeof p.lat === "number" ? p.lat : parseFloat(p.lat)))
        .filter((v) => Number.isFinite(v));
      const lons = pts
        .map((p) => (typeof p.lon === "number" ? p.lon : parseFloat(p.lon)))
        .filter((v) => Number.isFinite(v));
      if (!lats.length || !lons.length) return;
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      if ([minLat, maxLat, minLon, maxLon].every(Number.isFinite)) {
        mapRef.current.setBounds(
          [
            [minLat, minLon],
            [maxLat, maxLon],
          ],
          { checkZoomRange: true, duration: 300 }
        );
        fittedRef.current = true;
      }
    } catch (_) {}
  }, [resolvedPoints]);

  // Динамические настройки кластеризации в зависимости от зума
  //   const omOptions = useMemo(
  //     () => ({
  //       clusterize: true,
  //       gridSize: zoom > 15 ? 1 : 64, // При сильном приближении отключаем кластеризацию
  //       clusterDisableClickZoom: false,
  //       clusterOpenBalloonOnClick: true,
  //       ...clusterOptions,
  //     }),
  //     [zoom, clusterOptions]
  //   );

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

  // Аналитика совпадений координат + привязка к ТН (РУ)
  useEffect(() => {
    const feats = features?.features || [];
    if (!feats.length) return;

    const groups = new Map(); // key: "lon,lat" -> { coords, fias: [] }
    feats.forEach((f) => {
      const key = (f?.geometry?.coordinates || []).join(",");
      const id = f?.id != null ? String(f.id) : null; // ожидаем, что id = FIAS
      if (!key) return;
      if (!groups.has(key)) groups.set(key, { coords: f.geometry.coordinates, fias: [] });
      if (id) groups.get(key).fias.push(id);
    });

    const duplicateGroups = Array.from(groups.values()).filter((g) => g.fias.length > 1);

    console.log(`[Карта] Уникальных координат: ${groups.size}`);
    console.log(`[Карта] Групп с совпадающими координатами: ${duplicateGroups.length}`);

    if (!duplicateGroups.length) return;

    console.groupCollapsed(`[Карта] Детализация совпадений координат (${duplicateGroups.length} групп)`);
    duplicateGroups.forEach((g, idx) => {
      console.log(`— Группа ${idx + 1}: [${g.coords[0]}, ${g.coords[1]}] — совпали ${g.fias.length} FIAS`);
      const rows = g.fias.map((fias) => {
        const list = Array.isArray(tnByFias?.[fias]) ? tnByFias[fias] : [];
        const tnText = list
          .map((t) => `№${t?.number ?? "—"} (${t?.guid ?? "—"})`)
          .join("; ");
        return { FIAS: fias, ТН: tnText || "—" };
      });
      if (rows.length) console.table(rows);
    });
    console.groupEnd();
  }, [features, tnByFias]);

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
            key={`om-${zoom}-${shownCount}`} // Принудительное обновление при изменении зума или количества точек
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

// import React, { useMemo, useEffect, useState, useRef } from "react";
// import { YMaps, Map as YMap, ObjectManager } from "@pbe/react-yandex-maps";

// export default function MapPanel({
//   height = "100%",
//   initialState = { center: [55.751244, 37.618423], zoom: 8 },
//   points = [],
//   fiasCodes = [],
//   url,
//   fiasCollection = "adress",
//   objectOptions = {},
//   clusterOptions = {},
// }) {
//   const [zoom, setZoom] = useState(initialState?.zoom ?? 8);

//   const buildInParams = (field, values) => {
//     const params = {};
//     params[`filters[${field}][$in]`] = values;
//     return params;
//   };

//   const encodeStrapiQuery = (params) => {
//     const parts = [];
//     const push = (k, v) =>
//       parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
//     for (const [key, value] of Object.entries(params)) {
//       if (Array.isArray(value))
//         value.forEach((v, i) => push(`${key}[${i}]`, v));
//       else push(key, value);
//     }
//     return parts.join("&");
//   };

//   const pickLatLon = (obj) => {
//     if (!obj) return null;
//     const a = obj.attributes ? obj.attributes : obj;
//     const latRaw =
//       a.lat ??
//       a.latitude ??
//       a.geo_lat ??
//       a.geoLat ??
//       (Array.isArray(a?.coords) ? a.coords[0] : undefined);
//     const lonRaw =
//       a.lon ??
//       a.longitude ??
//       a.geo_lon ??
//       a.geoLon ??
//       (Array.isArray(a?.coords) ? a.coords[1] : undefined);
//     const lat = typeof latRaw === "number" ? latRaw : parseFloat(latRaw);
//     const lon = typeof lonRaw === "number" ? lonRaw : parseFloat(lonRaw);
//     if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
//     return null;
//   };

//   const cacheRef = useRef(new Map());
//   const abortRef = useRef(null);
//   const omRef = useRef(null);
//   const mapRef = useRef(null);
//   const fittedRef = useRef(false);
//   const [resolvedPoints, setResolvedPoints] = useState([]);

//   // Пробиваем ФИАС в координаты (если они переданы)
//   useEffect(() => {
//     if (!Array.isArray(fiasCodes) || fiasCodes.length === 0) {
//       setResolvedPoints([]);
//       return;
//     }
//     if (!url || !fiasCollection) {
//       setResolvedPoints([]);
//       return;
//     }

//     if (abortRef.current) abortRef.current.abort();
//     const ac = new AbortController();
//     abortRef.current = ac;

//     const uniq = Array.from(new Set(fiasCodes.filter(Boolean)));
//     const cache = cacheRef.current;

//     // что уже есть в кэше — отрисуем сразу
//     const initial = uniq
//       .filter((c) => cache.has(c))
//       .map((c) => ({ id: c, ...cache.get(c) }));
//     setResolvedPoints(initial);

//     const toResolve = uniq.filter((c) => !cache.has(c));
//     if (!toResolve.length) return;

//     const CONCURRENCY = 4;

//     const BASE = String(url).replace(/\/$/, "");
//     const MAX_URL_LEN = 1800; // безопасный лимит для большинства прокси

//     const buildQuery = (ids) =>
//       encodeStrapiQuery({
//         ...buildInParams("fiasId", ids),
//         "pagination[page]": 1,
//         "pagination[pageSize]": Math.min(ids.length, 100),
//         fields: ["fiasId", "lat", "lon"],
//       });
//     const buildUrl = (ids) =>
//       `${BASE}/api/${fiasCollection}?${buildQuery(ids)}`;
//     let innerSize = Math.min(50, toResolve.length || 50);
//     while (
//       innerSize > 1 &&
//       buildUrl(toResolve.slice(0, innerSize)).length > MAX_URL_LEN
//     ) {
//       innerSize = Math.max(1, Math.floor(innerSize * 0.7));
//     }

//     const batches = [];
//     for (let i = 0; i < toResolve.length; i += innerSize) {
//       batches.push(toResolve.slice(i, i + innerSize));
//     }

//     const loadBatch = async (batch) => {
//       const urlStr = buildUrl(batch);
//       const resp = await fetch(urlStr, {
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem("jwt") || ""}`,
//         },
//         signal: ac.signal,
//       });
//       if (!resp.ok) throw new Error(`FIAS lookup failed: ${resp.status}`);

//       const json = await resp.json();
//       console.log(
//         "[MapPanel] fetched batch from Strapi:",
//         Array.isArray(json?.data) ? json.data.length : 0
//       );
//       const arr = Array.isArray(json?.data) ? json.data : [];
//       const out = [];
//       for (const item of arr) {
//         const a = item?.attributes ? item.attributes : item;
//         const fias = a.fiasId || a.fias || a.FIAS || a.fias_code || a.FIAS_CODE;
//         const ll = pickLatLon(a);
//         if (fias && ll) {
//           cache.set(fias, ll);
//           out.push({ id: fias, ...ll });
//         }
//       }
//       return out;
//     };

//     let idx = 0;
//     let active = 0;
//     const collected = [...initial];

//     const pump = () => {
//       if (ac.signal.aborted) return;
//       while (active < CONCURRENCY && idx < batches.length) {
//         const b = batches[idx++];
//         active++;
//         loadBatch(b)
//           .then((pts) => {
//             if (ac.signal.aborted) return;
//             pts.forEach((p) => collected.push(p));
//             setResolvedPoints([...collected]);
//           })
//           .catch(() => {})
//           .finally(() => {
//             active--;
//             if (idx < batches.length) pump();
//           });
//       }
//     };

//     pump();
//     return () => ac.abort();
//   }, [fiasCodes, url, fiasCollection]);

//   const features = useMemo(() => {
//     const sourcePoints =
//       Array.isArray(fiasCodes) && fiasCodes.length ? resolvedPoints : points;

//     const toCoords = (p) => {
//       if (Array.isArray(p.coordinates) && p.coordinates.length === 2)
//         return p.coordinates;
//       if (Array.isArray(p.coords) && p.coords.length === 2) return p.coords;

//       if (p.lat != null && p.lon != null) {
//         const lat = typeof p.lat === "number" ? p.lat : parseFloat(p.lat);
//         const lon = typeof p.lon === "number" ? p.lon : parseFloat(p.lon);
//         if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
//       }
//       if (p.latitude != null && p.longitude != null) {
//         const lat =
//           typeof p.latitude === "number" ? p.latitude : parseFloat(p.latitude);
//         const lon =
//           typeof p.longitude === "number"
//             ? p.longitude
//             : parseFloat(p.longitude);
//         if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
//       }
//       return null;
//     };

//     const list = (Array.isArray(sourcePoints) ? sourcePoints : []).flatMap(
//       (p, i) => {
//         const coords = toCoords(p);
//         if (!coords || coords.length !== 2) return [];
//         const [lat, lon] = coords;
//         return [
//           {
//             type: "Feature",
//             id: p.id ?? p.fias ?? i,
//             geometry: { type: "Point", coordinates: [lat, lon] }, // Yandex expects [lat, lon]
//             properties: {
//               iconCaption: p.iconCaption ?? p.caption ?? "",
//               hintContent: p.hintContent ?? p.caption ?? "",
//               balloonContent: p.balloonContent ?? "",
//               ...p.properties,
//             },
//           },
//         ];
//       }
//     );

//     return { type: "FeatureCollection", features: list };
//   }, [points, fiasCodes, resolvedPoints]);

//   useEffect(() => {
//     console.log(
//       "[MapPanel] fiasCodes:",
//       Array.isArray(fiasCodes) ? fiasCodes.length : 0
//     );
//     console.log(
//       "[MapPanel] resolvedPoints:",
//       resolvedPoints.length,
//       resolvedPoints.slice(0, 10)
//     );
//     console.log(
//       "[MapPanel] features to draw:",
//       features?.features?.length || 0
//     );
//   }, [features, fiasCodes, resolvedPoints]);

//   useEffect(() => {
//     if (fittedRef.current) return;
//     try {
//       if (!mapRef.current) return;
//       const pts = resolvedPoints;
//       if (!pts || !pts.length) return;
//       const lats = pts
//         .map((p) => (typeof p.lat === "number" ? p.lat : parseFloat(p.lat)))
//         .filter((v) => Number.isFinite(v));
//       const lons = pts
//         .map((p) => (typeof p.lon === "number" ? p.lon : parseFloat(p.lon)))
//         .filter((v) => Number.isFinite(v));
//       if (!lats.length || !lons.length) return;
//       const minLat = Math.min(...lats);
//       const maxLat = Math.max(...lats);
//       const minLon = Math.min(...lons);
//       const maxLon = Math.max(...lons);
//       if ([minLat, maxLat, minLon, maxLon].every(Number.isFinite)) {
//         mapRef.current.setBounds(
//           [
//             [minLat, minLon],
//             [maxLat, maxLon],
//           ],
//           { checkZoomRange: true, duration: 300 }
//         );
//         fittedRef.current = true;
//       }
//     } catch (_) {}
//   }, [resolvedPoints]);

//   const omOptions = {
//     clusterize: true,
//     gridSize: 64,
//     clusterDisableClickZoom: false,
//     clusterOpenBalloonOnClick: false,
//     ...clusterOptions,
//   };

//   const omObjects = {
//     preset: "islands#blueCircleDotIconWithCaption",
//     openBalloonOnClick: false,
//     ...objectOptions,
//   };

//   const omClusters = { preset: "islands#invertedBlueClusterIcons" };

//   const modules = [
//     "objectManager.addon.objectsHint",
//     "objectManager.addon.objectsBalloon",
//     "objectManager.addon.clustersBalloon",
//   ];

//   const shownCount = features.features.length;

//   return (
//     <div style={{ position: "relative", width: "100%", height }}>
//       <YMaps query={{ lang: "ru_RU", load: "package.full" }}>
//         <YMap
//           state={initialState}
//           options={{
//             suppressMapOpenBlock: true,
//             yandexMapDisablePoiInteractivity: true,
//           }}
//           width="100%"
//           height={height}
//           onLoad={(ymaps) => console.log("[MapPanel] ymaps loaded:", !!ymaps)}
//           //   instanceRef={(ref) => (mapRef.current = ref)}
//           onBoundsChange={(e) => setZoom(e.get("newZoom"))}
//         >
//           <ObjectManager
//             options={omOptions}
//             objects={omObjects}
//             clusters={omClusters}
//             modules={modules}
//             features={features}
//             instanceRef={(ref) => (omRef.current = ref)}
//           />
//         </YMap>
//       </YMaps>
//       <div
//         style={{
//           position: "absolute",
//           bottom: 6,
//           right: 10,
//           fontSize: 12,
//           opacity: 0.75,
//         }}
//       >
//         Точек на карте: {shownCount}
//       </div>
//     </div>
//   );
// }
