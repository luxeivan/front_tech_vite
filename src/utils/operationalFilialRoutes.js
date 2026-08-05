export const OPERATIONAL_FILIAL_ROUTES = [
  { name: "Щёлковский филиал", slug: "shchelkovski-filial" },
  { name: "Раменский филиал", slug: "ramenski-filial" },
  { name: "Одинцовский филиал", slug: "odincovski-filial" },
  { name: "Красногорский филиал", slug: "krasnogorski-filial" },
  { name: "Коломенский филиал", slug: "kolomenskoe-filial" },
  { name: "Домодедовский филиал", slug: "domodedovski-filial" },
  { name: "Сергиево-Посадский филиал", slug: "sergievo-posadski-filial" },
  { name: "Павлово-Посадский филиал", slug: "pavlovo-posadski-filial" },
  { name: "Мытищинский филиал", slug: "mytishchinski-filial" },
  { name: "Орехово-Зуевский филиал", slug: "orekhovo-zuevski-filial" },
];

export const normalizeOperationalFilialName = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е");

export const getOperationalFilialRouteByName = (filialName) => {
  const normalizedName = normalizeOperationalFilialName(filialName);
  return OPERATIONAL_FILIAL_ROUTES.find(
    (item) => normalizeOperationalFilialName(item.name) === normalizedName
  );
};

export const getOperationalFilialRouteBySlug = (slug) =>
  OPERATIONAL_FILIAL_ROUTES.find((item) => item.slug === slug);

export const getOperationalFilialPath = (filialName) => {
  const route = getOperationalFilialRouteByName(filialName);
  return route ? `/dashboard-oo/${route.slug}` : "";
};

const TRANSLIT_MAP = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ы: "y",
  э: "e",
  ю: "yu",
  я: "ya",
  ъ: "",
  ь: "",
};

export const getOperationalPoSlug = (poName) =>
  String(poName || "")
    .trim()
    .toLocaleLowerCase("ru-RU")
    .split("")
    .map((char) => TRANSLIT_MAP[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const getOperationalPoPath = (filialName, poName, basePath = "/dashboard-oo") => {
  const filialRoute = getOperationalFilialRouteByName(filialName);
  const poSlug = getOperationalPoSlug(poName);
  if (!filialRoute || !poSlug) return "";
  return `${basePath}/${filialRoute.slug}/${poSlug}`;
};

export const getOperationalFilialPathForBase = (filialName, basePath = "/dashboard-oo") => {
  const route = getOperationalFilialRouteByName(filialName);
  return route ? `${basePath}/${route.slug}` : "";
};
