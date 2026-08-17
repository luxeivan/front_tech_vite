import dayjs from "dayjs";

import {
  getRowPeopleCount,
  isDashboardBaseType,
  isNotDeletedTN,
  isOpenTN,
  pick,
  getTnPoName,
  startDate,
  toNumber,
} from "../../../../dashboard/js/dashboardCommon";
import {
  getOperationalBranchByRow,
  getOperationalDistrictByRow,
  normalizeBranchName,
} from "../../districts/js/operationalDistrictsPanel.utils";
import { getOperationalPoSlug } from "../../../../../utils/operationalFilialRoutes";

const isMediumVoltageLineOutage = (row) => {
  const raw = row?.data?.data ?? row?.data ?? row ?? {};
  const line110 = toNumber(raw.LINE110_ALL ?? pick(row, "LINE110_ALL"));
  const line35 = toNumber(raw.LINE35_ALL ?? pick(row, "LINE35_ALL"));
  const linesn = toNumber(raw.LINESN_ALL ?? pick(row, "LINESN_ALL"));
  const linenn = toNumber(raw.LINENN_ALL ?? pick(row, "LINENN_ALL"));
  return line110 + line35 + linesn + linenn > 0;
};

const durationHours = (row, now) => {
  const startedAt = dayjs(startDate(row));
  if (!startedAt.isValid()) return null;
  const hours = now.diff(startedAt, "minute") / 60;
  return Number.isFinite(hours) && hours >= 0 ? hours : null;
};

const normalizeLookupName = (value) =>
  String(value || "")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const getOperationalPoByRow = (row) => {
  const poName = getTnPoName(row);
  return typeof poName === "string" ? poName.trim() : poName;
};

const getOperationalDistrictDisplayName = (row) =>
  String(getOperationalDistrictByRow(row) || "")
    .replace(/(^|\s)г\s*\.?\s*о\s*\.?(?=\s|$)/giu, " ")
    .replace(/(^|\s)г\s*\.?(?=\s|$)/giu, " ")
    .replace(/городской\s+округ/giu, " ")
    .replace(/\s+/g, " ")
    .trim();

const isRowInFilial = (row, filialName) => {
  const targetFilial = normalizeLookupName(normalizeBranchName(filialName));
  if (!targetFilial) return true;

  return normalizeLookupName(getOperationalBranchByRow(row)) === targetFilial;
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

const getPopulationGroupByRow = (row, groupBy) => {
  if (groupBy === "okrug") return getOperationalDistrictDisplayName(row);
  if (groupBy === "po") return getOperationalPoByRow(row);
  return getOperationalBranchByRow(row);
};

export const buildDurationDonutData = (rows, now = dayjs(), options = {}) => {
  const { filialName = "", poName = "", poSlug = "" } = options;
  const source = Array.isArray(rows) ? rows : [];
  const buckets = {
    under2h: [],
    over2h: [],
    over4h: [],
  };

  source
    .filter(
      (row) =>
        isDashboardBaseType(row) &&
        isNotDeletedTN(row) &&
        isOpenTN(row) &&
        isRowInFilial(row, filialName) &&
        isRowInPo(row, poName, poSlug) &&
        Boolean(getOperationalBranchByRow(row)) &&
        isMediumVoltageLineOutage(row)
    )
    .forEach((row) => {
      const hours = durationHours(row, now);
      if (hours == null) return;
      if (hours > 4) buckets.over4h.push(row);
      else if (hours > 2) buckets.over2h.push(row);
      else buckets.under2h.push(row);
    });

  return {
    total: buckets.under2h.length + buckets.over2h.length + buckets.over4h.length,
    values: {
      under2h: buckets.under2h.length,
      over2h: buckets.over2h.length,
      over4h: buckets.over4h.length,
    },
  };
};

export const buildPopulationDonutData = (rows, options = {}) => {
  const { filialName = "", groupBy = "filial", poName = "", poSlug = "" } = options;
  const source = Array.isArray(rows) ? rows : [];
  const districtTotals = new Map();

  source
    .filter(
      (row) =>
        isDashboardBaseType(row) &&
        isNotDeletedTN(row) &&
        isOpenTN(row) &&
        isRowInFilial(row, filialName) &&
        isRowInPo(row, poName, poSlug)
    )
    .forEach((row) => {
      const district = getPopulationGroupByRow(row, groupBy);
      if (!district) return;
      const people = getRowPeopleCount(row);
      if (people > 0) {
        districtTotals.set(district, (districtTotals.get(district) || 0) + people);
      }
    });

  const values = {
    under5000: 0,
    from5000to20000: 0,
    over20000: 0,
  };

  districtTotals.forEach((people) => {
    if (people > 20000) values.over20000 += people;
    else if (people >= 5000) values.from5000to20000 += people;
    else values.under5000 += people;
  });

  return {
    total: values.under5000 + values.from5000to20000 + values.over20000,
    values,
    districts: Array.from(districtTotals.entries())
      .map(([name, people]) => ({ name, people }))
      .sort((a, b) => b.people - a.people),
  };
};

export const getPopulationColor = (people) => {
  if (people > 20000) return "#ff171f";
  if (people >= 5000) return "#ffc928";
  return "#8ad34a";
};
