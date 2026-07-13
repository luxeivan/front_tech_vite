import { pick } from "../../../../dashboard/js/dashboardCommon";
import { OPERATIONAL_BRANCHES } from "../../districts/js/operationalDistrictsPanel.config";
import { normalizeBranchName } from "../../districts/js/operationalDistrictsPanel.utils";
import {
  OPERATIONAL_CHART_BRANCH_LABELS,
  OPERATIONAL_CHART_CURRENT_YEAR,
  OPERATIONAL_CHART_PREVIOUS_YEAR,
  OPERATIONAL_CHART_PREVIOUS_YEAR_DEFAULT,
} from "./operationalChartsPanel.config";

const branchLabel = (branch) => OPERATIONAL_CHART_BRANCH_LABELS[branch] || branch;

export const buildBranchTechViolationChartData = (rowsCurrentYear) => {
  const counts = new Map(OPERATIONAL_BRANCHES.map((branch) => [branch, 0]));

  (Array.isArray(rowsCurrentYear) ? rowsCurrentYear : []).forEach((row) => {
    const branch = normalizeBranchName(pick(row, "OWN_SCNAME"));
    if (!branch) return;
    counts.set(branch, (counts.get(branch) || 0) + 1);
  });

  return OPERATIONAL_BRANCHES.flatMap((branch) => [
    {
      branch: branchLabel(branch),
      year: String(OPERATIONAL_CHART_PREVIOUS_YEAR),
      value: OPERATIONAL_CHART_PREVIOUS_YEAR_DEFAULT,
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
