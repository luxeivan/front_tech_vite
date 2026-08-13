import {
  isDashboardBaseType,
  isNotDeletedTN,
  isOpenTN,
  pick,
  getTnFilialName,
  getTnPoName,
  toNumber,
} from "../../../../dashboard/js/dashboardCommon";
import { getOperationalPoSlug } from "../../../../../utils/operationalFilialRoutes";

import {
  OPERATIONAL_DISPCENTER_TO_BRANCH,
  OPERATIONAL_BRANCH_UNKNOWN_VALUE,
  OPERATIONAL_BRANCHES,
} from "./operationalDistrictsPanel.config";
import {
  getTnFilialyAreaPoRows,
  getTnFilialyOkrugaRows,
  getTnFilialyPoOkrugaRows,
} from "../../../../../utils/tnFilialyApi";

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

const PES_DASHBOARD_ACTIVE_STATUSES = new Set([
  "command_sent",
  "delay",
  "en_route",
  "connected",
]);

export const normalizeBranchName = (value) => {
  const normalized = String(value || "")
    .replace(/\s*(?:филиал|фил\.?)\s*$/giu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  if (normalized === "Коломенский") return "Коломенский";
  if (normalized === "Щёлковский" || normalized === "Щелковский") return "Щёлковский";
  return normalized;
};

const normalizeLookupName = (value) =>
  String(value || "")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const isEmptyLookupValue = (value) => {
  const normalized = normalizeLookupName(value);
  return !normalized || normalized === "-" || normalized === "—";
};

const DISPCENTER_BRANCH_BY_NORMALIZED_NAME = new Map(
  Object.entries(OPERATIONAL_DISPCENTER_TO_BRANCH).map(([dispcenter, branch]) => [
    normalizeLookupName(dispcenter),
    branch,
  ])
);

export const getOperationalBranchByRow = (row) => {
  const branch = normalizeBranchName(getTnFilialName(row));
  if (branch) return branch;

  // Старый источник филиала до перехода на SC_FILIAL:
  // const dispcenter = pick(row, "DISPCENTER_NAME_");
  // const oldBranch = DISPCENTER_BRANCH_BY_NORMALIZED_NAME.get(normalizeLookupName(dispcenter));
  // return oldBranch || null;

  return null;
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
};

const getFilialMainResource = (row) =>
  row?.osn_resours ?? row?.osn_resours_count ?? row?.osn_resource ?? row?.mainResource;

const getFilialOvb = (row) => row?.ovb;

const hasValue = (value) => value !== null && value !== undefined && value !== "";
const hasResourceValue = (value) => hasValue(value) && value !== OPERATIONAL_BRANCH_UNKNOWN_VALUE;

const getResourceFields = (row, fallback = {}) => {
  const mainResource = getFilialMainResource(row);
  const ovb = getFilialOvb(row);

  return {
    mainResource: hasResourceValue(mainResource)
      ? mainResource
      : fallback.mainResource ?? OPERATIONAL_BRANCH_UNKNOWN_VALUE,
    ovb: hasResourceValue(ovb) ? ovb : fallback.ovb ?? OPERATIONAL_BRANCH_UNKNOWN_VALUE,
  };
};

const getOperationalPoByRow = (row) => {
  const poName = getTnPoName(row);
  return typeof poName === "string" ? poName.trim() : poName;
};

const isSameNormalizedName = (left, right) =>
  normalizeLookupName(left) === normalizeLookupName(right);

const uniqueNames = (names) => {
  const seen = new Set();
  return names.filter((name) => {
    const key = normalizeLookupName(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const sortRuNames = (names) =>
  [...names].sort((left, right) => String(left || "").localeCompare(String(right || ""), "ru"));

const normalizeDistrictLookupName = (value) =>
  normalizeLookupName(value)
    .replace(/(^|\s)г\s*\.?\s*о\s*\.?(?=\s|$)/giu, " ")
    .replace(/(^|\s)г\s*\.?(?=\s|$)/giu, " ")
    .replace(/[.,;:()[\]{}«»"'`]/g, " ")
    .replace(
      /(^|[^а-яa-z0-9]+)(?:городской|муниципальный|город|округ|район|го)(?=$|[^а-яa-z0-9]+)/giu,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

const extractDistrictNameFromAddress = (address) => {
  const value = String(address || "").replace(/\s+/g, " ").trim();
  if (!value) return "";

  const firstSegment = value.split(",")[0]?.trim();
  if (
    firstSegment &&
    /^(?:(?:городской|муниципальный)\s+округ|г\.?\s*о\.?)\b/i.test(firstSegment)
  ) {
    return firstSegment;
  }

  const goMatch = value.match(/(?:городской|муниципальный)\s+округ\s+[^,]+/i);
  if (goMatch?.[0]) return goMatch[0].trim();

  const shortGoMatch = value.match(/г\.?\s*о\.?\s+[^,]+/i);
  if (shortGoMatch?.[0]) return shortGoMatch[0].trim();

  return value;
};

const normalizePesBranchKey = (value) => normalizeLookupName(normalizeBranchName(value));

const normalizePesPoKey = (value) => (isEmptyLookupValue(value) ? "" : normalizeLookupName(value));

const buildPesPoCountKey = (branchName, poName) =>
  `${normalizePesBranchKey(branchName)}|||${normalizePesPoKey(poName)}`;

const buildPesOkrugBranchCountKey = (branchName, okrugName) =>
  `${normalizePesBranchKey(branchName)}|||${normalizeDistrictLookupName(okrugName)}`;

const buildPesOkrugPoCountKey = (branchName, poName, okrugName) =>
  `${normalizePesBranchKey(branchName)}|||${normalizePesPoKey(poName)}|||${normalizeDistrictLookupName(
    okrugName
  )}`;

const hasEmptyPesKeyPart = (key) =>
  !key || (key.includes("|||") && key.split("|||").some((part) => !part));

const incrementMap = (map, key) => {
  if (hasEmptyPesKeyPart(key)) return;
  map.set(key, (map.get(key) || 0) + 1);
};

const isDashboardActivePes = (item) => {
  const status = String(item?.effectiveStatus || item?.status || "")
    .trim()
    .toLowerCase();
  return PES_DASHBOARD_ACTIVE_STATUSES.has(status);
};

const buildDestinationLookup = (destinations = []) =>
  (Array.isArray(destinations) ? destinations : []).reduce((acc, destination) => {
    const id = String(destination?.id || "").trim();
    if (id) acc.set(id, destination);
    return acc;
  }, new Map());

const buildKnownPesPoKeysByBranch = (filialRows = []) =>
  (Array.isArray(filialRows) ? filialRows : []).reduce((acc, filialRow) => {
    const branchKey = normalizePesBranchKey(filialRow?.name);
    if (!branchKey) return acc;

    const poKeys = new Set(
      getTnFilialyAreaPoRows(filialRow)
        .filter((poRow) => poRow?.is_active !== false)
        .map((poRow) => normalizePesPoKey(poRow?.name))
        .filter(Boolean)
    );

    if (poKeys.size) acc.set(branchKey, poKeys);
    return acc;
  }, new Map());

const getKnownPesPoName = (branchName, primaryPoName, fallbackPoName, knownPoKeysByBranch) => {
  const branchKey = normalizePesBranchKey(branchName);
  const knownPoKeys = knownPoKeysByBranch?.get(branchKey);
  if (!knownPoKeys?.size) return primaryPoName || fallbackPoName;

  const primaryPoKey = normalizePesPoKey(primaryPoName);
  if (primaryPoKey && knownPoKeys.has(primaryPoKey)) return primaryPoName;

  const fallbackPoKey = normalizePesPoKey(fallbackPoName);
  if (fallbackPoKey && knownPoKeys.has(fallbackPoKey)) return fallbackPoName;

  return primaryPoName || fallbackPoName;
};

const getPesDashboardLocation = (item, destinationById, knownPoKeysByBranch = null) => {
  const destinationId = String(item?.destination?.id || "").trim();
  const destinationType = String(item?.destination?.type || "").trim();
  const destination =
    destinationId && destinationType === "assembly" ? destinationById.get(destinationId) : null;
  const branch = destination?.branch || item?.branch;
  const po = getKnownPesPoName(branch, destination?.po, item?.po, knownPoKeysByBranch);

  return {
    branch,
    po,
    district:
      destination?.district ||
      extractDistrictNameFromAddress(destination?.address) ||
      item?.destination?.district ||
      item?.district ||
      extractDistrictNameFromAddress(item?.destination?.address),
  };
};

export const buildPesDashboardCountMaps = (items = [], destinations = [], filialRows = []) => {
  const destinationById = buildDestinationLookup(destinations);
  const knownPoKeysByBranch = buildKnownPesPoKeysByBranch(filialRows);
  const counts = {
    byBranchKey: new Map(),
    byPoKey: new Map(),
    byOkrugBranchKey: new Map(),
    byOkrugPoKey: new Map(),
    poNamesByBranchKey: new Map(),
  };

  (Array.isArray(items) ? items : []).filter(isDashboardActivePes).forEach((item) => {
    const { branch, po, district } = getPesDashboardLocation(
      item,
      destinationById,
      knownPoKeysByBranch
    );
    const branchKey = normalizePesBranchKey(branch);
    const poKey = normalizePesPoKey(po);

    incrementMap(counts.byBranchKey, branchKey);
    incrementMap(counts.byPoKey, buildPesPoCountKey(branch, po));
    incrementMap(counts.byOkrugBranchKey, buildPesOkrugBranchCountKey(branch, district));
    incrementMap(counts.byOkrugPoKey, buildPesOkrugPoCountKey(branch, po, district));

    if (branchKey && poKey && po) {
      if (!counts.poNamesByBranchKey.has(branchKey)) {
        counts.poNamesByBranchKey.set(branchKey, new Map());
      }
      counts.poNamesByBranchKey.get(branchKey).set(poKey, po);
    }
  });

  return counts;
};

const isRowInBranch = (row, branchName) => {
  const branch = normalizeBranchName(branchName);
  if (!branch) return true;
  return isSameNormalizedName(getOperationalBranchByRow(row), branch);
};

const isRowInPo = (row, poName, poSlug = "") => {
  const rowPoName = getOperationalPoByRow(row);
  const normalizedPoName = normalizeLookupName(poName);
  const normalizedPoSlug = String(poSlug || "").trim();
  if (!normalizedPoName && !normalizedPoSlug) return true;

  return (
    (normalizedPoName && normalizeLookupName(rowPoName) === normalizedPoName) ||
    (normalizedPoSlug && getOperationalPoSlug(rowPoName) === normalizedPoSlug)
  );
};

const getFilialRowByName = (filialRows, filialName) => {
  const normalizedBranchName = normalizeBranchName(filialName);
  return (Array.isArray(filialRows) ? filialRows : []).find((filialRow) =>
    isSameNormalizedName(normalizeBranchName(filialRow?.name), normalizedBranchName)
  );
};

const isPoRowSelected = (poRow, poName, poSlug = "") => {
  const normalizedPoName = normalizeLookupName(poName);
  const normalizedPoSlug = String(poSlug || "").trim();
  if (!normalizedPoName && !normalizedPoSlug) return true;

  return (
    (normalizedPoName && normalizeLookupName(poRow?.name) === normalizedPoName) ||
    (normalizedPoSlug && getOperationalPoSlug(poRow?.name) === normalizedPoSlug)
  );
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

const createBranchRow = (branch, branchResources) => ({
  key: branch,
  branch,
  ...EMPTY_NUMERIC_VALUES,
  mainResource:
    branchResources?.get(branch)?.mainResource ?? OPERATIONAL_BRANCH_UNKNOWN_VALUE,
  ovb: branchResources?.get(branch)?.ovb ?? OPERATIONAL_BRANCH_UNKNOWN_VALUE,
});

const createPoRow = (poRow) => {
  const poName = poRow?.name || OPERATIONAL_BRANCH_UNKNOWN_VALUE;

  return {
    key: poRow?.documentId || poRow?.id || poName,
    branch: poName,
    ...EMPTY_NUMERIC_VALUES,
    ...getResourceFields(poRow),
  };
};

const formatOkrugName = (value) => {
  const name = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^г\s*\.?\s*о\s*\.?\s*/iu, "")
    .replace(/\s*г\s*\.?\s*о\s*\.?$/iu, "")
    .trim();
  if (!name) return OPERATIONAL_BRANCH_UNKNOWN_VALUE;
  return `г.о. ${name}`;
};

const cloneOperationalValues = (sourceRow, overrides = {}) => ({
  ...sourceRow,
  ...overrides,
});

export const buildOperationalBranchRows = (rows, filialRows = [], pesCountMaps = null) => {
  const branchResources = buildBranchResourceMap(filialRows);
  const sourceBranches = sortRuNames(uniqueNames(
    Array.isArray(filialRows) && filialRows.length
      ? filialRows
          .filter((filialRow) => filialRow?.is_active !== false)
          .map((filialRow) => normalizeBranchName(filialRow?.name))
          .filter(Boolean)
      : OPERATIONAL_BRANCHES
  ));
  const branchMap = new Map(
    sourceBranches.map((branch) => [branch, createBranchRow(branch, branchResources)])
  );

  (Array.isArray(rows) ? rows : [])
    .filter((row) => isOperationalDashboardRow(row) && isOpenTN(row))
    .forEach((row) => {
      const branch = getOperationalBranchByRow(row);
      if (!branch) return;

      addRowToTotals(branchMap.get(branch), row);
    });

  const ordered = sourceBranches.map((branch) => branchMap.get(branch)).filter(Boolean);
  ordered.forEach((row) => {
    row.pes = toNumber(pesCountMaps?.byBranchKey?.get(normalizePesBranchKey(row.branch)));
  });
  return ordered;
};

export const buildOperationalPoRows = (rows, filialRows = [], filialName = "", pesCountMaps = null) => {
  const filialRow = getFilialRowByName(filialRows, filialName);
  const filteredPoRows = getTnFilialyAreaPoRows(filialRow);
  const poMap = new Map();

  const addPoReferenceRow = (poRow) => {
    if (poRow?.is_active === false) return;

    const poName = poRow?.name;
    const poKey = normalizeLookupName(poName);
    if (!poKey || poMap.has(poKey)) return;
    poMap.set(poKey, createPoRow(poRow));
  };

  filteredPoRows.forEach(addPoReferenceRow);

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

  return Array.from(poMap.values()).map((row) => ({
    ...row,
    pes: toNumber(pesCountMaps?.byPoKey?.get(buildPesPoCountKey(filialName, row.branch))),
  }));
};

export const buildOperationalOkrugRows = (
  rows,
  filialRows = [],
  filialName = "",
  poName = "",
  poSlug = "",
  pesCountMaps = null
) => {
  const filialRow = getFilialRowByName(filialRows, filialName);
  const selectedPoRows = getTnFilialyAreaPoRows(filialRow).filter(
    (poRow) => poRow?.is_active !== false && isPoRowSelected(poRow, poName, poSlug)
  );
  const selectedPoRow = selectedPoRows[0] || null;
  const selectedPoName = selectedPoRow?.name || poName || OPERATIONAL_BRANCH_UNKNOWN_VALUE;
  const referenceOkrugaRows =
    poName || poSlug
      ? selectedPoRows.flatMap(getTnFilialyPoOkrugaRows)
      : getTnFilialyOkrugaRows(filialRow);
  const okrugRows = [];
  const okrugSeen = new Set();

  referenceOkrugaRows
    .filter((okrugRow) => okrugRow?.is_active !== false)
    .forEach((okrugRow) => {
      const rawName = okrugRow?.name || okrugRow?.source_name || OPERATIONAL_BRANCH_UNKNOWN_VALUE;
      const key = normalizeDistrictLookupName(rawName) || normalizeLookupName(rawName);
      if (!key || okrugSeen.has(key)) return;
      okrugSeen.add(key);
      okrugRows.push({
        key: okrugRow?.documentId || okrugRow?.id || rawName,
        branch: formatOkrugName(rawName),
        ...getResourceFields(okrugRow),
      });
    });

  const poRows = buildOperationalPoRows(rows, filialRows, filialName, pesCountMaps);
  const selectedPoDataRow =
    poRows.find((row) => isPoRowSelected({ name: row.branch }, selectedPoName, poSlug)) ||
    createPoRow(selectedPoRow || { name: selectedPoName });
  const poDataRow = {
    ...selectedPoDataRow,
    key: `po-${selectedPoDataRow.key || selectedPoName}`,
    branch: selectedPoName,
  };

  return [
    poDataRow,
    ...okrugRows.map((row) =>
      cloneOperationalValues(poDataRow, {
        ...row,
        ...getResourceFields(row, poDataRow),
      })
    ),
  ];
};

export const buildOperationalOkrugSummary = (rows) => {
  const sourceRow = Array.isArray(rows) ? rows[0] : null;
  if (!sourceRow) {
    return {
      key: "summary",
      branch: "ВСЕГО",
      ...EMPTY_NUMERIC_VALUES,
      mainResource: OPERATIONAL_BRANCH_UNKNOWN_VALUE,
      ovb: OPERATIONAL_BRANCH_UNKNOWN_VALUE,
    };
  }

  return cloneOperationalValues(sourceRow, {
    key: "summary",
    branch: "ВСЕГО",
  });
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
