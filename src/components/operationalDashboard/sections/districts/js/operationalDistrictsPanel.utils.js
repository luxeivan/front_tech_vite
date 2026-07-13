import {
  isDashboardBaseType,
  isOpenTN,
  pick,
  toNumber,
} from "../../../../dashboard/js/dashboardCommon";

import {
  OPERATIONAL_BRANCH_UNKNOWN_VALUE,
  OPERATIONAL_BRANCHES,
} from "./operationalDistrictsPanel.config";

const EMPTY_NUMERIC_VALUES = {
  lep: 0,
  tpRp: 0,
  population: 0,
  mkd: 0,
  boilerCtp: 0,
  vzuVns: 0,
  kns: 0,
  medical: 0,
  schools: 0,
  brigades: 0,
  staff: 0,
  vehicles: 0,
  pes: 0,
};

const normalizeBranchName = (value) => {
  const normalized = String(value || "")
    .replace(/\s*(?:филиал|фил\.?)\s*$/giu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  if (normalized === "Щёлковский") return "Щелковский";
  return normalized;
};

const addFields = (row, fields) =>
  fields.reduce((sum, field) => sum + toNumber(pick(row, field)), 0);

const addRowToTotals = (totals, row) => {
  totals.lep += addFields(row, ["LINE110_ALL", "LINE35_ALL", "LINESN_ALL", "LINENN_ALL"]);
  totals.tpRp += addFields(row, ["TP_ALL", "RPSN_ALL"]);
  totals.population += toNumber(pick(row, "POPULATION_COUNT"));
  totals.mkd += toNumber(pick(row, "MKD_ALL"));
  totals.boilerCtp += addFields(row, ["BOILER_ALL", "CTP_ALL"]);
  totals.vzuVns += addFields(row, ["WELLS_ALL", "VNS_ALL"]);
  totals.kns += toNumber(pick(row, "KNS_ALL"));
  totals.medical += addFields(row, ["HOSPITALS_ALL", "CLINICS_ALL"]);
  totals.schools += addFields(row, ["SCHOOLS_ALL", "KINDERGARTENS_ALL"]);
  totals.brigades += toNumber(pick(row, "BRIGADECOUNT"));
  totals.staff += toNumber(pick(row, "EMPLOYEECOUNT"));
  totals.vehicles += toNumber(pick(row, "SPECIALTECHNIQUECOUNT"));
  totals.pes += toNumber(pick(row, "PES_COUNT"));
};

const createBranchRow = (branch) => ({
  key: branch,
  branch,
  ...EMPTY_NUMERIC_VALUES,
  mainResource: OPERATIONAL_BRANCH_UNKNOWN_VALUE,
  ovb: OPERATIONAL_BRANCH_UNKNOWN_VALUE,
});

export const buildOperationalBranchRows = (rows) => {
  const branchMap = new Map(OPERATIONAL_BRANCHES.map((branch) => [branch, createBranchRow(branch)]));

  (Array.isArray(rows) ? rows : [])
    .filter((row) => isDashboardBaseType(row) && isOpenTN(row))
    .forEach((row) => {
      const branch = normalizeBranchName(pick(row, "OWN_SCNAME"));
      if (!branch) return;

      if (!branchMap.has(branch)) {
        branchMap.set(branch, createBranchRow(branch));
      }

      addRowToTotals(branchMap.get(branch), row);
    });

  const ordered = OPERATIONAL_BRANCHES.map((branch) => branchMap.get(branch)).filter(Boolean);
  const extra = Array.from(branchMap.values())
    .filter((row) => !OPERATIONAL_BRANCHES.includes(row.branch))
    .sort((a, b) => a.branch.localeCompare(b.branch, "ru", { sensitivity: "base" }));

  return [...ordered, ...extra];
};

export const buildOperationalBranchSummary = (rows) => {
  const summary = {
    key: "summary",
    branch: "ВСЕГО",
    ...EMPTY_NUMERIC_VALUES,
    mainResource: OPERATIONAL_BRANCH_UNKNOWN_VALUE,
    ovb: OPERATIONAL_BRANCH_UNKNOWN_VALUE,
  };

  rows.forEach((row) => {
    Object.keys(EMPTY_NUMERIC_VALUES).forEach((field) => {
      summary[field] += toNumber(row[field]);
    });
  });

  return summary;
};
