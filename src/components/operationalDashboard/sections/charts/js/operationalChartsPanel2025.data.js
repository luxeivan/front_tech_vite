import branchesWithPo2025 from "./branches_with_po_2025.json";

// Источник: /Users/yanutstas/Downloads/branches_with_po_2025.json, помесячные данные 2025.
// Контрольная сумма по полю data.total: 6336.
const SOURCE_YEAR = 2025;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTH_KEYS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const MONTH_LABELS = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];
const DEBUG_KOLOMNA_2025 = true;
const loggedKolomnaWindows = new Set();

export const OPERATIONAL_CHART_2025_SOURCE = branchesWithPo2025;

export const OPERATIONAL_CHART_2025_MONTHLY_VALUES = Object.fromEntries(
  OPERATIONAL_CHART_2025_SOURCE.map((item) => [item.branch, item.data])
);

export const OPERATIONAL_CHART_2025_VALUES = Object.fromEntries(
  Object.entries(OPERATIONAL_CHART_2025_MONTHLY_VALUES).map(([branch, data]) => [
    branch,
    data.total,
  ])
);

const parseIsoDateParts = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) {
    return null;
  }

  return { year, monthIndex, day };
};

const getDaysInMonth = (year, monthIndex) =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

const clampToSourceYear = ({ monthIndex, day }) => ({
  year: SOURCE_YEAR,
  monthIndex,
  day: Math.min(day, getDaysInMonth(SOURCE_YEAR, monthIndex)),
});

const toUtcDay = ({ year, monthIndex, day }) => Date.UTC(year, monthIndex, day);

const addDays = (time, days) => time + days * MS_PER_DAY;

const subtractCalendarMonths = ({ year, monthIndex, day }, months) => {
  const targetMonthNumber = year * 12 + monthIndex - months;
  const targetYear = Math.floor(targetMonthNumber / 12);
  const targetMonthIndex = ((targetMonthNumber % 12) + 12) % 12;

  return {
    year: targetYear,
    monthIndex: targetMonthIndex,
    day: Math.min(day, getDaysInMonth(targetYear, targetMonthIndex)),
  };
};

const getFallbackPeriodParts = () => {
  const now = new Date();
  const end = {
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
    day: now.getDate(),
  };

  return {
    start: subtractCalendarMonths(end, 6),
    end,
  };
};

const getSourceYearWindow = (statsMeta) => {
  const fallback = getFallbackPeriodParts();
  const start = parseIsoDateParts(statsMeta?.periodStart) || fallback.start;
  const end = parseIsoDateParts(statsMeta?.periodEnd) || fallback.end;

  return {
    start: toUtcDay(clampToSourceYear(start)),
    // Помесячные данные не дают точного времени суток, поэтому текущий день считаем включительно.
    end: addDays(toUtcDay(clampToSourceYear(end)), 1),
  };
};

const calculateMonthShare = (monthlyValue, year, monthIndex, windowStart, windowEnd) => {
  const monthStart = Date.UTC(year, monthIndex, 1);
  const monthEnd = Date.UTC(year, monthIndex + 1, 1);
  const overlapStart = Math.max(windowStart, monthStart);
  const overlapEnd = Math.min(windowEnd, monthEnd);

  if (overlapEnd <= overlapStart) return 0;

  const overlapDays = (overlapEnd - overlapStart) / MS_PER_DAY;
  const monthDays = getDaysInMonth(year, monthIndex);

  return Number(monthlyValue || 0) * (overlapDays / monthDays);
};

const formatDebugDate = (time) => new Date(time).toISOString().slice(0, 10);

const logKolomna2025Calculation = (data, windowStart, windowEnd, value) => {
  const windowKey = `${windowStart}-${windowEnd}`;
  if (!DEBUG_KOLOMNA_2025 || loggedKolomnaWindows.has(windowKey)) return;

  loggedKolomnaWindows.add(windowKey);

  const rows = MONTH_KEYS.map((key, monthIndex) => {
    const monthStart = Date.UTC(SOURCE_YEAR, monthIndex, 1);
    const monthEnd = Date.UTC(SOURCE_YEAR, monthIndex + 1, 1);
    const overlapStart = Math.max(windowStart, monthStart);
    const overlapEnd = Math.min(windowEnd, monthEnd);
    const monthDays = getDaysInMonth(SOURCE_YEAR, monthIndex);
    const overlapDays =
      overlapEnd > overlapStart ? (overlapEnd - overlapStart) / MS_PER_DAY : 0;
    const monthValue = Number(data[key] || 0);
    const share = overlapDays > 0 ? monthValue * (overlapDays / monthDays) : 0;

    return {
      month: MONTH_LABELS[monthIndex],
      monthValue,
      monthDays,
      overlapDays,
      share: Number(share.toFixed(2)),
    };
  }).filter((row) => row.overlapDays > 0);

  console.groupCollapsed("[dashboard-oo] Расчет 2025 для Коломны");
  console.log("Окно 2025:", formatDebugDate(windowStart), "-", formatDebugDate(windowEnd));
  console.table(rows);
  console.log("Сумма до округления:", Number(value.toFixed(2)));
  console.log("Итог после округления:", Math.round(value));
  console.groupEnd();
};

export const getOperationalChart2025Values = (statsMeta) => {
  const { start, end } = getSourceYearWindow(statsMeta);

  return Object.fromEntries(
    Object.entries(OPERATIONAL_CHART_2025_MONTHLY_VALUES).map(([branch, data]) => {
      const value = MONTH_KEYS.reduce(
        (sum, key, monthIndex) =>
          sum + calculateMonthShare(data[key], SOURCE_YEAR, monthIndex, start, end),
        0
      );

      if (branch === "Коломенский") {
        logKolomna2025Calculation(data, start, end, value);
      }

      return [branch, Math.round(value)];
    })
  );
};

const calculatePeriodValue = (data, start, end) =>
  MONTH_KEYS.reduce(
    (sum, key, monthIndex) =>
      sum + calculateMonthShare(data?.[key], SOURCE_YEAR, monthIndex, start, end),
    0
  );

export const getOperationalChart2025PoValues = (branchName, statsMeta) => {
  const sourceBranch = OPERATIONAL_CHART_2025_SOURCE.find(
    (item) => item?.branch === branchName
  );
  const productionOffices = Array.isArray(sourceBranch?.productionOffices)
    ? sourceBranch.productionOffices
    : [];
  const { start, end } = getSourceYearWindow(statsMeta);

  return Object.fromEntries(
    productionOffices
      .filter((item) => item?.name)
      .map((item) => [item.name, Math.round(calculatePeriodValue(item.data, start, end))])
  );
};
