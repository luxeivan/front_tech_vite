

import React, { useMemo } from "react";
import { YMaps, Map, ObjectManager } from "@pbe/react-yandex-maps";

/**
 * MapPanel – Yandex Map with client-side clustering (variant #2).
 *
 * Props:
 *  - apikey?: string
 *  - height?: number | string (height of the <Map />)
 *  - initialState?: { center: number[]; zoom: number }
 *  - points?: Array&lt;{
 *      id?: string|number,
 *      lat?: number, lon?: number,        // or latitude/longitude
 *      latitude?: number, longitude?: number,
 *      coordinates?: [number, number],    // [lat, lon]
 *      caption?: string, iconCaption?: string,
 *      hintContent?: string, balloonContent?: string,
 *      properties?: Record&lt;string, any&gt;
 *    }&gt;
 *  - objectOptions?: Record&lt;string, any&gt;  // styling for single markers
 *  - clusterOptions?: Record&lt;string, any&gt; // styling/behavior for clusters
 */
export default function MapPanel({
  apikey,
  height = "100%",
  initialState = { center: [55.751244, 37.618423], zoom: 8 },
  points = [],
  objectOptions = {},
  clusterOptions = {},
}) {
  const features = useMemo(() => {
    const toCoords = (p) => {
      if (Array.isArray(p.coordinates)) return p.coordinates;
      if (Array.isArray(p.coords)) return p.coords;
      if (typeof p.lat === "number" && typeof p.lon === "number")
        return [p.lat, p.lon];
      if (
        typeof p.latitude === "number" &&
        typeof p.longitude === "number"
      )
        return [p.latitude, p.longitude];
      return null;
    };

    const list = (Array.isArray(points) ? points : []).flatMap((p, i) => {
      const coords = toCoords(p);
      if (!coords || coords.length !== 2) return [];
      const [lat, lon] = coords; // Yandex uses [lat, lon]
      return [
        {
          type: "Feature",
          id: p.id ?? i,
          geometry: { type: "Point", coordinates: [lat, lon] },
          properties: {
            // single marker caption (shows near icon)
            iconCaption: p.iconCaption ?? p.caption ?? "",
            hintContent: p.hintContent ?? p.caption ?? "",
            balloonContent: p.balloonContent ?? "",
            ...p.properties,
          },
        },
      ];
    });

    return { type: "FeatureCollection", features: list };
  }, [points]);

  const omOptions = {
    clusterize: true,
    gridSize: 64, // smaller grid -> more clusters, larger -> fewer clusters
    clusterDisableClickZoom: false,
    clusterOpenBalloonOnClick: false,
    // Default cluster appearance; we can fine‑tune later
    // You may also try: 'islands#blueClusterIcons'
    // or pie chart: clusterIconLayout: 'default#pieChart'
    ...clusterOptions,
  };

  const omObjects = {
    // style for individual markers
    preset: "islands#blueCircleDotIconWithCaption",
    openBalloonOnClick: false,
    ...objectOptions,
  };

  const omClusters = {
    preset: "islands#invertedVioletClusterIcons",
  };

  // Modules to enable hints/balloons for both objects and clusters
  const modules = [
    "objectManager.addon.objectsHint",
    "objectManager.addon.objectsBalloon",
    "objectManager.addon.clustersBalloon",
  ];

  const ymapsQuery = apikey
    ? { apikey, lang: "ru_RU", load: "package.full" }
    : { lang: "ru_RU", load: "package.full" };

  return (
    <YMaps query={ymapsQuery}>
      <Map
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
          // pass features both as default and controlled for reliable updates
          defaultFeatures={features}
          features={features}
        />
      </Map>
    </YMaps>
  );
}