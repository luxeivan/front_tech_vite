import { isOpenTN, pick, recoveryDate, startDate } from "./dashboardCommon";
import {
  buildEngineeringDays7,
  buildEngineeringSince7dIso,
  isWithinEngineeringDay,
} from "./engineeringDay";

export const buildDays7 = buildEngineeringDays7;

export const buildSince7dIso = buildEngineeringSince7dIso;

export const mapStrapiRows = (payload) =>
  Array.isArray(payload?.data)
    ? payload.data.map((x) => (x?.attributes ? { id: x.id, ...x.attributes } : x))
    : [];

export const buildDailyStats = (rows7d, days7) => {
  const ruDow = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

  return days7.map((d) => {
    const createdDay = rows7d.filter((r) => {
      const dt = startDate(r);
      return isWithinEngineeringDay(dt, d);
    });

    const isDeletedRow = (r) => {
      const st = String(pick(r, "STATUS_NAME") ?? r?.STATUS_NAME ?? "").toLowerCase();
      const del = pick(r, "deletedAt") ?? r?.deletedAt ?? null;
      return (
        st.includes("удален") ||
        st.includes("delete") ||
        (del && isWithinEngineeringDay(del, d))
      );
    };

    const isClosedRow = (r) => {
      if (isOpenTN(r) || isDeletedRow(r)) return false;
      const upd = pick(r, "updatedAt") ?? r?.updatedAt ?? null;
      const rec = recoveryDate(r);
      return (
        (upd && isWithinEngineeringDay(upd, d)) ||
        (rec && isWithinEngineeringDay(rec, d))
      );
    };

    const opened = createdDay.filter((r) => isOpenTN(r) && !isDeletedRow(r)).length;
    const closed = createdDay.filter((r) => isClosedRow(r)).length;
    const deleted = createdDay.filter((r) => isDeletedRow(r)).length;
    const total = opened + closed;

    return { label: ruDow[d.day()], opened, closed, deleted, total };
  });
};
