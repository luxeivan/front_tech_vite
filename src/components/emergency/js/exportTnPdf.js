import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  buildOperationalBranchRows,
  getOperationalBranchByRow,
  getOperationalDistrictByRow,
  getOperationalPoByRow,
  isOperationalDashboardRow,
} from "../../operationalDashboard/sections/districts/js/operationalDistrictsPanel.utils";
import { fetchTnFilialyRows } from "../../../utils/tnFilialyApi";
import { pick, s, toNumber } from "../../dashboard/js/dashboardCommon";

// pdfmake 0.3.x: vfs_fonts не вешается на window.pdfMake сам — регистрируем вручную.
const vfs = pdfFonts?.default ?? pdfFonts;
if (pdfMake && typeof pdfMake.addVirtualFileSystem === "function" && vfs) {
  pdfMake.addVirtualFileSystem(vfs);
}

dayjs.extend(utc);
dayjs.extend(timezone);

// Метрики — без МКД и ОВБ.
const METRIC_COLUMNS = [
  { key: "population", title: "Население", width: 48 },
  { key: "boilerCtp", title: "Котел. ЦТП", width: 48 },
  { key: "vzuVns", title: "ВЗУ ВНС", width: 46 },
  { key: "kns", title: "КНС", width: 32 },
  { key: "medical", title: "Больницы Поликлиники", width: 58 },
  { key: "schools", title: "Школы\nДет.Сады", width: 52 },
  { key: "staff", title: "Персонал", width: 44 },
  { key: "pes", title: "ПЭС", width: 32 },
];

const SUM_FIELDS = METRIC_COLUMNS.map((c) => c.key);

function exportFilename() {
  const ts = dayjs().tz("Europe/Moscow").format("DD.MM.YYYY HH-mm-ss");
  return `${ts}.pdf`;
}

function addFields(row, fields) {
  return fields.reduce((sum, field) => sum + toNumber(pick(row, field)), 0);
}

function emptyTotals() {
  const totals = { tnCount: 0 };
  METRIC_COLUMNS.forEach(({ key }) => {
    totals[key] = 0;
  });
  return totals;
}

function mergeTotals(target, source) {
  SUM_FIELDS.forEach((field) => {
    target[field] += toNumber(source[field]);
  });
  target.tnCount += toNumber(source.tnCount);
  return target;
}

function addRowToTotals(totals, row) {
  totals.tnCount += 1;
  totals.population += toNumber(pick(row, "POPULATION_COUNT"));
  totals.boilerCtp += addFields(row, ["BOILER_ALL", "CTP_ALL"]);
  totals.vzuVns += addFields(row, ["WELLS_ALL", "VNS_ALL"]);
  totals.kns += toNumber(pick(row, "KNS_ALL"));
  totals.medical += addFields(row, ["HOSPITALS_ALL", "CLINICS_ALL"]);
  totals.schools += addFields(row, ["SCHOOLS_ALL", "KINDERGARTENS_ALL"]);
  totals.staff += toNumber(pick(row, "EMPLOYEECOUNT"));
}

function nameOr(value, fallback) {
  const v = s(value);
  return v || fallback;
}

function metricCells(totals) {
  return METRIC_COLUMNS.map(({ key }) => {
    const value = totals?.[key];
    if (value === undefined || value === null || value === "") {
      return { text: "0", alignment: "right" };
    }
    if (typeof value === "number") return { text: String(value), alignment: "right" };
    return { text: String(value) };
  });
}

// Цвета как на /dashboard-oo.
const COLORS = {
  headerBg: "#285a9c",
  headerText: "#ffffff",
  // между шапкой (#285a9c) и ПО (#e2eef9)
  filialBg: "#4d7db5",
  filialText: "#ffffff",
  poBg: "#e2eef9",
  poText: "#0a5f9e",
  goBg: "#e2eef9",
  goText: "#0a5f9e",
  totalBg: "#94add6",
  totalText: "#101827",
  border: "#d9d9d9",
};

function rowPalette(level, isTotal = false) {
  if (isTotal) return { bg: COLORS.totalBg, text: COLORS.totalText };
  if (level === 0) return { bg: COLORS.filialBg, text: COLORS.filialText };
  if (level === 1) return { bg: COLORS.poBg, text: COLORS.poText };
  return { bg: COLORS.goBg, text: COLORS.goText };
}

function headerRow() {
  return [
    {
      text: "Филиал / ПО / ГО",
      bold: true,
      alignment: "left",
      fontSize: 7,
      color: COLORS.headerText,
      fillColor: COLORS.headerBg,
    },
    ...METRIC_COLUMNS.map(({ title }) => ({
      text: title,
      bold: true,
      alignment: "center",
      fontSize: 7,
      color: COLORS.headerText,
      fillColor: COLORS.headerBg,
    })),
  ];
}

function outlineText(text, { id, parentId = null, expanded = true } = {}) {
  return {
    text,
    bold: true,
    ...(id ? { outline: true, outlineText: text, outlineExpanded: expanded } : {}),
    ...(parentId ? { outlineParentId: parentId } : {}),
  };
}

function labelCell({ level, label, id, parentId, color }) {
  // level: 0 — филиал, 1 — ПО, 2 — ГО
  const indent = level * 12;
  const prefix = level === 0 ? "" : level === 1 ? "  " : "    ";
  return {
    stack: [
      {
        ...outlineText(`${prefix}${label}`, {
          id: level < 2 ? id : undefined,
          parentId,
          expanded: true,
        }),
        fontSize: level === 0 ? 8 : 7,
        color,
        margin: [indent, 0, 0, 0],
      },
    ],
    margin: [0, 1, 0, 1],
  };
}

function dataRow({ level, label, totals, id, parentId, isTotal = false }) {
  const { bg, text: textColor } = rowPalette(level, isTotal);

  return [
    labelCell({ level, label, id, parentId, color: textColor }),
    ...metricCells(totals),
  ].map((cell, index) => {
    if (index === 0) {
      return {
        ...cell,
        fillColor: bg,
        color: textColor,
      };
    }
    return {
      ...cell,
      fillColor: bg,
      color: textColor,
      fontSize: 7,
      bold: level < 2 || isTotal,
    };
  });
}

function buildHierarchy(list, resourceByBranch) {
  const filialMap = new Map();

  list.forEach((row) => {
    const filialName = nameOr(getOperationalBranchByRow(row), "Без филиала");
    const poName = nameOr(getOperationalPoByRow(row), "Без ПО");
    const goName = nameOr(
      getOperationalDistrictByRow(row) || pick(row, "DISTRICT"),
      "Без ГО"
    );

    if (!filialMap.has(filialName)) {
      const resourceRow = resourceByBranch.get(getOperationalBranchByRow(row) || filialName);
      filialMap.set(filialName, {
        name: filialName,
        totals: { ...emptyTotals(), pes: toNumber(resourceRow?.pes) },
        pos: new Map(),
      });
    }
    const filial = filialMap.get(filialName);

    if (!filial.pos.has(poName)) {
      filial.pos.set(poName, {
        name: poName,
        totals: emptyTotals(),
        gos: new Map(),
      });
    }
    const po = filial.pos.get(poName);

    if (!po.gos.has(goName)) {
      po.gos.set(goName, {
        name: goName,
        totals: emptyTotals(),
      });
    }

    addRowToTotals(po.gos.get(goName).totals, row);
  });

  filialMap.forEach((filial) => {
    const filialAgg = { ...emptyTotals(), pes: filial.totals.pes };
    filial.pos.forEach((po) => {
      const poAgg = emptyTotals();
      po.gos.forEach((go) => mergeTotals(poAgg, go.totals));
      po.totals = poAgg;
      mergeTotals(filialAgg, poAgg);
    });
    filial.totals = {
      ...filialAgg,
      pes: filial.totals.pes,
    };
  });

  return [...filialMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "ru")
  );
}

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
}

function buildBody(filials) {
  const body = [headerRow()];
  const grand = emptyTotals();

  filials.forEach((filial) => {
    const fId = `f-${slug(filial.name)}`;
    body.push(
      dataRow({
        level: 0,
        label: filial.name,
        totals: filial.totals,
        id: fId,
        parentId: null,
      })
    );
    mergeTotals(grand, {
      ...filial.totals,
      tnCount: filial.totals.tnCount,
    });

    const pos = [...filial.pos.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
    pos.forEach((po) => {
      const pId = `${fId}-po-${slug(po.name)}`;
      body.push(
        dataRow({
          level: 1,
          label: po.name,
          totals: po.totals,
          id: pId,
          parentId: fId,
        })
      );

      const gos = [...po.gos.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
      gos.forEach((go) => {
        body.push(
          dataRow({
            level: 2,
            label: go.name,
            totals: go.totals,
            id: null,
            parentId: pId,
          })
        );
      });
    });
  });

  body.push(
    dataRow({
      level: 0,
      label: "ВСЕГО",
      totals: grand,
      id: "total",
      parentId: null,
      isTotal: true,
    })
  );

  return body;
}

function writePdf(filials) {
  const widths = ["*", ...METRIC_COLUMNS.map(({ width }) => width)];
  const body = buildBody(filials);

  const docDefinition = {
    pageOrientation: "landscape",
    pageSize: "A4",
    pageMargins: [16, 24, 16, 24],
    content: [
      {
        text: "Аварийные ТН",
        style: "header",
        margin: [0, 0, 0, 8],
      },
      {
        table: {
          headerRows: 1,
          widths,
          body,
          dontBreakRows: false,
          keepWithHeaderRows: 1,
        },
        layout: {
          hLineColor: () => COLORS.border,
          vLineColor: () => COLORS.border,
          hLineWidth: () => 0.4,
          vLineWidth: () => 0.4,
          paddingLeft: () => 3,
          paddingRight: () => 3,
          paddingTop: () => 2,
          paddingBottom: () => 2,
          fillColor: (rowIndex, node) => {
            if (rowIndex === 0) return COLORS.headerBg;
            const cell = node?.table?.body?.[rowIndex]?.[0];
            if (cell && typeof cell === "object" && cell.fillColor) return cell.fillColor;
            return null;
          },
        },
        fontSize: 7,
      },
    ],
    styles: {
      header: {
        fontSize: 13,
        bold: true,
      },
    },
    defaultStyle: {
      fontSize: 7,
    },
  };

  pdfMake.createPdf(docDefinition).download(exportFilename());
}

function writeEmptyPdf() {
  const docDefinition = {
    pageOrientation: "landscape",
    pageSize: "A4",
    pageMargins: [24, 30, 24, 30],
    content: [
      { text: "Аварийные ТН", style: "header" },
      { text: "Нет данных для выгрузки по текущему фильтру.", margin: [0, 12, 0, 0] },
    ],
    styles: { header: { fontSize: 13, bold: true } },
  };
  pdfMake.createPdf(docDefinition).download(exportFilename());
}

/**
 * Иерархическая выгрузка PDF: Филиал → ПО → ГО,
 * подытоги на каждом уровне, bookmarks в панели оутлайнов (раскрытие),
 * колонки СЗО/метрик как на /dashboard-oo. Масштаб от 1 до сотен строк.
 */
export async function exportEmergencyTnPdf(items) {
  const list = (Array.isArray(items) ? items : []).filter(isOperationalDashboardRow);

  if (!list.length) {
    writeEmptyPdf();
    return;
  }

  let filialRows = [];
  try {
    filialRows = await fetchTnFilialyRows();
  } catch {
    filialRows = [];
  }

  const resourceByBranch = new Map(
    buildOperationalBranchRows(list, filialRows, null).map((row) => [row.branch, row])
  );

  const filials = buildHierarchy(list, resourceByBranch);
  if (!filials.length) {
    writeEmptyPdf();
    return;
  }

  writePdf(filials);
}
