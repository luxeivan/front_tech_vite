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
import { getOperationalChart2025Values } from "./operationalChartsPanel2025.data";

const branchLabel = (branch) => OPERATIONAL_CHART_BRANCH_LABELS[branch] || branch;

const normalizeChartLookupName = (value) =>
  String(value || "")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

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
