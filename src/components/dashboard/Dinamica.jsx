import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, Skeleton, Typography } from "antd";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

dayjs.tz.setDefault("Europe/Moscow");

import axios from "axios";

const { Text } = Typography;
const URL = import.meta.env.VITE_URL_BACKEND;

const pick = (obj, key) =>
  obj?.[key] ??
  obj?.attributes?.[key] ??
  obj?.data?.[key] ??
  obj?.data?.data?.[key] ??
  null;

const isOpenTN = (row) => {
  const v =
    row?.isActive ??
    row?.data?.isActive ??
    row?.data?.data?.isActive ??
    row?.attributes?.isActive ??
    (row?.attributes && row.attributes.isActive?.value);
  return v === true || v === 1 || v === "true";
};

const startDate = (row) =>
  pick(row, "createDateTime") ?? pick(row, "F81_060_EVENTDATETIME") ?? null;

const recoveryDate = (row) =>
  pick(row, "F81_290_RECOVERYDATETIME") ??
  pick(row, "F81_070_RESTOR_SUPPLAYDATETIME") ??
  null;

const Sparkline7 = ({ points }) => {
  const w = 900,
    h = 120,
    padX = 24,
    padY = 22;
  const max = Math.max(1, ...points.map((p) => Number(p.total || 0)));
  const step = points.length > 1 ? (w - 2 * padX) / (points.length - 1) : 0;

  const xy = points.map((p, i) => {
    if (p.total == null) return null;
    return [
      padX + i * step,
      h - padY - (h - 2 * padY) * (p.total / max),
    ];
  });

  const poly = xy.map((p) => p?.join(",")).filter(Boolean).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 140 }}>
      <polyline points={poly} fill="none" stroke="#ff4d4f" strokeWidth="2" />
      {xy.map((pt, i) => {
        if (!pt) return null;
        const [x, y] = pt;
        const p = points[i];
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="4" fill="#ff4d4f">
              <title>{`${p.label.toUpperCase()}: всего ${p.total}
— открыто: ${p.opened}
— закрыто: ${p.closed}
— удалено: ${p.deleted}`}</title>
            </circle>
            <text
              x={x}
              y={y - 8}
              fontSize="12"
              textAnchor="middle"
              fill="#595959"
            >
              {p.total}
            </text>
            <text
              x={x}
              y={h - 8}
              fontSize="12"
              textAnchor="middle"
              fill="#8c8c8c"
            >
              {p.label}
            </text>
          </g>
        );
      })}
      <line
        x1={padX}
        y1={h - padY}
        x2={w - padX}
        y2={h - padY}
        stroke="#f0f0f0"
      />
    </svg>
  );
};

export default function Dinamica7Days() {
  const [rows7d, setRows7d] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const esRef = useRef(null);

  const ruDow = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

  const days7 = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        dayjs().tz("Europe/Moscow").startOf("day").subtract(6 - i, "day")
      ),
    []
  );

  const daily = useMemo(() => {
    return days7.map((d) => {
      console.group("[Dinamica][day]", d.format("YYYY-MM-DD"), d.format("dd"));
      // сутки считаем с 08:00 МСК
      const d0 = d.tz("Europe/Moscow").startOf("day").add(8, "hour");
      const d1 = d0.add(1, "day");

      console.log("Окно дня:", d0.toISOString(), "—", d1.toISOString());

      const createdDay = rows7d.filter((r) => {
        const dt = startDate(r);
        if (!dt) return false;
        const dtz = dayjs(dt).tz("Europe/Moscow");
        return dtz.isSameOrAfter(d0) && dtz.isBefore(d1);
      });

      console.log("Всего записей за день:", createdDay.length);
      createdDay.slice(0, 5).forEach((r, i) => {
        console.log(
          "row",
          i,
          "createDateTime=",
          startDate(r),
          "parsed=",
          startDate(r) ? dayjs(startDate(r)).toISOString() : null
        );
      });

      const isDeletedRow = (r) => {
        const st = String(
          pick(r, "STATUS_NAME") ?? r?.STATUS_NAME ?? ""
        ).toLowerCase();
        const upd = pick(r, "updatedAt") ?? r?.updatedAt ?? null;
        const del = pick(r, "deletedAt") ?? r?.deletedAt ?? null;
        return (
          st.includes("удален") || st.includes("delete") || 
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

      const opened = createdDay.filter(
        (r) => isOpenTN(r) && !isDeletedRow(r)
      ).length;
      const closed = createdDay.filter((r) => isClosedRow(r)).length;
      const deleted = createdDay.filter((r) => isDeletedRow(r)).length;
      const total = opened + closed;

      console.log("Итого:", { opened, closed, deleted, total });
      console.groupEnd();

      return { label: ruDow[d.day()], opened, closed, deleted, total };
    });
  }, [rows7d, days7]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const jwt = localStorage.getItem("jwt");
      if (!jwt) throw new Error("Нет JWT: авторизуйтесь");

      // загружаем данные с учётом суток с 08:00 МСК
      const since7d = dayjs()
        .tz("Europe/Moscow")
        .startOf("day")
        .add(8, "hour")
        .subtract(6, "day")
        .toISOString();

      console.log("[Dinamica][load] since7d =", since7d);

      const headers = { Authorization: `Bearer ${jwt}` };

      let page = 1;
      const pageSize = 100;
      let all = [];

      while (true) {
        const qs = [
          `pagination[page]=${page}`,
          `pagination[pageSize]=${pageSize}`,
          "sort[0]=createDateTime:DESC",
          `filters[createDateTime][$gte]=${encodeURIComponent(since7d)}`,
        ].join("&");

        const resp = await axios.get(
          `${URL}/api/teh-narusheniyas?${qs}`,
          { headers }
        );

        const chunk = Array.isArray(resp?.data?.data)
          ? resp.data.data.map((x) =>
              x?.attributes ? { id: x.id, ...x.attributes } : x
            )
          : [];

        console.log(
          "[Dinamica][load] page",
          page,
          "rows =",
          chunk.length
        );

        all.push(...chunk);

        if (chunk.length < pageSize) break;
        page += 1;
      }

      console.log("[Dinamica][load] rows7d total =", all.length);

      all.slice(0, 5).forEach((r, i) => {
        console.log(
          "row",
          i,
          "createDateTime=",
          startDate(r),
          "parsed=",
          startDate(r) ? dayjs(startDate(r)).toISOString() : null
        );
      });

      setRows7d(all);
    } catch (e) {
      setError(e?.message || "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!URL) return;
    try {
      const es = new EventSource(`${URL}/services/event`);
      esRef.current = es;
      es.onmessage = () => setTimeout(load, 350);
      es.onerror = () => {
        es.close();
        esRef.current = null;
        setTimeout(load, 5000);
      };
      return () => {
        es.close();
        esRef.current = null;
      };
    } catch {}
  }, []);

  return (
    <Card
      style={{ borderRadius: 20, marginBottom: 8 }}
      title={
        <div style={{ fontWeight: 700, color: "#1575bc" }}>
          Динамика ТН за 7 дней (все события)
        </div>
      }
      styles={{ body: { padding: 10 } }}
    >
      {loading && <Skeleton active paragraph={{ rows: 3 }} />}
      {!loading && !error && <Sparkline7 points={daily} />}
      {error && (
        <Text type="danger" style={{ display: "block" }}>
          {error}
        </Text>
      )}
    </Card>
  );
}
