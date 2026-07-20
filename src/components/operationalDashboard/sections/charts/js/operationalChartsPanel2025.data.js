// Источник: /Users/yanutstas/Downloads/branches.json, помесячные данные 2025.
// Контрольная сумма по полю total: 6336.
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

export const OPERATIONAL_CHART_2025_MONTHLY_VALUES = {
  Домодедовский: {
    january: 59,
    february: 58,
    march: 88,
    april: 102,
    may: 82,
    june: 95,
    july: 123,
    august: 114,
    september: 70,
    october: 79,
    november: 90,
    december: 76,
    total: 1036,
  },
  Коломенский: {
    january: 35,
    february: 32,
    march: 42,
    april: 71,
    may: 65,
    june: 87,
    july: 112,
    august: 67,
    september: 68,
    october: 41,
    november: 61,
    december: 65,
    total: 746,
  },
  Красногорский: {
    january: 85,
    february: 55,
    march: 82,
    april: 82,
    may: 126,
    june: 62,
    july: 125,
    august: 79,
    september: 70,
    october: 57,
    november: 75,
    december: 82,
    total: 980,
  },
  Мытищинский: {
    january: 31,
    february: 38,
    march: 49,
    april: 44,
    may: 74,
    june: 49,
    july: 69,
    august: 48,
    september: 70,
    october: 37,
    november: 48,
    december: 59,
    total: 616,
  },
  Одинцовский: {
    january: 73,
    february: 89,
    march: 84,
    april: 107,
    may: 103,
    june: 102,
    july: 105,
    august: 102,
    september: 66,
    october: 57,
    november: 88,
    december: 69,
    total: 1058,
  },
  "Орехово-Зуевский": {
    january: 4,
    february: 3,
    march: 5,
    april: 7,
    may: 8,
    june: 4,
    july: 6,
    august: 8,
    september: 6,
    october: 1,
    november: 7,
    december: 5,
    total: 64,
  },
  "Павлово-Посадский": {
    january: 42,
    february: 29,
    march: 32,
    april: 40,
    may: 44,
    june: 43,
    july: 46,
    august: 20,
    september: 32,
    october: 32,
    november: 45,
    december: 28,
    total: 433,
  },
  Раменский: {
    january: 30,
    february: 49,
    march: 46,
    april: 70,
    may: 74,
    june: 69,
    july: 74,
    august: 46,
    september: 54,
    october: 37,
    november: 47,
    december: 48,
    total: 644,
  },
  "Сергиево-Посадский": {
    january: 10,
    february: 5,
    march: 10,
    april: 8,
    may: 26,
    june: 5,
    july: 17,
    august: 8,
    september: 9,
    october: 8,
    november: 5,
    december: 6,
    total: 117,
  },
  Щелковский: {
    january: 43,
    february: 38,
    march: 36,
    april: 52,
    may: 61,
    june: 52,
    july: 77,
    august: 67,
    september: 70,
    october: 44,
    november: 41,
    december: 61,
    total: 642,
  },
};

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

export const getOperationalChart2025Values = (statsMeta) => {
  const { start, end } = getSourceYearWindow(statsMeta);

  return Object.fromEntries(
    Object.entries(OPERATIONAL_CHART_2025_MONTHLY_VALUES).map(([branch, data]) => {
      const value = MONTH_KEYS.reduce(
        (sum, key, monthIndex) =>
          sum + calculateMonthShare(data[key], SOURCE_YEAR, monthIndex, start, end),
        0
      );

      return [branch, Math.round(value)];
    })
  );
};
