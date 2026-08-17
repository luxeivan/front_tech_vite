import {
  isDashboardBaseType,
  isNotDeletedTN,
  isOpenTN,
  pick,
  getTnPoName,
  toNumber,
} from "../../../../dashboard/js/dashboardCommon";
import {
  getOperationalBranchByRow,
  getOperationalDistrictByRow,
  getOperationalPoByRow,
  normalizeBranchName,
  normalizeLookupName,
} from "../../districts/js/operationalDistrictsPanel.utils";
import { getOperationalPoSlug } from "../../../../../utils/operationalFilialRoutes";
import {
  OPERATIONAL_BRANCH_DISTRICT_ALIASES,
  OPERATIONAL_BRANCH_POINTS,
  OPERATIONAL_MAP_COLORS,
} from "./operationalMapPanel.config";

export const formatMapNumber = (value, digits = 0) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString("ru-RU", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
};

export const getPopulationSeverity = (people) => {
  const value = Number(people || 0);
  if (value > 20000) return "high";
  if (value >= 5000) return "medium";
  if (value > 0) return "low";
  return "empty";
};

export const getPopulationColor = (people) =>
  OPERATIONAL_MAP_COLORS[getPopulationSeverity(people)] || OPERATIONAL_MAP_COLORS.empty;

export const normalizeOperationalMapAreaName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s*(?:филиал|фил\.?|производственное\s+отделение|по)\s*$/giu, "")
    .replace(/(^|[^а-яa-z0-9]+)г\s*\.?\s*о\s*\.?(?=$|[^а-яa-z0-9]+)/giu, " ")
    .replace(
      /(^|[^а-яa-z0-9]+)(?:городской|муниципальный|город|округ|район|го)(?=$|[^а-яa-z0-9]+)/giu,
      " "
    )
    .replace(/[^а-яa-z0-9]+/giu, " ")
    .trim();

const getAreaStem = (value) => {
  const normalized = normalizeOperationalMapAreaName(value)
    .replace(/(ское|ская|ский|ской|ого|ому|ым|ой|ая|ое|ые|ий|ый|ое)$/u, "")
    .trim();

  return normalized
    .split(" ")
    .filter(Boolean)
    .map((word) => (word.length > 4 ? word.slice(0, 4) : word))
    .join(" ");
};

export const findOperationalMapAreaData = (areaDataByKey, areaName) => {
  const normalizedAreaName = normalizeOperationalMapAreaName(areaName);
  if (!normalizedAreaName) return null;

  const directMatch = areaDataByKey.get(normalizedAreaName);
  if (directMatch) return directMatch;

  const areaStem = getAreaStem(normalizedAreaName);
  if (!areaStem) return null;

  for (const [candidateKey, item] of areaDataByKey.entries()) {
    const candidateStem = getAreaStem(candidateKey);
    if (
      candidateKey.includes(normalizedAreaName) ||
      normalizedAreaName.includes(candidateKey) ||
      (candidateStem && areaStem && candidateStem === areaStem) ||
      (candidateStem && areaStem && candidateStem.includes(areaStem)) ||
      (candidateStem && areaStem && areaStem.includes(candidateStem))
    ) {
      return item;
    }
  }

  return null;
};

const normalizeMapName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/(^|[^а-яa-z0-9]+)г\s*\.?\s*о\s*\.?(?=$|[^а-яa-z0-9]+)/giu, " ")
    .replace(
      /(^|[^а-яa-z0-9]+)(?:городской|муниципальный|город|округ|район|го)(?=$|[^а-яa-z0-9]+)/giu,
      " "
    )
    .replace(/[^а-яa-z0-9]+/giu, " ")
    .trim();

export const getBranchByDistrictName = (districtName) => {
  const normalizedDistrict = normalizeMapName(districtName);
  if (!normalizedDistrict) return null;

  return (
    Object.entries(OPERATIONAL_BRANCH_DISTRICT_ALIASES).find(([, aliases]) =>
      aliases.every((alias) => normalizedDistrict.includes(normalizeMapName(alias)))
    )?.[0] || null
  );
};

export const buildOperationalMapBranchData = (rows) => {
  const branchMap = new Map(
    Object.keys(OPERATIONAL_BRANCH_POINTS).map((branch) => [
      branch,
      {
        branch,
        people: 0,
        outages: 0,
        lines: 0,
      },
    ])
  );

  (Array.isArray(rows) ? rows : [])
    .filter((row) => isDashboardBaseType(row) && isNotDeletedTN(row) && isOpenTN(row))
    .forEach((row) => {
      const branch = getOperationalBranchByRow(row);
      if (!branch) return;

      const item = branchMap.get(branch);
      item.people += toNumber(pick(row, "POPULATION_COUNT"));
      item.outages += 1;
      item.lines +=
        toNumber(pick(row, "LINE110_ALL")) +
        toNumber(pick(row, "LINE35_ALL")) +
        toNumber(pick(row, "LINESN_ALL")) +
        toNumber(pick(row, "LINENN_ALL"));
    });

  return Array.from(branchMap.values())
    .map((item) => ({
      ...item,
      point: OPERATIONAL_BRANCH_POINTS[item.branch] || null,
      severity: getPopulationSeverity(item.people),
      color: getPopulationColor(item.people),
    }))
    .filter((item) => item.point);
};

const createAreaData = (areaName) => ({
  areaName,
  people: 0,
  outages: 0,
  lines: 0,
});

const addRowToAreaData = (item, row) => {
  item.people += toNumber(pick(row, "POPULATION_COUNT"));
  item.outages += 1;
  item.lines +=
    toNumber(pick(row, "LINE110_ALL")) +
    toNumber(pick(row, "LINE35_ALL")) +
    toNumber(pick(row, "LINESN_ALL")) +
    toNumber(pick(row, "LINENN_ALL"));
};

export const buildOperationalMapAreaData = (rows, getAreaName) => {
  const areaMap = new Map();

  (Array.isArray(rows) ? rows : [])
    .filter((row) => isDashboardBaseType(row) && isNotDeletedTN(row) && isOpenTN(row))
    .forEach((row) => {
      const areaName = String(getAreaName(row) || "").trim();
      const key = normalizeOperationalMapAreaName(areaName);
      if (!key) return;

      if (!areaMap.has(key)) areaMap.set(key, createAreaData(areaName));
      addRowToAreaData(areaMap.get(key), row);
    });

  return Array.from(areaMap.entries()).map(([key, item]) => ({
    ...item,
    key,
    severity: getPopulationSeverity(item.people),
    color: getPopulationColor(item.people),
  }));
};

export const buildOperationalMapFilialData = (rows) =>
  buildOperationalMapAreaData(rows, getOperationalBranchByRow);

export const buildOperationalMapPoData = (rows) =>
  buildOperationalMapAreaData(rows, getTnPoName);

const isSameAreaName = (left, right) => normalizeLookupName(left) === normalizeLookupName(right);

const isRowInMapBranch = (row, filialName = "") => {
  const branchName = normalizeBranchName(filialName);
  if (!branchName) return true;
  return isSameAreaName(getOperationalBranchByRow(row), branchName);
};

const isRowInMapPo = (row, poName = "", poSlug = "") => {
  const normalizedPoName = normalizeLookupName(poName);
  const normalizedPoSlug = String(poSlug || "").trim();
  if (!normalizedPoName && !normalizedPoSlug) return true;

  const rowPoName = getOperationalPoByRow(row);
  return (
    (normalizedPoName && normalizeLookupName(rowPoName) === normalizedPoName) ||
    (normalizedPoSlug && getOperationalPoSlug(rowPoName) === normalizedPoSlug)
  );
};

export const buildOperationalMapDistrictData = (
  rows,
  { filialName = "", poName = "", poSlug = "" } = {}
) => {
  const areaMap = new Map();

  (Array.isArray(rows) ? rows : [])
    .filter(
      (row) =>
        isDashboardBaseType(row) &&
        isNotDeletedTN(row) &&
        isOpenTN(row) &&
        isRowInMapBranch(row, filialName) &&
        isRowInMapPo(row, poName, poSlug)
    )
    .forEach((row) => {
      const areaName = String(getOperationalDistrictByRow(row) || "").trim();
      const key = normalizeOperationalMapAreaName(areaName);
      if (!key) return;

      if (!areaMap.has(key)) areaMap.set(key, createAreaData(areaName));
      addRowToAreaData(areaMap.get(key), row);
    });

  return Array.from(areaMap.entries()).map(([key, item]) => ({
    ...item,
    key,
    severity: getPopulationSeverity(item.people),
    color: getPopulationColor(item.people),
  }));
};

export const getWeatherView = (code) => {
  const value = Number(code);
  if (value === 0) return { icon: "☀", label: "Ясно" };
  if ([1, 2].includes(value)) return { icon: "☀", label: "Переменная облачность" };
  if (value === 3) return { icon: "☁", label: "Облачно" };
  if ([45, 48].includes(value)) return { icon: "≋", label: "Туман" };
  if ([51, 53, 55, 56, 57].includes(value)) return { icon: "☔", label: "Морось" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return { icon: "☔", label: "Дождь" };
  if ([71, 73, 75, 77, 85, 86].includes(value)) return { icon: "❄", label: "Снег" };
  if ([95, 96, 99].includes(value)) return { icon: "⚡", label: "Гроза" };
  return { icon: "℃", label: "Погода" };
};
