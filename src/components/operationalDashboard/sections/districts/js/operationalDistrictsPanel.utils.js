import {
  isDashboardBaseType,
  isNotDeletedTN,
  isOpenTN,
  pick,
  toNumber,
} from "../../../../dashboard/js/dashboardCommon";

import {
  OPERATIONAL_DISPCENTER_TO_BRANCH,
  OPERATIONAL_BRANCH_UNKNOWN_VALUE,
  OPERATIONAL_BRANCHES,
} from "./operationalDistrictsPanel.config";
import { unwrapFirstTnPoRelation } from "../../../../../utils/tnPosApi";
import {
  unwrapFirstTnOkrugaRelation,
  unwrapTnOkrugaRelation,
} from "../../../../../utils/tnOkrugaApi";

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

export const normalizeBranchName = (value) => {
  const normalized = String(value || "")
    .replace(/\s*(?:филиал|фил\.?)\s*$/giu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  if (normalized === "Коломенское") return "Коломенский";
  if (normalized === "Щёлковский") return "Щелковский";
  return normalized;
};

const normalizeLookupName = (value) =>
  String(value || "")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const DISPCENTER_BRANCH_BY_NORMALIZED_NAME = new Map(
  Object.entries(OPERATIONAL_DISPCENTER_TO_BRANCH).map(([dispcenter, branch]) => [
    normalizeLookupName(dispcenter),
    branch,
  ])
);

export const getOperationalBranchByRow = (row) => {
  const dispcenter = pick(row, "DISPCENTER_NAME_");
  const branch = DISPCENTER_BRANCH_BY_NORMALIZED_NAME.get(normalizeLookupName(dispcenter));
  return branch || null;
};

export const isOperationalDashboardRow = (row) =>
  isDashboardBaseType(row) && isNotDeletedTN(row) && Boolean(getOperationalBranchByRow(row));

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

const getFilialMainResource = (row) =>
  row?.osn_resours ?? row?.osn_resours_count ?? row?.osn_resource ?? row?.mainResource;

const getFilialOvb = (row) => row?.ovb;

const getPoMainResource = (row) =>
  row?.osn_resours ?? row?.osn_resours_count ?? row?.osn_resource ?? row?.mainResource;

const getPoOvb = (row) => row?.ovb;

const hasValue = (value) => value !== null && value !== undefined && value !== "";

const getOperationalPoByRow = (row) => {
  const poName = pick(row, "SCNAME");
  return typeof poName === "string" ? poName.trim() : poName;
};

const isSameNormalizedName = (left, right) =>
  normalizeLookupName(left) === normalizeLookupName(right);

const isRowInBranch = (row, branchName) => {
  const branch = normalizeBranchName(branchName);
  if (!branch) return true;
  return isSameNormalizedName(getOperationalBranchByRow(row), branch);
};

const getPoFilialName = (poRow) => {
  const filial = unwrapFirstTnPoRelation(poRow?.tn_filialy, poRow?.tn_filialies);
  return filial?.name || null;
};

const getOkrugFilialName = (okrugRow) => {
  const filial = unwrapFirstTnOkrugaRelation(okrugRow?.tn_filialy, okrugRow?.tn_filialies);
  return filial?.name || null;
};

const getOkrugPoRows = (okrugRow) => {
  const po = unwrapTnOkrugaRelation(okrugRow?.tn_po || okrugRow?.tn_pos);
  if (Array.isArray(po)) return po;
  return po ? [po] : [];
};

const buildBranchResourceMap = (filialRows) =>
  (Array.isArray(filialRows) ? filialRows : []).reduce((acc, row) => {
    const branch = normalizeBranchName(row?.name);
    if (!branch) return acc;

    const mainResource = getFilialMainResource(row);
    const ovb = getFilialOvb(row);

    acc.set(branch, {
      mainResource: hasValue(mainResource) ? mainResource : OPERATIONAL_BRANCH_UNKNOWN_VALUE,
      ovb: hasValue(ovb) ? ovb : OPERATIONAL_BRANCH_UNKNOWN_VALUE,
    });

    return acc;
  }, new Map());

const buildPoResourceMap = (poRows) =>
  (Array.isArray(poRows) ? poRows : []).reduce((acc, row) => {
    const poName = row?.name;
    if (!poName) return acc;

    const mainResource = getPoMainResource(row);
    const ovb = getPoOvb(row);

    acc.set(normalizeLookupName(poName), {
      mainResource: hasValue(mainResource) ? mainResource : OPERATIONAL_BRANCH_UNKNOWN_VALUE,
      ovb: hasValue(ovb) ? ovb : OPERATIONAL_BRANCH_UNKNOWN_VALUE,
    });

    return acc;
  }, new Map());

const createBranchRow = (branch, branchResources) => ({
  key: branch,
  branch,
  ...EMPTY_NUMERIC_VALUES,
  mainResource:
    branchResources?.get(branch)?.mainResource ?? OPERATIONAL_BRANCH_UNKNOWN_VALUE,
  ovb: branchResources?.get(branch)?.ovb ?? OPERATIONAL_BRANCH_UNKNOWN_VALUE,
});

const createPoRow = (poRow, poResources) => {
  const poName = poRow?.name || OPERATIONAL_BRANCH_UNKNOWN_VALUE;
  const resources = poResources?.get(normalizeLookupName(poName));

  return {
    key: poRow?.documentId || poRow?.id || poName,
    branch: poName,
    ...EMPTY_NUMERIC_VALUES,
    mainResource: resources?.mainResource ?? OPERATIONAL_BRANCH_UNKNOWN_VALUE,
    ovb: resources?.ovb ?? OPERATIONAL_BRANCH_UNKNOWN_VALUE,
  };
};

export const buildOperationalBranchRows = (rows, filialRows = []) => {
  const branchResources = buildBranchResourceMap(filialRows);
  const branchMap = new Map(
    OPERATIONAL_BRANCHES.map((branch) => [branch, createBranchRow(branch, branchResources)])
  );

  (Array.isArray(rows) ? rows : [])
    .filter((row) => isOperationalDashboardRow(row) && isOpenTN(row))
    .forEach((row) => {
      const branch = getOperationalBranchByRow(row);
      if (!branch) return;

      addRowToTotals(branchMap.get(branch), row);
    });

  const ordered = OPERATIONAL_BRANCHES.map((branch) => branchMap.get(branch)).filter(Boolean);
  return ordered;
};

export const buildOperationalPoRows = (rows, poRows = [], filialName = "", okrugaRows = []) => {
  const normalizedBranchName = normalizeBranchName(filialName);
  const poResources = buildPoResourceMap(poRows);
  const filteredPoRows = (Array.isArray(poRows) ? poRows : []).filter((poRow) =>
    isSameNormalizedName(normalizeBranchName(getPoFilialName(poRow)), normalizedBranchName)
  );
  const poMap = new Map();

  const addPoReferenceRow = (poRow) => {
    if (poRow?.is_active === false) return;

    const poName = poRow?.name;
    const poKey = normalizeLookupName(poName);
    if (!poKey || poMap.has(poKey)) return;
    poMap.set(poKey, createPoRow(poRow, poResources));
  };

  filteredPoRows.forEach(addPoReferenceRow);

  (Array.isArray(okrugaRows) ? okrugaRows : [])
    .filter((okrugRow) =>
      isSameNormalizedName(normalizeBranchName(getOkrugFilialName(okrugRow)), normalizedBranchName)
    )
    .flatMap(getOkrugPoRows)
    .forEach(addPoReferenceRow);

  (Array.isArray(rows) ? rows : [])
    .filter((row) => isOperationalDashboardRow(row) && isOpenTN(row) && isRowInBranch(row, filialName))
    .forEach((row) => {
      const poName = getOperationalPoByRow(row);
      const poKey = normalizeLookupName(poName);
      if (!poKey) return;

      if (!poMap.has(poKey)) {
        poMap.set(poKey, {
          key: poName,
          branch: poName,
          ...EMPTY_NUMERIC_VALUES,
          mainResource: OPERATIONAL_BRANCH_UNKNOWN_VALUE,
          ovb: OPERATIONAL_BRANCH_UNKNOWN_VALUE,
        });
      }

      addRowToTotals(poMap.get(poKey), row);
    });

  return Array.from(poMap.values());
};

export const buildOperationalBranchSummary = (rows) => {
  const summary = {
    key: "summary",
    branch: "ВСЕГО",
    ...EMPTY_NUMERIC_VALUES,
    mainResource: 0,
    ovb: 0,
  };
  let hasMainResource = false;
  let hasOvb = false;

  rows.forEach((row) => {
    Object.keys(EMPTY_NUMERIC_VALUES).forEach((field) => {
      summary[field] += toNumber(row[field]);
    });

    if (row.mainResource !== OPERATIONAL_BRANCH_UNKNOWN_VALUE) {
      summary.mainResource += toNumber(row.mainResource);
      hasMainResource = true;
    }
    if (row.ovb !== OPERATIONAL_BRANCH_UNKNOWN_VALUE) {
      summary.ovb += toNumber(row.ovb);
      hasOvb = true;
    }
  });

  if (!hasMainResource) summary.mainResource = OPERATIONAL_BRANCH_UNKNOWN_VALUE;
  if (!hasOvb) summary.ovb = OPERATIONAL_BRANCH_UNKNOWN_VALUE;

  return summary;
};
