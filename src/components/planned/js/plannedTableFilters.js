import dayjs from "dayjs";

import {
  buildSzoSummaryFromItem,
  extractGuid,
  formatDateTime,
  getField,
  getPlannedStatusName,
  isPlannedType,
  PLANNED_STATUS_OPTIONS,
} from "./plannedTable.utils";

export const DEFAULT_PAGE_SIZE = 15;
export const PAGE_SIZE_OPTIONS = [15, 30, 50, 100];
export const DEFAULT_TNS_PAGE_SIZE = 100;
export const ALL_BRANCHES = "__all__";
export const ALL_PO = "__all__";
export const SCOPED_PO_SEPARATOR = ":::";

const ACTIVE_PLANNED_STATUSES = ["запланировано", "начата"];

export const DEFAULT_PLANNED_STATUSES = PLANNED_STATUS_OPTIONS
  .filter((item) => ACTIVE_PLANNED_STATUSES.includes(item.value))
  .map((item) => item.value);

export function ruSort(a, b) {
  return String(a).localeCompare(String(b), "ru", {
    sensitivity: "base",
    numeric: true,
  });
}

export function makeScopedPoValue(branch, po) {
  return `${branch}${SCOPED_PO_SEPARATOR}${po}`;
}

export function parseScopedPoValue(value) {
  if (typeof value !== "string" || !value.includes(SCOPED_PO_SEPARATOR)) {
    return null;
  }
  const [branch, po] = value.split(SCOPED_PO_SEPARATOR);
  return { branch, po };
}

export function getEffectiveStatuses(statuses) {
  return Array.isArray(statuses) ? statuses : DEFAULT_PLANNED_STATUSES;
}

export function buildPlannedDataKey({ date, statuses, numberQuery }) {
  return [
    date ? dayjs(date).format("YYYY-MM-DD") : "all",
    getEffectiveStatuses(statuses).join(","),
    String(numberQuery || "").trim(),
  ].join("-");
}

export function buildPrimaryRequestParams({
  page,
  pageSize,
  date,
  statuses,
  numberQuery,
}) {
  const params = {
    "pagination[page]": page,
    "pagination[pageSize]": pageSize,
    "sort[0]": "createDateTime:DESC",
  };
  let andIndex = 0;

  params[`filters[$and][${andIndex}][BASE_TYPE][$eq]`] = 1;
  andIndex += 1;

  const effectiveStatuses = getEffectiveStatuses(statuses);
  if (effectiveStatuses.length > 0) {
    effectiveStatuses.forEach((status, statusIndex) => {
      params[
        `filters[$and][${andIndex}][$or][${statusIndex}][STATUS_NAME][$eqi]`
      ] = status;
    });
    andIndex += 1;
  }

  if (date) {
    const start = new Date(date.year(), date.month(), date.date(), 0, 0, 0).toISOString();
    const end = new Date(date.year(), date.month(), date.date(), 23, 59, 59).toISOString();
    params[`filters[$and][${andIndex}][createDateTime][$gte]`] = start;
    andIndex += 1;
    params[`filters[$and][${andIndex}][createDateTime][$lte]`] = end;
    andIndex += 1;
  }

  const number = String(numberQuery || "").trim();
  if (number) {
    params[`filters[$and][${andIndex}][number][$containsi]`] = number;
  }

  return params;
}

function getCreateTs(item) {
  const raw =
    getField(item, "F81_060_EVENTDATETIME") || getField(item, "createDateTime");
  const ts = dayjs(raw).valueOf();
  return Number.isFinite(ts) ? ts : 0;
}

export function normalizePlannedRows(payload) {
  const list = Array.isArray(payload?.data) ? payload.data : [];
  return list
    .map((x) => (x?.attributes ? { id: x.id, ...x.attributes } : x))
    .filter((item) => isPlannedType(item));
}

export function buildBranchOptions(rows) {
  const values = Array.from(
    new Set(
      rows
        .map((item) => String(getField(item, "OWN_SCNAME") || "").trim())
        .filter(Boolean)
    )
  ).sort(ruSort);

  return [
    { label: "Все филиалы", value: ALL_BRANCHES },
    ...values.map((branch) => ({ label: branch, value: branch })),
  ];
}

export function buildPoOptions(rows, selectedBranch) {
  if (selectedBranch !== ALL_BRANCHES) {
    const values = Array.from(
      new Set(
        rows
          .filter(
            (item) =>
              String(getField(item, "OWN_SCNAME") || "").trim() === selectedBranch
          )
          .map((item) => String(getField(item, "SCNAME") || "").trim())
          .filter(Boolean)
      )
    ).sort(ruSort);

    return [
      { label: "Все ПО", value: ALL_PO },
      ...values.map((po) => ({
        label: po,
        value: makeScopedPoValue(selectedBranch, po),
      })),
    ];
  }

  const byBranch = new Map();
  rows.forEach((item) => {
    const branch = String(getField(item, "OWN_SCNAME") || "").trim();
    const po = String(getField(item, "SCNAME") || "").trim();
    if (!branch || !po) return;
    if (!byBranch.has(branch)) byBranch.set(branch, new Set());
    byBranch.get(branch).add(po);
  });

  const groups = Array.from(byBranch.keys())
    .sort(ruSort)
    .map((branch) => ({
      label: branch,
      options: Array.from(byBranch.get(branch))
        .sort(ruSort)
        .map((po) => ({
          label: po,
          value: makeScopedPoValue(branch, po),
        })),
    }));

  return [{ label: "Все ПО", value: ALL_PO }, ...groups];
}

export function mapPlannedRow(item, sendStatus) {
  const plannedNum =
    getField(item, "F81_010_NUMB") ??
    getField(item, "F81_010_NUMBER") ??
    getField(item, "number");
  const guid = extractGuid(item);
  const sendByGuid = guid ? sendStatus.byGuid[String(guid).toLowerCase()] : null;

  const documentId =
    getField(item, "documentId") ||
    getField(item, "guid") ||
    getField(item, "VIOLATION_GUID_STR") ||
    getField(item, "id");

  return {
    key: getField(item, "id") ?? documentId,
    documentId,
    number: plannedNum ?? "—",
    violationType: Number(getField(item, "BASE_TYPE")) === 1 ? "Плановая" : "—",
    startPlan: formatDateTime(getField(item, "F81_060_EVENTDATETIME")),
    startFact: formatDateTime(getField(item, "STARTDATETIME")),
    endPlan: formatDateTime(getField(item, "F81_070_RESTOR_SUPPLAYDATETIME")),
    endFact: formatDateTime(getField(item, "F81_290_RECOVERYDATETIME")),
    branch: getField(item, "OWN_SCNAME") ?? "—",
    po: getField(item, "SCNAME") ?? "—",
    objectName: getField(item, "F81_041_ENERGOOBJECTNAME") ?? "—",
    addressList: getField(item, "ADDRESS_LIST") ?? "—",
    description: getField(item, "BRIGADE_ACTION") ?? "—",
    statusName: getPlannedStatusName(item),
    szoTags: buildSzoSummaryFromItem(item),
    send: sendByGuid,
    createTs: getCreateTs(item),
    guid,
  };
}

export function filterPlannedRows({
  rows,
  statuses,
  selectedBranch,
  selectedPo,
  sendStatus,
}) {
  const effectiveStatuses = getEffectiveStatuses(statuses);
  return rows
    .filter((item) => effectiveStatuses.includes(getPlannedStatusName(item)))
    .filter((item) => {
      if (selectedBranch === ALL_BRANCHES) return true;
      return String(getField(item, "OWN_SCNAME") || "").trim() === selectedBranch;
    })
    .filter((item) => {
      if (selectedPo === ALL_PO) return true;
      const scoped = parseScopedPoValue(selectedPo);
      const branch = String(getField(item, "OWN_SCNAME") || "").trim();
      const po = String(getField(item, "SCNAME") || "").trim();
      if (scoped) return branch === scoped.branch && po === scoped.po;
      return po === selectedPo;
    })
    .map((item) => mapPlannedRow(item, sendStatus));
}

export function buildPlannedStats(rows) {
  return rows.reduce(
    (acc, item) => {
      if (item.statusName === "запланировано") acc.planned += 1;
      if (item.statusName === "начата") acc.started += 1;
      return acc;
    },
    { planned: 0, started: 0 }
  );
}

export function sortPlannedRows(rows, sorter) {
  const arr = [...rows];
  const cmpStr = (a = "", b = "") =>
    String(a).localeCompare(String(b), "ru", {
      numeric: true,
      sensitivity: "base",
    });

  arr.sort((a, b) => {
    let res = 0;
    switch (sorter.field) {
      case "number":
        res = (Number(a.number) || 0) - (Number(b.number) || 0);
        break;
      case "startPlan":
        res = (a.createTs || 0) - (b.createTs || 0);
        break;
      case "branch":
        res = cmpStr(a.branch, b.branch);
        break;
      case "po":
        res = cmpStr(a.po, b.po);
        break;
      case "objectName":
        res = cmpStr(a.objectName, b.objectName);
        break;
      case "statusName":
        res = cmpStr(a.statusName, b.statusName);
        break;
      default:
        res = (a.createTs || 0) - (b.createTs || 0);
    }
    return sorter.order === "descend" ? -res : res;
  });

  return arr;
}

export function paginateRows(rows, pagination) {
  const startIndex = (pagination.page - 1) * pagination.pageSize;
  return rows.slice(startIndex, startIndex + pagination.pageSize);
}
