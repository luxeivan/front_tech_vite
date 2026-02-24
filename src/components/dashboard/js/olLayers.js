import OlMap from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import { fromLonLat } from "ol/proj";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import Cluster from "ol/source/Cluster";
import Overlay from "ol/Overlay";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { Icon, Style } from "ol/style";
import Text from "ol/style/Text";
import CircleStyle from "ol/style/Circle";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import { containsCoordinate } from "ol/extent";

export function createBaseLayers({ onProviderError } = {}) {
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
        url: `https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png${
          import.meta.env.VITE_STADIA_KEY
            ? "?api_key=" + import.meta.env.VITE_STADIA_KEY
            : ""
        }`,
        crossOrigin: "anonymous",
        attributions:
          "Map © Stadia Maps, © Stamen • Data © OpenStreetMap contributors",
      }),
      visible: false,
    }),
    openTopoMap: new TileLayer({
      source: new XYZ({
        url: "https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png",
        crossOrigin: "anonymous",
        attributions: "© OpenTopoMap (CC-BY-SA) • © OpenStreetMap contributors",
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

  const disposers = [];

  const hookTileErrors = (key) => {
    const src = baseLayers[key]?.getSource?.();
    if (!src) return;

    const onErr = () => {
      try {
        onProviderError?.(key);
      } catch (_) {}
    };

    src.on("tileloaderror", onErr);
    src.on("imageloaderror", onErr);

    disposers.push(() => {
      try {
        src.un("tileloaderror", onErr);
        src.un("imageloaderror", onErr);
      } catch (_) {}
    });
  };

  hookTileErrors("stamenTerrain");
  hookTileErrors("openTopoMap");

  return {
    baseLayers,
    cleanup: () => {
      disposers.forEach((fn) => {
        try {
          fn();
        } catch (_) {}
      });
    },
  };
}

export function setActiveBaseLayer(baseLayers, activeKey) {
  if (!baseLayers) return;
  Object.keys(baseLayers).forEach((k) => {
    baseLayers[k]?.setVisible?.(k === activeKey);
  });
}

export function createPopupOverlay() {
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

  const contentEl = document.createElement("div");
  container.appendChild(contentEl);
  container.appendChild(closer);

  const overlay = new Overlay({
    element: container,
    positioning: "bottom-center",
    stopEvent: false,
    offset: [0, -10],
  });

  const onClose = (e) => {
    e.stopPropagation();
    overlay.setPosition(undefined);
    return false;
  };
  closer.addEventListener("click", onClose);

  return {
    overlay,
    contentEl,
    dispose: () => {
      try {
        closer.removeEventListener("click", onClose);
      } catch (_) {}
    },
  };
}

export function createView({ initialState }) {
  const lat = initialState?.center?.[0] ?? 55.751244;
  const lon = initialState?.center?.[1] ?? 37.618423;

  return new View({
    center: fromLonLat([lon, lat]),
    zoom: initialState?.zoom ?? 8,
    maxZoom: 19,
    minZoom: 5,
  });
}

export function createOlMap({
  target,
  baseLayers,
  view,
  overlays = [],
  layers = [],
}) {
  return new OlMap({
    target,
    layers: [...Object.values(baseLayers || {}), ...(layers || [])],
    overlays,
    view,
    controls: [], 
  });
}


export function createTpLayer({
  tpNashe,
  tpNeNashe,
  getZoom,
  getFallbackZoom,
}) {
  const tpSource = new VectorSource();

  const tpCluster = new Cluster({
    distance: 40, // px
    source: tpSource,
  });

  const tpLayer = new VectorLayer({
    source: tpCluster,
    declutter: true,
    style: (feature) => {
      const z =
        (typeof getZoom === "function" ? getZoom() : null) ??
        getFallbackZoom?.() ??
        8;
      if (z < 12) return null;

      const clustered = feature.get("features");
      const base =
        Array.isArray(clustered) && clustered.length ? clustered[0] : feature;

      const property = (base.get("property") || "").toString();
      const prop = property.toLowerCase();
      const isLease = prop.includes("аренд"); // аренда -> зелёная (наша)
      const isExternal = prop.includes("сторон"); // сторонняя -> синяя (не наша)
      const isOur = /мособлэнерго/.test(prop) || isLease;
      const iconSrc = isOur ? tpNashe : tpNeNashe;

      // Примерный автоскейл иконки под зум
      let scale;
      if (z < 13) scale = 0.003;
      else if (z < 14) scale = 0.00375;
      else if (z < 15) scale = 0.0045;
      else if (z < 16) scale = 0.00525;
      else if (z < 17) scale = 0.006;
      else scale = 0.007;

      const iconScale = scale * 6.6;

      const nameText =
        (base && typeof base.get === "function" && (base.get("name") || "")) ||
        "";

      const showLabel = z >= 14;

      return new Style({
        image: new Icon({
          src: iconSrc,
          scale: iconScale,
          opacity: 0.65,
          anchor: [0.5, 1],
          anchorXUnits: "fraction",
          anchorYUnits: "fraction",
        }),
        text: showLabel
          ? new Text({
              text: nameText,
              font: "600 12px system-ui, sans-serif",
              fill: new Fill({ color: "#001529" }),
              stroke: new Stroke({ color: "#ffffff", width: 3 }),
              textAlign: "left",
              textBaseline: "middle",
              offsetX: 18,
              offsetY: -12,
            })
          : undefined,
      });
    },
  });

  return { tpSource, tpLayer };
}

/**
 * Accidents layer (cluster + circles)
 */
export function createAccLayer({ getZoom, getFallbackZoom }) {
  const accSource = new VectorSource();

  const accCluster = new Cluster({
    distance: 60, // px
    source: accSource,
  });

  const cache = {};

  const accLayer = new VectorLayer({
    source: accCluster,
    style: (feature) => {
      const z =
        (typeof getZoom === "function" ? getZoom() : null) ??
        getFallbackZoom?.() ??
        8;
      const members = feature.get("features");
      const count = Array.isArray(members) ? members.length : 1;

      if (count > 1 && z <= 12) {
        const key = `c:${count}`;
        if (!cache[key]) {
          const radius = Math.min(28, 10 + Math.log2(count + 1) * 5);
          cache[key] = new Style({
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
        return cache[key];
      }

      let r;
      if (z < 10) r = 5;
      else if (z < 12) r = 7;
      else if (z < 14) r = 9;
      else if (z < 16) r = 11;
      else r = 13;

      const key = `p:${r}`;
      if (!cache[key]) {
        cache[key] = new Style({
          image: new CircleStyle({
            radius: r,
            fill: new Fill({ color: "#1677ff" }),
            stroke: new Stroke({ color: "#ffffff", width: 2 }),
          }),
        });
      }
      return cache[key];
    },
  });

  return { accSource, accLayer };
}

/**
 * Click -> popup logic (clusters + single feature)
 */
export function attachMapClickPopup({ map, view, overlay, overlayContentEl }) {
  if (!map || !view || !overlay) return { detach: () => {} };

  const onClick = (evt) => {
    const f = map.forEachFeatureAtPixel(evt.pixel, (feat) => feat);
    if (!f) {
      overlay.setPosition(undefined);
      return;
    }

    const members = f && f.get && f.get("features");
    if (Array.isArray(members) && members.length > 1) {
      // чуть зумим в кластер
      const current = view.getZoom?.() ?? 10;
      view.setZoom?.(current + 1);
    }

    const clustered = f.get("features");
    if (Array.isArray(clustered) && clustered.length > 1) {
      if (overlayContentEl) {
        overlayContentEl.innerHTML = `<div><b>Кластер:</b> ${clustered.length} шт</div>`;
      }
      overlay.setPosition(evt.coordinate);
      return;
    }

    const base =
      Array.isArray(clustered) && clustered.length ? clustered[0] : f;
    const props = base.getProperties?.() || {};
    const html = props._popupHtml || props.name || "—";

    if (overlayContentEl) overlayContentEl.innerHTML = html;
    overlay.setPosition(evt.coordinate);
  };

  map.on("click", onClick);

  return {
    detach: () => {
      try {
        map.un("click", onClick);
      } catch (_) {}
    },
  };
}

/**
 * TP index builder (from tp.json)
 */
export function buildTpIndex(arrTp) {
  const raw = Array.isArray(arrTp?.features) ? arrTp.features : [];
  const idx = [];

  for (const item of raw) {
    const props = item?.properties || {};
    const name = props["Наименование подстанции"] || props.name || "ТП";
    const lon = Number(props?.x);
    const lat = Number(props?.y);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;

    const xy = fromLonLat([lon, lat]); // 3857
    const type = props["Тип подстанции"] || "";
    const zone = props["Зона ответственности"] || "";
    const property = props["Вид собственности"] || "";

    idx.push({ xy, lon, lat, name, type, zone, property });
  }

  return idx;
}

/**
 * TP viewport loader (lazy features in current view extent)
 */
export function createTpViewportUpdater({
  map,
  view,
  tpSource,
  tpIndex,
  zoomOn = 11,
  maxPoints = 5000,
} = {}) {
  if (!map || !view || !tpSource) {
    return {
      update: () => {},
      bind: () => {},
      unbind: () => {},
    };
  }

  const update = () => {
    const z = view.getZoom?.();
    if (typeof z === "number" && z < zoomOn) {
      tpSource.clear(true);
      return;
    }

    const size = map.getSize?.();
    if (!size) return;

    const extent = view.calculateExtent(size);
    const selected = [];

    const list = Array.isArray(tpIndex) ? tpIndex : [];
    for (const it of list) {
      if (containsCoordinate(extent, it.xy)) selected.push(it);
    }

    let stride = 1;
    if (selected.length > maxPoints) {
      stride = Math.ceil(selected.length / maxPoints);
    }

    const feats = [];
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
          <br/>Коорд.: ${Number.isFinite(it.lat) ? it.lat.toFixed(6) : "—"}, ${
            Number.isFinite(it.lon) ? it.lon.toFixed(6) : "—"
          }
        </div>`,
      );

      feats.push(f);
    }

    tpSource.clear(true);
    tpSource.addFeatures(feats);
  };

  const onMoveEnd = () => update();
  const onRes = () => update();

  const bind = () => {
    try {
      map.on("moveend", onMoveEnd);
    } catch (_) {}
    try {
      view.on("change:resolution", onRes);
    } catch (_) {}
  };

  const unbind = () => {
    try {
      map.un("moveend", onMoveEnd);
    } catch (_) {}
    try {
      view.un("change:resolution", onRes);
    } catch (_) {}
  };

  return { update, bind, unbind };
}

/**
 * Accident points -> features helper
 */
export function setAccidentFeatures(accSource, accidentPoints) {
  if (!accSource) return;

  const feats = [];
  const list = Array.isArray(accidentPoints) ? accidentPoints : [];

  for (const p of list) {
    if (!Number.isFinite(p?.lon) || !Number.isFinite(p?.lat)) continue;

    const feature = new Feature({
      geometry: new Point(fromLonLat([p.lon, p.lat])),
    });
    if (p.popupHtml) feature.set("_popupHtml", p.popupHtml);
    feats.push(feature);
  }

  accSource.clear(true);
  accSource.addFeatures(feats);
}

// import OlMap from "ol/Map";
// import View from "ol/View";

// import TileLayer from "ol/layer/Tile";
// import VectorLayer from "ol/layer/Vector";

// import OSM from "ol/source/OSM";
// import XYZ from "ol/source/XYZ";
// import VectorSource from "ol/source/Vector";
// import Cluster from "ol/source/Cluster";

// import Feature from "ol/Feature";
// import Point from "ol/geom/Point";

// import Overlay from "ol/Overlay";
// import { fromLonLat } from "ol/proj";
// import { containsCoordinate } from "ol/extent";

// import { Icon, Style } from "ol/style";
// import Text from "ol/style/Text";
// import CircleStyle from "ol/style/Circle";
// import Fill from "ol/style/Fill";
// import Stroke from "ol/style/Stroke";

// import { unByKey } from "ol/Observable";

// /**
//  * Подложки (base layers) + авто-фолбэк на OSM при ошибках провайдера
//  */
// export function createBaseLayers({ onProviderError } = {}) {
//   const baseLayers = {
//     osm: new TileLayer({
//       source: new OSM(),
//       visible: false,
//     }),
//     cartoLight: new TileLayer({
//       source: new XYZ({
//         url: "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
//       }),
//       visible: false,
//     }),
//     cartoDark: new TileLayer({
//       source: new XYZ({
//         url: "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
//       }),
//       visible: false,
//     }),
//     stamenTerrain: new TileLayer({
//       source: new XYZ({
//         url: `https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png${
//           import.meta.env.VITE_STADIA_KEY
//             ? "?api_key=" + import.meta.env.VITE_STADIA_KEY
//             : ""
//         }`,
//         crossOrigin: "anonymous",
//         attributions:
//           "Map © Stadia Maps, © Stamen • Data © OpenStreetMap contributors",
//       }),
//       visible: false,
//     }),
//     openTopoMap: new TileLayer({
//       source: new XYZ({
//         url: "https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png",
//         crossOrigin: "anonymous",
//         attributions: "© OpenTopoMap (CC-BY-SA) • © OpenStreetMap contributors",
//       }),
//       visible: false,
//     }),
//     rgis: new TileLayer({
//       source: new XYZ({
//         url: "https://rgis.mosreg.ru/wmts/m10/{z}/{x}/{y}.png",
//       }),
//       visible: false,
//     }),
//     yandex: new TileLayer({
//       source: new XYZ({
//         url: "https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=ru_RU&projection=web_mercator",
//         crossOrigin: "anonymous",
//       }),
//       visible: false,
//     }),
//     gis2: new TileLayer({
//       source: new XYZ({
//         url: "https://tile1.maps.2gis.com/tiles?x={x}&y={y}&z={z}&v=1.1",
//         crossOrigin: "anonymous",
//       }),
//       visible: false,
//     }),
//   };

//   const keys = [];

//   const hookTileErrors = (key) => {
//     const src = baseLayers[key]?.getSource?.();
//     if (!src) return;

//     const onErr = () => {
//       try {
//         onProviderError?.(key);
//       } catch (_) {}
//     };

//     keys.push(src.on("tileloaderror", onErr));
//     keys.push(src.on("imageloaderror", onErr));
//   };

//   // только для тех, где реально бывает падение/лимиты
//   hookTileErrors("stamenTerrain");
//   hookTileErrors("openTopoMap");

//   const cleanup = () => {
//     try {
//       unByKey(keys);
//     } catch (_) {}
//   };

//   return { baseLayers, cleanup };
// }

// export function setActiveBaseLayer(baseLayers, activeKey) {
//   Object.keys(baseLayers || {}).forEach((k) => {
//     baseLayers[k]?.setVisible?.(k === activeKey);
//   });
// }

// export function createPopupOverlay() {
//   const container = document.createElement("div");
//   Object.assign(container.style, {
//     position: "relative",
//     background: "#fff",
//     padding: "8px 12px",
//     borderRadius: "6px",
//     boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
//     minWidth: "160px",
//     maxWidth: "320px",
//     fontSize: "13px",
//     lineHeight: 1.25,
//   });

//   const closer = document.createElement("a");
//   closer.textContent = "×";
//   Object.assign(closer.style, {
//     position: "absolute",
//     top: "4px",
//     right: "8px",
//     cursor: "pointer",
//     color: "#333",
//     textDecoration: "none",
//     fontSize: "16px",
//     fontWeight: "bold",
//   });

//   const contentEl = document.createElement("div");
//   container.appendChild(contentEl);
//   container.appendChild(closer);

//   const overlay = new Overlay({
//     element: container,
//     positioning: "bottom-center",
//     stopEvent: false,
//     offset: [0, -10],
//   });

//   const onClose = (e) => {
//     e.stopPropagation();
//     overlay.setPosition(undefined);
//     return false;
//   };
//   closer.addEventListener("click", onClose);

//   const dispose = () => {
//     try {
//       closer.removeEventListener("click", onClose);
//     } catch (_) {}
//   };

//   return { overlay, container, contentEl, dispose };
// }

// export function createTpLayer({
//   tpNashe,
//   tpNeNashe,
//   getZoom,
//   getFallbackZoom,
// } = {}) {
//   const tpSource = new VectorSource();

//   const tpCluster = new Cluster({
//     distance: 40,
//     source: tpSource,
//   });

//   const tpLayer = new VectorLayer({
//     source: tpCluster,
//     declutter: true,
//     style: (feature) => {
//       const z = (getZoom?.() ?? getFallbackZoom?.() ?? 8);
//       if (z < 12) return null;

//       const clustered = feature.get("features");
//       const base =
//         Array.isArray(clustered) && clustered.length ? clustered[0] : feature;

//       const property = (base.get("property") || "").toString();
//       const prop = property.toLowerCase();
//       const isLease = prop.includes("аренд"); // аренда -> зелёная (наша)
//       const isOur = /мособлэнерго/.test(prop) || isLease;
//       const iconSrc = isOur ? tpNashe : tpNeNashe;

//       let scale;
//       if (z < 13) scale = 0.003;
//       else if (z < 14) scale = 0.00375;
//       else if (z < 15) scale = 0.0045;
//       else if (z < 16) scale = 0.00525;
//       else if (z < 17) scale = 0.006;
//       else scale = 0.007;

//       const iconScale = scale * 6.6;

//       const nameText =
//         (base && typeof base.get === "function" && (base.get("name") || "")) ||
//         "";
//       const showLabel = z >= 14;

//       return new Style({
//         image: new Icon({
//           src: iconSrc,
//           scale: iconScale,
//           anchor: [0.5, 1],
//           anchorXUnits: "fraction",
//           anchorYUnits: "fraction",
//         }),
//         text: showLabel
//           ? new Text({
//               text: nameText,
//               font: "600 12px system-ui, sans-serif",
//               fill: new Fill({ color: "#001529" }),
//               stroke: new Stroke({ color: "#ffffff", width: 3 }),
//               textAlign: "left",
//               textBaseline: "middle",
//               offsetX: 18,
//               offsetY: -12,
//             })
//           : undefined,
//       });
//     },
//   });

//   return { tpSource, tpLayer };
// }

// export function createAccLayer({ getZoom, getFallbackZoom } = {}) {
//   const accSource = new VectorSource();

//   const accCluster = new Cluster({
//     distance: 60,
//     source: accSource,
//   });

//   const cache = {};

//   const accLayer = new VectorLayer({
//     source: accCluster,
//     style: (feature) => {
//       const z = (getZoom?.() ?? getFallbackZoom?.() ?? 8);
//       const members = feature.get("features");
//       const count = Array.isArray(members) ? members.length : 1;

//       if (count > 1 && z <= 12) {
//         const key = `c:${count}`;
//         if (!cache[key]) {
//           const radius = Math.min(28, 10 + Math.log2(count + 1) * 5);
//           cache[key] = new Style({
//             image: new CircleStyle({
//               radius,
//               fill: new Fill({ color: "#1677ff" }),
//               stroke: new Stroke({ color: "#ffffff", width: 3 }),
//             }),
//             text: new Text({
//               text: String(count),
//               fill: new Fill({ color: "#ffffff" }),
//               font: "bold 12px system-ui, sans-serif",
//             }),
//           });
//         }
//         return cache[key];
//       }

//       let r;
//       if (z < 10) r = 5;
//       else if (z < 12) r = 7;
//       else if (z < 14) r = 9;
//       else if (z < 16) r = 11;
//       else r = 13;

//       const key = `p:${r}`;
//       if (!cache[key]) {
//         cache[key] = new Style({
//           image: new CircleStyle({
//             radius: r,
//             fill: new Fill({ color: "#1677ff" }),
//             stroke: new Stroke({ color: "#ffffff", width: 2 }),
//           }),
//         });
//       }
//       return cache[key];
//     },
//   });

//   return { accSource, accLayer };
// }

// export function buildTpIndex(arrTp) {
//   const raw = Array.isArray(arrTp?.features) ? arrTp.features : [];
//   const idx = [];

//   for (const item of raw) {
//     const props = item?.properties || {};
//     const name = props["Наименование подстанции"] || props.name || "ТП";
//     const lon = Number(props?.x);
//     const lat = Number(props?.y);
//     if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;

//     const xy = fromLonLat([lon, lat]);
//     const type = props["Тип подстанции"] || "";
//     const zone = props["Зона ответственности"] || "";
//     const property = props["Вид собственности"] || "";

//     idx.push({ xy, lon, lat, name, type, zone, property });
//   }

//   return idx;
// }

// export function createTpViewportUpdater({
//   map,
//   view,
//   tpSource,
//   tpIndex,
//   zoomOn = 11,
//   maxPoints = 5000,
// } = {}) {
//   const update = () => {
//     if (!map || !view || !tpSource || !Array.isArray(tpIndex)) return;

//     const z = view.getZoom();
//     if (z < zoomOn) {
//       tpSource.clear(true);
//       return;
//     }

//     const extent = view.calculateExtent(map.getSize());
//     const selected = [];
//     for (const it of tpIndex) {
//       if (containsCoordinate(extent, it.xy)) selected.push(it);
//     }

//     let stride = 1;
//     if (selected.length > maxPoints) {
//       stride = Math.ceil(selected.length / maxPoints);
//     }

//     const feats = [];
//     for (let i = 0; i < selected.length; i += stride) {
//       const it = selected[i];
//       const f = new Feature({ geometry: new Point(it.xy) });

//       f.setProperties({
//         name: it.name,
//         type: it.type,
//         zone: it.zone,
//         property: it.property,
//       });

//       f.set(
//         "_popupHtml",
//         `<div><b>${it.name}</b>
//           <br/>Тип: ${it.type || "—"}
//           <br/>Зона: ${it.zone || "—"}
//           <br/>Собственность: ${it.property || "—"}
//           <br/>Коорд.: ${it.lat.toFixed(6)}, ${it.lon.toFixed(6)}
//         </div>`
//       );

//       feats.push(f);
//     }

//     tpSource.clear(true);
//     tpSource.addFeatures(feats);
//   };

//   const onMoveEnd = () => update();
//   const onRes = () => update();

//   const bind = () => {
//     map?.on?.("moveend", onMoveEnd);
//     view?.on?.("change:resolution", onRes);
//   };

//   const unbind = () => {
//     map?.un?.("moveend", onMoveEnd);
//     view?.un?.("change:resolution", onRes);
//   };

//   return { update, bind, unbind };
// }

// export function setAccidentFeatures(accSource, accidentPoints = []) {
//   if (!accSource) return;

//   const feats = [];
//   for (const p of accidentPoints) {
//     const lat = Number(p?.lat);
//     const lon = Number(p?.lon);
//     if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

//     const feature = new Feature({
//       geometry: new Point(fromLonLat([lon, lat])),
//     });
//     if (p?.popupHtml) feature.set("_popupHtml", p.popupHtml);
//     feats.push(feature);
//   }

//   accSource.clear(true);
//   accSource.addFeatures(feats);
// }

// export function attachMapClickPopup({
//   map,
//   view,
//   overlay,
//   overlayContentEl,
// } = {}) {
//   if (!map || !overlay || !overlayContentEl) {
//     return { detach: () => {} };
//   }

//   const handler = (evt) => {
//     const f = map.forEachFeatureAtPixel(evt.pixel, (feat) => feat);
//     if (!f) {
//       overlay.setPosition(undefined);
//       return;
//     }

//     const clustered = f.get("features");

//     // Если кластер — приблизим чуть-чуть, чтобы “раскрылся”
//     if (Array.isArray(clustered) && clustered.length > 1) {
//       const current = view?.getZoom?.() ?? 10;
//       view?.setZoom?.(current + 1);

//       overlayContentEl.innerHTML = `<div><b>Кластер:</b> ${clustered.length} шт</div>`;
//       overlay.setPosition(evt.coordinate);
//       return;
//     }

//     const base =
//       Array.isArray(clustered) && clustered.length ? clustered[0] : f;

//     const props = base.getProperties?.() || {};
//     const html = props._popupHtml || props.name || "—";
//     overlayContentEl.innerHTML = html;
//     overlay.setPosition(evt.coordinate);
//   };

//   map.on("click", handler);

//   return {
//     detach: () => map.un("click", handler),
//   };
// }

// /**
//  * Хелпер, чтобы Map.jsx создавал карту аккуратно
//  */
// export function createOlMap({
//   target,
//   baseLayers,
//   view,
//   overlays = [],
//   layers = [],
// } = {}) {
//   const map = new OlMap({
//     target,
//     layers: [...Object.values(baseLayers || {}), ...layers],
//     overlays,
//     view,
//     controls: [],
//   });
//   return map;
// }

// export function createView({ initialState } = {}) {
//   const lat = initialState?.center?.[0] ?? 55.751244;
//   const lon = initialState?.center?.[1] ?? 37.618423;

//   return new View({
//     center: fromLonLat([lon, lat]),
//     zoom: initialState?.zoom ?? 8,
//     maxZoom: 19,
//     minZoom: 5,
//   });
// }
