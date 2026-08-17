import {
  isDashboardBaseType,
  isNotDeletedTN,
  pick,
} from "../../../../dashboard/js/dashboardCommon";
import {
  OPERATIONAL_BRANCHES,
  OPERATIONAL_DISPCENTER_TO_BRANCH,
} from "../../districts/js/operationalDistrictsPanel.config";
import {
  normalizeBranchName,
} from "../../districts/js/operationalDistrictsPanel.utils";
import {
  OPERATIONAL_CHART_BRANCH_LABELS,
  OPERATIONAL_CHART_CURRENT_YEAR,
  OPERATIONAL_CHART_PREVIOUS_YEAR,
} from "./operationalChartsPanel.config";
import {
  OPERATIONAL_CHART_MONTH_LABELS,
  getOperationalChart2025MonthlyValues,
  getOperationalChart2025PoMonthlyValues,
  getOperationalChart2025PoValues,
  getOperationalChart2025Values,
  hasOperationalChart2025PoBreakdown,
} from "./operationalChartsPanel2025.data";
import {
  getOperationalPoSlug,
} from "../../../../../utils/operationalFilialRoutes";
import {
  getTnFilialyAreaPoRows,
} from "../../../../../utils/tnFilialyApi";

const branchLabel = (branch) => OPERATIONAL_CHART_BRANCH_LABELS[branch] || branch;
const DEBUG_KOLOMNA_CHART = true;
const DEBUG_BRANCH_NAME = "Коломенский";
const loggedKolomnaBranchWindows = new Set();
const loggedKolomnaPoWindows = new Set();

const normalizeChartLookupName = (value) =>
  String(value || "")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const getPoNameByOldFields = (row) => {
  const poName = pick(row, "SC_PO") || pick(row, "SCNAME");
  return typeof poName === "string" ? poName.trim() : poName;
};

const OPERATIONAL_CHART_PO_ALIASES = {
  Домодедовский: {
    "видновский участок": "Дзержинское ПО",
    "лыткаринский участок": "Дзержинское ПО",
    "домодедовский филиал": "Домодедовское ПО",
  },
  Красногорский: {
    "долгопруднинское по": "Долгопрудненское ПО",
    "долгопрудное по": "Долгопрудненское ПО",
    долгопрудный: "Долгопрудненское ПО",
  },
};

const isSameChartName = (left, right) =>
  normalizeChartLookupName(left) === normalizeChartLookupName(right);

const getFilialRow = (filialRows, filialName) =>
  (Array.isArray(filialRows) ? filialRows : []).find((row) =>
    isSameChartName(normalizeBranchName(row?.name), normalizeBranchName(filialName))
  );

const sortRu = (rows) =>
  [...rows].sort((left, right) =>
    String(left?.name || "").localeCompare(String(right?.name || ""), "ru")
  );

const getPoChartRows = (
  filialRows,
  filialName,
  rowsCurrentYearByPo,
  selectedPoName = "",
  selectedPoSlug = ""
) => {
  const filialRow = getFilialRow(filialRows, filialName);
  const topologyPoRows = getTnFilialyAreaPoRows(filialRow)
    .filter((row) => row?.is_active !== false && row?.name)
    .map((row) => ({ name: row.name, slug: getOperationalPoSlug(row.name) }));

  const normalizedSelectedPoName = normalizeChartLookupName(selectedPoName);
  const normalizedSelectedPoSlug = String(selectedPoSlug || "").trim();
  if (!normalizedSelectedPoName && !normalizedSelectedPoSlug) {
    return sortRu(topologyPoRows);
  }

  const selectedRows = topologyPoRows.filter(
    (row) =>
      (normalizedSelectedPoName &&
        normalizeChartLookupName(row.name) === normalizedSelectedPoName) ||
      (normalizedSelectedPoSlug && row.slug === normalizedSelectedPoSlug)
  );

  if (selectedRows.length) return sortRu(selectedRows);

  const fallbackName = selectedPoName || normalizedSelectedPoSlug || "ПО";
  return [{ name: fallbackName, slug: normalizedSelectedPoSlug || getOperationalPoSlug(fallbackName) }];
};

const getPoAliasName = (branch, poName) => {
  const branchAliases = OPERATIONAL_CHART_PO_ALIASES[branch];
  if (!branchAliases) return "";
  return branchAliases[normalizeChartLookupName(poName)] || "";
};

const getTopologyPoSlugByAlias = (branch, poName, topologyPoRows) => {
  const matchedTopologyRow = topologyPoRows.find((row) => {
    const aliasName = getPoAliasName(branch, row?.name);
    return aliasName && isSameChartName(aliasName, poName);
  });
  return matchedTopologyRow?.slug || "";
};

const getPoSlugForChartRow = (row, branch, topologyPoRows) => {
  const poName = getPoNameByOldFields(row);
  const poSlug = getOperationalPoSlug(poName);
  const topologySlugs = new Set(topologyPoRows.map((item) => item.slug).filter(Boolean));
  if (topologySlugs.has(poSlug)) return poSlug;

  const aliasName = getPoAliasName(branch, poName);
  const aliasSlug = getOperationalPoSlug(aliasName);
  if (topologySlugs.has(aliasSlug)) return aliasSlug;

  return getTopologyPoSlugByAlias(branch, poName, topologyPoRows);
};

const buildPreviousYearValuesBySlug = (branch, previousYearValues, poRows) => {
  const valuesBySlug = {};

  Object.entries(previousYearValues || {}).forEach(([poName, value]) => {
    const numericValue = Number(value || 0);
    const slugs = new Set([getOperationalPoSlug(poName)].filter(Boolean));

    poRows.forEach((poRow) => {
      const aliasName = getPoAliasName(branch, poRow?.name);
      if (aliasName && isSameChartName(aliasName, poName) && poRow?.slug) {
        slugs.add(poRow.slug);
      }
    });

    slugs.forEach((slug) => {
      valuesBySlug[slug] = (valuesBySlug[slug] || 0) + numericValue;
    });
  });

  return valuesBySlug;
};

const CHART_DISPCENTER_BRANCH_BY_NORMALIZED_NAME = new Map(
  Object.entries(OPERATIONAL_DISPCENTER_TO_BRANCH).map(([dispcenter, branch]) => [
    normalizeChartLookupName(dispcenter),
    branch,
  ])
);

const getOperationalChartBranchByOldFields = (row) => {
  const groupedBranch = normalizeBranchName(pick(row, "OWN_SCNAME"));
  if (OPERATIONAL_BRANCHES.includes(groupedBranch)) return groupedBranch;

  const dispcenter = pick(row, "DISPCENTER_NAME_");
  return CHART_DISPCENTER_BRANCH_BY_NORMALIZED_NAME.get(normalizeChartLookupName(dispcenter)) || null;
};

const getDebugPeriodKey = (statsMeta) =>
  [
    statsMeta?.periodStart || "",
    statsMeta?.periodEndExclusive || statsMeta?.periodEnd || "",
    statsMeta?.calculatedAt || "",
  ].join("|");

const hasReadyStatsPeriod = (statsMeta) =>
  Boolean(
    statsMeta?.periodLabel &&
      statsMeta?.periodStart &&
      (statsMeta?.periodEndExclusive || statsMeta?.periodEnd)
  );

const hasMonthlyBreakdown = (row) =>
  Array.isArray(row?.__months) && row.__months.length >= 12;

const getVisibleMonthCount = (statsMeta) => {
  const value = Number(statsMeta?.monthCount || statsMeta?.periodMonth || 6);
  return Number.isInteger(value) && value >= 1 && value <= 12 ? value : 6;
};

const buildMonthlyCompareRows = ({ values2025, values2026, statsMeta }) => {
  const monthCount = getVisibleMonthCount(statsMeta);
  const rows = Array.from({ length: monthCount }, (_, monthIndex) => ({
    месяц: OPERATIONAL_CHART_MONTH_LABELS[monthIndex],
    [OPERATIONAL_CHART_PREVIOUS_YEAR]: Number(values2025?.[monthIndex]?.value || 0),
    [OPERATIONAL_CHART_CURRENT_YEAR]: Number(values2026?.[monthIndex] || 0),
  }));

  rows.push({
    месяц: "ИТОГО",
    [OPERATIONAL_CHART_PREVIOUS_YEAR]: rows.reduce(
      (sum, row) => sum + Number(row[OPERATIONAL_CHART_PREVIOUS_YEAR] || 0),
      0
    ),
    [OPERATIONAL_CHART_CURRENT_YEAR]: rows.reduce(
      (sum, row) => sum + Number(row[OPERATIONAL_CHART_CURRENT_YEAR] || 0),
      0
    ),
  });

  return rows;
};

const logKolomnaBranchCalculation = ({ rowsCurrentYear, counts, previousYearValues, statsMeta }) => {
  if (!DEBUG_KOLOMNA_CHART) return;
  if (!hasReadyStatsPeriod(statsMeta)) return;

  const currentYearRow = rowsCurrentYear.find(
    (row) => isSameChartName(getOperationalChartBranchByOldFields(row), DEBUG_BRANCH_NAME)
  );
  if (!hasMonthlyBreakdown(currentYearRow)) return;

  const windowKey = getDebugPeriodKey(statsMeta);
  if (loggedKolomnaBranchWindows.has(windowKey)) return;
  loggedKolomnaBranchWindows.add(windowKey);

  const rows = buildMonthlyCompareRows({
    values2025: getOperationalChart2025MonthlyValues(DEBUG_BRANCH_NAME, statsMeta),
    values2026: currentYearRow?.__months || [],
    statsMeta,
  });

  console.groupCollapsed(
    `[dashboard-oo] Коломна по месяцам: ${statsMeta?.periodLabel || "период не пересчитан"}`
  );
  console.table(rows);
  console.log("Контроль графика:", {
    [OPERATIONAL_CHART_PREVIOUS_YEAR]: previousYearValues[DEBUG_BRANCH_NAME] || 0,
    [OPERATIONAL_CHART_CURRENT_YEAR]: counts.get(DEBUG_BRANCH_NAME) || 0,
  });
  console.groupEnd();
};

const logKolomnaPoCalculation = ({
  poRows,
  counts,
  previousYearValuesBySlug,
  rowsCurrentYearByPo,
  statsMeta,
}) => {
  if (!DEBUG_KOLOMNA_CHART) return;
  if (!hasReadyStatsPeriod(statsMeta)) return;
  if (
    !rowsCurrentYearByPo.some(
      (row) =>
        isSameChartName(getOperationalChartBranchByOldFields(row), DEBUG_BRANCH_NAME) &&
        hasMonthlyBreakdown(row)
    )
  ) {
    return;
  }

  const windowKey = getDebugPeriodKey(statsMeta);
  if (loggedKolomnaPoWindows.has(windowKey)) return;
  loggedKolomnaPoWindows.add(windowKey);

  console.groupCollapsed(
    `[dashboard-oo] ПО Коломны по месяцам: ${statsMeta?.periodLabel || "период не пересчитан"}`
  );
  poRows.forEach((poRow) => {
    const currentYearRow = rowsCurrentYearByPo.find(
      (row) =>
        isSameChartName(getOperationalChartBranchByOldFields(row), DEBUG_BRANCH_NAME) &&
        getPoSlugForChartRow(row, DEBUG_BRANCH_NAME, poRows) === poRow.slug
    );
    const rows = buildMonthlyCompareRows({
      values2025: getOperationalChart2025PoMonthlyValues(DEBUG_BRANCH_NAME, poRow.name, statsMeta),
      values2026: currentYearRow?.__months || [],
      statsMeta,
    });
    console.groupCollapsed(poRow.name);
    console.table(rows);
    console.log("Контроль графика:", {
      [OPERATIONAL_CHART_PREVIOUS_YEAR]: previousYearValuesBySlug[poRow.slug] || 0,
      [OPERATIONAL_CHART_CURRENT_YEAR]: counts.get(poRow.slug) || 0,
    });
    console.groupEnd();
  });
  console.groupEnd();
};

export const buildBranchTechViolationChartData = (rowsCurrentYear, statsMeta) => {
  const counts = new Map(OPERATIONAL_BRANCHES.map((branch) => [branch, 0]));

  (Array.isArray(rowsCurrentYear) ? rowsCurrentYear : []).forEach((row) => {
    const rawCount = pick(row, "__count");
    const precomputedCount = rawCount == null ? null : Number(rawCount);
    const branch = getOperationalChartBranchByOldFields(row);

    if (!branch) return;
    if (!Number.isFinite(precomputedCount) && (!isDashboardBaseType(row) || !isNotDeletedTN(row))) {
      return;
    }
    counts.set(
      branch,
      (counts.get(branch) || 0) + (Number.isFinite(precomputedCount) ? precomputedCount : 1)
    );
  });

  const previousYearValues = getOperationalChart2025Values(statsMeta);
  logKolomnaBranchCalculation({
    rowsCurrentYear: Array.isArray(rowsCurrentYear) ? rowsCurrentYear : [],
    counts,
    previousYearValues,
    statsMeta,
  });

  return OPERATIONAL_BRANCHES.flatMap((branch) => [
    {
      branch: branchLabel(branch),
      year: String(OPERATIONAL_CHART_PREVIOUS_YEAR),
      value: previousYearValues[branch] || 0,
    },
    {
      branch: branchLabel(branch),
      year: String(OPERATIONAL_CHART_CURRENT_YEAR),
      value: counts.get(branch) || 0,
    },
  ]);
};

export const buildPoTechViolationChartData = ({
  filialName = "",
  filialRows = [],
  poName = "",
  poSlug = "",
  rowsCurrentYearByPo = [],
  statsMeta = null,
} = {}) => {
  const normalizedFilialName = normalizeBranchName(filialName);
  const poRows = getPoChartRows(
    filialRows,
    normalizedFilialName,
    rowsCurrentYearByPo,
    poName,
    poSlug
  );
  const counts = new Map(poRows.map((row) => [row.slug, 0]));

  (Array.isArray(rowsCurrentYearByPo) ? rowsCurrentYearByPo : []).forEach((row) => {
    const rawCount = pick(row, "__count");
    const precomputedCount = rawCount == null ? null : Number(rawCount);
    const branch = getOperationalChartBranchByOldFields(row);

    if (!isSameChartName(branch, normalizedFilialName)) return;
    const poSlug = getPoSlugForChartRow(row, normalizedFilialName, poRows);
    if (!poSlug) return;
    if (!Number.isFinite(precomputedCount) && (!isDashboardBaseType(row) || !isNotDeletedTN(row))) {
      return;
    }

    counts.set(
      poSlug,
      (counts.get(poSlug) || 0) + (Number.isFinite(precomputedCount) ? precomputedCount : 1)
    );
  });

  const previousYearValues = getOperationalChart2025PoValues(normalizedFilialName, statsMeta);
  const previousYearFilialValues = hasOperationalChart2025PoBreakdown(normalizedFilialName)
    ? {}
    : getOperationalChart2025Values(statsMeta);
  const previousYearValuesBySlug = buildPreviousYearValuesBySlug(
    normalizedFilialName,
    previousYearValues,
    poRows
  );
  if (isSameChartName(normalizedFilialName, DEBUG_BRANCH_NAME)) {
    logKolomnaPoCalculation({
      poRows,
      counts,
      previousYearValuesBySlug,
      rowsCurrentYearByPo: Array.isArray(rowsCurrentYearByPo) ? rowsCurrentYearByPo : [],
      statsMeta,
    });
  }

  return poRows.flatMap((poRow) => [
    {
      branch: poRow.name,
      year: String(OPERATIONAL_CHART_PREVIOUS_YEAR),
      value:
        previousYearValuesBySlug[poRow.slug] ||
        (poRows.length === 1 ? previousYearFilialValues[normalizedFilialName] || 0 : 0),
    },
    {
      branch: poRow.name,
      year: String(OPERATIONAL_CHART_CURRENT_YEAR),
      value: counts.get(poRow.slug) || 0,
    },
  ]);
};

export const getBranchChartTotals = (chartData) => {
  const totals = new Map();

  chartData.forEach((item) => {
    totals.set(item.year, (totals.get(item.year) || 0) + Number(item.value || 0));
  });

  const previous = totals.get(String(OPERATIONAL_CHART_PREVIOUS_YEAR)) || 0;
  const current = totals.get(String(OPERATIONAL_CHART_CURRENT_YEAR)) || 0;
  const percent =
    previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;

  return {
    previous,
    current,
    percent,
  };
};
