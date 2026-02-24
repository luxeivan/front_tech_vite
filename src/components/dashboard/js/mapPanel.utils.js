// Фильтр вида filters[field][$in]=...
export const buildInParams = (field, values) => {
  const params = {};
  params[`filters[${field}][$in]`] = values;
  return params;
};

// Кодирование query-параметров Strapi с поддержкой массивов.
export const encodeStrapiQuery = (params) => {
  const parts = [];
  const push = (k, v) => parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((v, i) => push(`${key}[${i}]`, v));
    else push(key, value);
  }
  return parts.join("&");
};

// Извлечение координат из разных форматов записи.
export const pickLatLon = (obj) => {
  if (!obj) return null;
  const a = obj.attributes ? obj.attributes : obj;
  const latRaw =
    a.lat ?? a.latitude ?? a.geo_lat ?? a.geoLat ?? (Array.isArray(a?.coords) ? a.coords[0] : undefined);
  const lonRaw =
    a.lon ?? a.longitude ?? a.geo_lon ?? a.geoLon ?? (Array.isArray(a?.coords) ? a.coords[1] : undefined);
  const lat = typeof latRaw === "number" ? latRaw : parseFloat(latRaw);
  const lon = typeof lonRaw === "number" ? lonRaw : parseFloat(lonRaw);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  return null;
};

// Нормализация номера ПЭС из строки поиска.
export const parsePesNumber = (raw) => {
  const txt = String(raw || "").trim();
  if (!txt) return null;
  const mWithSign = txt.match(/№\s*(\d{1,4})/i);
  if (mWithSign) return Number(mWithSign[1]);
  const mDigits = txt.match(/^(\d{1,6})$/);
  if (mDigits) return Number(mDigits[1]);
  return null;
};

// Извлечение «№123» из model/caption транспорта.
export const extractModelNumber = (modelText) => {
  const txt = String(modelText || "");
  const m = txt.match(/№\s*(\d{1,4})/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
};
