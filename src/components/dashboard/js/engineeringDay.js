import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const ENGINEERING_DAY_TIMEZONE = "Europe/Moscow";
export const ENGINEERING_DAY_START_HOUR = 8;

export const moscowDayjs = (value) =>
  value ? dayjs(value).tz(ENGINEERING_DAY_TIMEZONE) : dayjs().tz(ENGINEERING_DAY_TIMEZONE);

export const engineeringDayKey = (value) =>
  value
    ? moscowDayjs(value)
        .subtract(ENGINEERING_DAY_START_HOUR, "hour")
        .format("YYYY-MM-DD")
    : null;

export const engineeringDayStart = (value) =>
  moscowDayjs(value)
    .subtract(ENGINEERING_DAY_START_HOUR, "hour")
    .startOf("day")
    .add(ENGINEERING_DAY_START_HOUR, "hour");

export const calendarEngineeringDayStart = (value) =>
  moscowDayjs(value).startOf("day").add(ENGINEERING_DAY_START_HOUR, "hour");

export const buildEngineeringDays7 = (reference = dayjs()) =>
  Array.from({ length: 7 }, (_, i) =>
    engineeringDayStart(reference).subtract(6 - i, "day")
  );

export const buildEngineeringSince7dIso = (reference = dayjs()) =>
  engineeringDayStart(reference).subtract(6, "day").toISOString();

export const isWithinEngineeringDay = (value, day) => {
  if (!value || !day) return false;
  const start = engineeringDayStart(day);
  const end = start.add(1, "day");
  const current = moscowDayjs(value);
  return !current.isBefore(start) && current.isBefore(end);
};
