export const OPERATIONAL_FILIAL_ROUTES = [
  { name: "Щёлковский филиал", slug: "shchelkovski-filial" },
  { name: "Раменский филиал", slug: "ramenski-filial" },
  { name: "Одинцовский филиал", slug: "odincovski-filial" },
  { name: "Красногорский филиал", slug: "krasnogorski-filial" },
  { name: "Коломенское филиал", slug: "kolomenskoe-filial" },
  { name: "Домодедовский филиал", slug: "domodedovski-filial" },
  { name: "Сергиево-Посадский филиал", slug: "sergievo-posadski-filial" },
  { name: "Павлово-Посадский филиал", slug: "pavlovo-posadski-filial" },
  { name: "Мытищинский филиал", slug: "mytishchinski-filial" },
  { name: "Орехово-Зуевский филиал", slug: "orekhovo-zuevski-filial" },
];

const normalizeFilialName = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е");

export const getOperationalFilialRouteByName = (filialName) => {
  const normalizedName = normalizeFilialName(filialName);
  return OPERATIONAL_FILIAL_ROUTES.find(
    (item) => normalizeFilialName(item.name) === normalizedName
  );
};

export const getOperationalFilialRouteBySlug = (slug) =>
  OPERATIONAL_FILIAL_ROUTES.find((item) => item.slug === slug);

export const getOperationalFilialPath = (filialName) => {
  const route = getOperationalFilialRouteByName(filialName);
  return route ? `/dashboard-oo/${route.slug}` : "";
};
