// Реальный множитель масштаба карты после fit.
export const OPERATIONAL_MAP_SCALE = 0.97;
// Отдельное визуальное растяжение карты по вертикали, чтобы съедать пустоту блока без лишнего zoom/crop.
export const OPERATIONAL_MAP_STRETCH_Y = 1.03;
// Сдвиг контурной карты внутри блока по вертикали, px.
export const OPERATIONAL_MAP_OFFSET_Y = 8;
// Локальный быстрый fallback, пока Strapi с режимами округов отвечает.
export const OPERATIONAL_MAP_FALLBACK_GEOJSON_URL =
  "/data/moscow-region-municipalities.geojson";
// Толщина границ округов, px: обычные / подсвеченные.
export const OPERATIONAL_MAP_DISTRICT_STROKE_WIDTH = 1.7;
export const OPERATIONAL_MAP_ACTIVE_DISTRICT_STROKE_WIDTH = 2;
// Цвет границы округа по введенному режиму.
export const OPERATIONAL_MAP_MODE_STROKE_COLORS = {
  rpg: "#fadb14",
  orr: "#ff4d4f",
};
export const OPERATIONAL_MAP_MODE_STROKE_WIDTH = 2.6;
export const OPERATIONAL_WEATHER_LOCATION = {
  latitude: 55.7558,
  longitude: 37.6173,
  label: "Москва",
};

export const OPERATIONAL_BRANCH_POINTS = {
  Домодедовский: { lon: 37.76, lat: 55.44 },
  Коломенский: { lon: 38.77, lat: 55.1 },
  Красногорский: { lon: 37.33, lat: 55.82 },
  Мытищинский: { lon: 37.74, lat: 55.91 },
  Одинцовский: { lon: 37.28, lat: 55.68 },
  "Орехово-Зуевский": { lon: 38.98, lat: 55.8 },
  "Павлово-Посадский": { lon: 38.65, lat: 55.78 },
  Раменский: { lon: 38.23, lat: 55.57 },
  "Сергиево-Посадский": { lon: 38.13, lat: 56.3 },
  Щелковский: { lon: 38.0, lat: 55.92 },
};

export const OPERATIONAL_BRANCH_DISTRICT_ALIASES = {
  Домодедовский: ["домодедов"],
  Коломенский: ["коломн"],
  Красногорский: ["красногор"],
  Мытищинский: ["мытищ"],
  Одинцовский: ["одинцов"],
  "Орехово-Зуевский": ["орехово", "зуев"],
  "Павлово-Посадский": ["павлов", "посад"],
  Раменский: ["рамен"],
  "Сергиево-Посадский": ["сергиев", "посад"],
  Щелковский: ["щелков", "щёлков"],
};

export const OPERATIONAL_MAP_COLORS = {
  low: "#8ad34a",
  medium: "#ffc928",
  high: "#ff171f",
  empty: "#ffffff",
};
