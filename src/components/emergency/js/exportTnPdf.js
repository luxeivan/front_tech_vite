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

// Как на /dashboard-oo: отдельные СЗО-колонки, без ухода за край страницы.
const HEADERS = [
  { key: "branch", title: "Филиал => ПО => ГО", width: 145 },
  { key: "population", title: "Население", width: 48 },
  { key: "mkd", title: "МКД", width: 34 },
  { key: "boilerCtp", title: "Котел. ЦТП", width: 48 },
  { key: "vzuVns", title: "ВЗУ ВНС", width: 46 },
  { key: "kns", title: "КНС", width: 32 },
  { key: "medical", title: "Больницы Поликлиники", width: 58 },
  { key: "schools", title: "Школы д.сады", width: 52 },
  { key: "staff", title: "Персонал", width: 44 },
  { key: "pes", title: "ПЭС", width: 32 },
  { key: "ovb", title: "ОВБ", width: 32 },
];

const SUM_FIELDS = [
  "population",
  "mkd",
  "boilerCtp",
  "vzuVns",
  "kns",
  "medical",
  "schools",
  "staff",
  "pes",
];

function exportFilename() {
  const ts = dayjs().tz("Europe/Moscow").format("DD.MM.YYYY HH-mm-ss");
  return `${ts}.pdf`;
}

function addFields(row, fields) {
  return fields.reduce((sum, field) => sum + toNumber(pick(row, field)), 0);
}

function emptyTotals() {
  return {
    population: 0,
    mkd: 0,
    boilerCtp: 0,
    vzuVns: 0,
    kns: 0,
    medical: 0,
    schools: 0,
    staff: 0,
    pes: 0,
    ovb: "",
  };
}

function addRowToTotals(totals, row) {
  totals.population += toNumber(pick(row, "POPULATION_COUNT"));
  totals.mkd += toNumber(pick(row, "MKD_ALL"));
  totals.boilerCtp += addFields(row, ["BOILER_ALL", "CTP_ALL"]);
  totals.vzuVns += addFields(row, ["WELLS_ALL", "VNS_ALL"]);
  totals.kns += toNumber(pick(row, "KNS_ALL"));
  totals.medical += addFields(row, ["HOSPITALS_ALL", "CLINICS_ALL"]);
  totals.schools += addFields(row, ["SCHOOLS_ALL", "KINDERGARTENS_ALL"]);
  totals.staff += toNumber(pick(row, "EMPLOYEECOUNT"));
}

const stripFilialSuffix = (value) =>
  s(value).replace(/\s+филиал\s*$/i, "").replace(/\s+/g, " ").trim();

const stripPoSuffix = (value) =>
  s(value)
    .replace(/\s+производственное\s+отделение\s*$/i, "")
    .replace(/\s+ПО\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

const stripGoSuffix = (value) =>
  s(value)
    .replace(/^\s*г\s*\.?\s*о\s*\.?\s*/i, "")
    .replace(/\s+г\s*\.?\s*о\s*\.?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

// «Красногорский => Истринское => Красногорск»
function buildPathLabel(row) {
  const filial = stripFilialSuffix(getOperationalBranchByRow(row) || "");
  const po = stripPoSuffix(getOperationalPoByRow(row) || "");
  const go = stripGoSuffix(getOperationalDistrictByRow(row) || pick(row, "DISTRICT") || "");

  return [filial, po, go].filter(Boolean).join(" => ");
}

function buildSummary(rows) {
  const summary = { branch: "ВСЕГО", ...emptyTotals() };
  rows.forEach((row) => {
    SUM_FIELDS.forEach((field) => {
      summary[field] += toNumber(row[field]);
    });
  });
  return summary;
}

function rowToPdfRow(row) {
  return HEADERS.map(({ key }) => {
    const value = row?.[key];
    if (value === undefined || value === null) return { text: "" };
    if (typeof value === "number") return { text: String(value), alignment: "right" };
    return { text: String(value) };
  });
}

function writePdf(dataRows) {
  const headerRow = HEADERS.map(({ title }, index) => ({
    text: title,
    bold: true,
    alignment: index === 0 ? "left" : "center",
    fontSize: 7,
  }));

  // Сумма ширин ≈ 571 + * — влезает в A4 landscape (~800pt с полями).
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
          widths: HEADERS.map(({ width, title }, index) =>
            index === 0 ? "*" : width
          ),
          body: [headerRow, ...dataRows],
          layout: {
            hLineColor: () => "#d9d9d9",
            vLineColor: () => "#d9d9d9",
            hLineWidth: () => 0.4,
            vLineWidth: () => 0.4,
            paddingLeft: () => 3,
            paddingRight: () => 3,
            paddingTop: () => 3,
            paddingBottom: () => 3,
            fillColor: (rowIndex) =>
              rowIndex === 0 ? "#f0f0f0" : rowIndex % 2 === 0 ? "#fafafa" : null,
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

/**
 * Выгрузка аварийных в PDF:
 * Филиал => ПО => ГО | Население | МКД | Котел. ЦТП | ВЗУ ВНС | КНС |
 * Больницы Поликлиники | Школы д.сады | Персонал | ПЭС | ОВБ.
 * СЗО — отдельные колонки как на /dashboard-oo.
 */
export async function exportEmergencyTnPdf(items) {
  const list = (Array.isArray(items) ? items : []).filter(isOperationalDashboardRow);

  if (!list.length) {
    writePdf([]);
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

  const pathMap = new Map();
  list.forEach((row) => {
    const branch = getOperationalBranchByRow(row);
    if (!branch) return;

    const path = buildPathLabel(row) || stripFilialSuffix(branch);
    if (!pathMap.has(path)) {
      const resourceRow = resourceByBranch.get(branch);
      pathMap.set(path, {
        key: path,
        branch: path,
        ...emptyTotals(),
        pes: toNumber(resourceRow?.pes),
        ovb: resourceRow?.ovb ?? "",
      });
    }
    addRowToTotals(pathMap.get(path), row);
  });

  const pathRows = [...pathMap.values()].sort((a, b) =>
    String(a.branch).localeCompare(String(b.branch), "ru")
  );

  if (!pathRows.length) {
    writePdf([]);
    return;
  }

  const summary = buildSummary(pathRows);
  const dataRows = [...pathRows, summary].map(rowToPdfRow);
  writePdf(dataRows);
}
