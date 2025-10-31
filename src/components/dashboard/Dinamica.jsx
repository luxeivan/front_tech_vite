import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, Skeleton, Typography } from "antd";
import dayjs from "dayjs";
import axios from "axios";

const { Text } = Typography;
const URL = import.meta.env.VITE_URL_BACKEND;

/* ---------------- helpers ---------------- */
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

// ==== Рабочие "сутки" 08:00→08:00 (ключ дня на базе смещения -8 часов)
const dayKey0808 = (v) =>
  v ? dayjs(v).subtract(8, "hour").format("YYYY-MM-DD") : null;

/* ---------------- sparkline ---------------- */
const Sparkline7 = ({ points }) => {
  const w = 900,
    h = 120,
    padX = 24,
    padY = 22;
  const max = Math.max(1, ...points.map((p) => p.total));
  const step = points.length > 1 ? (w - 2 * padX) / (points.length - 1) : 0;

  const xy = points.map((p, i) => [
    padX + i * step,
    h - padY - (h - 2 * padY) * (p.total / max),
  ]);

  const poly = xy.map((p) => p.join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 140 }}>
      {/* линия */}
      <polyline points={poly} fill="none" stroke="#ff4d4f" strokeWidth="2" />
      {/* точки + значения + подписи дней */}
      {xy.map(([x, y], i) => {
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
      {/* осевая линия снизу (визуально приятней) */}
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

/* ---------------- компонент: только блок 4 ---------------- */
export default function Dinamica7Days() {
  const [rows7d, setRows7d] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const esRef = useRef(null);

  const ruDow = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

  // 7 рабочих суток, привязанных к 08→08 (сегодня включительно)
  const todayKey = dayKey0808(dayjs());
  const days7 = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        dayjs(todayKey).subtract(6 - i, "day")
      ),
    [todayKey]
  );

  const daily = useMemo(() => {
    return days7.map((d) => {
      const key = d.format("YYYY-MM-DD");
      const sameWorkday = (dt) => (dt ? dayKey0808(dt) === key : false);

      const createdDay = rows7d.filter((r) => sameWorkday(startDate(r)));

      const isDeletedRow = (r) => {
        const st = String(
          pick(r, "STATUS_NAME") ?? r?.STATUS_NAME ?? ""
        ).toLowerCase();
        const upd = pick(r, "updatedAt") ?? r?.updatedAt ?? null;
        const del = pick(r, "deletedAt") ?? r?.deletedAt ?? null;
        return (
          st.includes("удален") || st.includes("delete") || sameWorkday(del)
        );
      };

      const isClosedRow = (r) => {
        if (isOpenTN(r) || isDeletedRow(r)) return false;
        const upd = pick(r, "updatedAt") ?? r?.updatedAt ?? null;
        const rec = recoveryDate(r);
        return sameWorkday(upd) || sameWorkday(rec);
      };

      const opened = createdDay.filter(
        (r) => isOpenTN(r) && !isDeletedRow(r)
      ).length;
      const closed = createdDay.filter((r) => isClosedRow(r)).length;
      const deleted = createdDay.filter((r) => isDeletedRow(r)).length;
      const total = opened + closed + deleted;

      return { label: ruDow[d.day()], opened, closed, deleted, total };
    });
  }, [rows7d, days7]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const jwt = localStorage.getItem("jwt");
      if (!jwt) throw new Error("Нет JWT: авторизуйтесь");

      // Берём запас по времени, чтобы точно покрыть 7 интервалов 08→08
      const since7d = dayjs()
        .subtract(7, "day")
        .startOf("day")
        .subtract(8, "hour")
        .toISOString();

      const qsAll7d = [
        "pagination[page]=1",
        "pagination[pageSize]=1000",
        "sort[0]=createDateTime:DESC",
        `filters[createDateTime][$gte]=${encodeURIComponent(since7d)}`,
      ].join("&");

      const headers = { Authorization: `Bearer ${jwt}` };
      const respAll = await axios.get(
        `${URL}/api/teh-narusheniyas?${qsAll7d}`,
        {
          headers,
        }
      );

      const listAll7d = Array.isArray(respAll?.data?.data)
        ? respAll.data.data.map((x) =>
            x?.attributes ? { id: x.id, ...x.attributes } : x
          )
        : [];

      setRows7d(listAll7d);
    } catch (e) {
      setError(e?.message || "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // SSE автообновление, чтобы график обновлялся по новым событиям
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
