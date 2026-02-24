import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { isOpenTN, pick, recoveryDate, startDate } from "./dashboardCommon";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.tz.setDefault("Europe/Moscow");

export const buildDays7 = () =>
  Array.from({ length: 7 }, (_, i) =>
    dayjs().tz("Europe/Moscow").startOf("day").subtract(6 - i, "day")
  );

export const buildSince7dIso = () =>
  dayjs().tz("Europe/Moscow").startOf("day").add(8, "hour").subtract(6, "day").toISOString();

export const mapStrapiRows = (payload) =>
  Array.isArray(payload?.data)
    ? payload.data.map((x) => (x?.attributes ? { id: x.id, ...x.attributes } : x))
    : [];

export const buildDailyStats = (rows7d, days7) => {
  const ruDow = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

  return days7.map((d) => {
    const d0 = d.tz("Europe/Moscow").startOf("day").add(8, "hour");
    const d1 = d0.add(1, "day");

    const createdDay = rows7d.filter((r) => {
      const dt = startDate(r);
      if (!dt) return false;
      const dtz = dayjs(dt).tz("Europe/Moscow");
      return dtz.isSameOrAfter(d0) && dtz.isBefore(d1);
    });

    const isDeletedRow = (r) => {
      const st = String(pick(r, "STATUS_NAME") ?? r?.STATUS_NAME ?? "").toLowerCase();
      const del = pick(r, "deletedAt") ?? r?.deletedAt ?? null;
      return (
        st.includes("удален") ||
        st.includes("delete") ||
        (del && dayjs(del).isSameOrAfter(d0) && dayjs(del).isBefore(d1))
      );
    };

    const isClosedRow = (r) => {
      if (isOpenTN(r) || isDeletedRow(r)) return false;
      const upd = pick(r, "updatedAt") ?? r?.updatedAt ?? null;
      const rec = recoveryDate(r);
      return (
        (upd && dayjs(upd).isSameOrAfter(d0) && dayjs(upd).isBefore(d1)) ||
        (rec && dayjs(rec).isSameOrAfter(d0) && dayjs(rec).isBefore(d1))
      );
    };

    const opened = createdDay.filter((r) => isOpenTN(r) && !isDeletedRow(r)).length;
    const closed = createdDay.filter((r) => isClosedRow(r)).length;
    const deleted = createdDay.filter((r) => isDeletedRow(r)).length;
    const total = opened + closed;

    return { label: ruDow[d.day()], opened, closed, deleted, total };
  });
};
