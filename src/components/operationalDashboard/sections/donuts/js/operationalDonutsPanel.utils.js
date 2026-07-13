import dayjs from "dayjs";

import {
  districtName,
  getRowPeopleCount,
  isDashboardBaseType,
  isOpenTN,
  pick,
  startDate,
  toNumber,
} from "../../../../dashboard/js/dashboardCommon";

const isMediumVoltageLineOutage = (row) => {
  const raw = row?.data?.data ?? row?.data ?? row ?? {};
  const lines = toNumber(raw.LINESN_ALL ?? raw.LINESN_SECTION);
  const voltage = String(raw.VOLTAGECLASS ?? pick(row, "VOLTAGECLASS") ?? "").toLowerCase();
  return lines > 0 || /(^|[^0-9])(3|6|10|20)\s*кв/.test(voltage);
};

const durationHours = (row, now) => {
  const startedAt = dayjs(startDate(row));
  if (!startedAt.isValid()) return null;
  const hours = now.diff(startedAt, "minute") / 60;
  return Number.isFinite(hours) && hours >= 0 ? hours : null;
};

export const buildDurationDonutData = (rows, now = dayjs()) => {
  const source = Array.isArray(rows) ? rows : [];
  const buckets = {
    under2h: [],
    over2h: [],
    over4h: [],
  };

  source
    .filter((row) => isDashboardBaseType(row) && isOpenTN(row) && isMediumVoltageLineOutage(row))
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

export const buildPopulationDonutData = (rows) => {
  const source = Array.isArray(rows) ? rows : [];
  const districtTotals = new Map();

  source
    .filter((row) => isDashboardBaseType(row) && isOpenTN(row))
    .forEach((row) => {
      const raw = districtName(row) || "Без округа";
      const district = raw.replace(/\s*г\.?\s*о\.?\s*/g, "").trim();
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
