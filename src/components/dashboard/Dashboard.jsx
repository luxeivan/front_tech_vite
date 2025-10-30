import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Typography,
  Row,
  Col,
  Card,
  Space,
  Spin,
  Skeleton,
  Button,
  message,
  Tooltip,
  Progress,
} from "antd";
import {
  ThunderboltOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  TeamOutlined,
  ApartmentOutlined,
  BankOutlined,
  ShopOutlined,
  FireOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  BuildOutlined,
  MedicineBoxOutlined,
  ReadOutlined,
  SmileOutlined,
  UserOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import MapPanel from "./Map";
import dayjs from "dayjs";
import axios from "axios";

const { Title, Text } = Typography;
const URL = import.meta.env.VITE_URL_BACKEND;
const FIAS_COLLECTION = import.meta.env.VITE_STRAPI_FIAS_COLLECTION || "adress";

const MAP_SCALE = 0.58; // коэффициент высоты карты относительно доступного места

// strict GUID validator for FIAS (32 hex или 36 с дефисами)
const isFiasGuid = (s) => {
  if (!s && s !== 0) return false;
  const str = String(s).trim();
  return (
    /^[0-9a-fA-F]{32}$/.test(str) ||
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      str
    )
  );
};

// Достаём ФИАСы ТОЛЬКО из FIAS_LIST
const extractFiasFromRow = (row) => {
  const seen = new Set();
  const candidates = [
    row?.data?.FIAS_LIST,
    row?.FIAS_LIST,
    row?.data?.data?.FIAS_LIST,
  ];
  for (const src of candidates) {
    if (!src) continue;
    String(src)
      .split(/[;,]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => {
        if (isFiasGuid(t)) seen.add(t);
      });
  }
  return Array.from(seen);
};

/* ---------------- helpers ---------------- */
const toNumber = (v) => {
  const val = v != null && typeof v === "object" && "value" in v ? v.value : v;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

const pick = (obj, key) =>
  obj?.[key] ?? obj?.data?.[key] ?? obj?.data?.data?.[key] ?? null;

// like pick, but tries several alternative keys and returns the first non-null/undefined
const pickAny = (obj, keys) => {
  const arr = Array.isArray(keys) ? keys : [keys];
  for (const k of arr) {
    const v = pick(obj, k);
    if (v !== null && v !== undefined) return v;
  }
  return null;
};

const isOpenTN = (row) => {
  const v =
    row?.isActive ??
    row?.data?.isActive ??
    row?.data?.data?.isActive ??
    row?.attributes?.isActive ??
    (row?.attributes && row.attributes.isActive?.value);

  return v === true || v === 1 || v === "true";
};

const districtName = (row) =>
  pick(row, "DISTRICT") || row?.dispCenter || row?.district || null;

const guidOf = (row) =>
  pick(row, "guid") ||
  pick(row, "VIOLATION_GUID_STR") ||
  row?.guid ||
  row?.VIOLATION_GUID_STR ||
  null;

const tnNumber = (row) => pick(row, "number") ?? row?.number ?? null;
const startDate = (row) =>
  pick(row, "createDateTime") ?? pick(row, "F81_060_EVENTDATETIME") ?? null;
const formatDateTime = (v) =>
  v ? dayjs(v).format("DD.MM.YYYY HH:mm:ss") : "—";

const recoveryDate = (row) =>
  pick(row, "F81_290_RECOVERYDATETIME") ??
  pick(row, "F81_070_RESTOR_SUPPLAYDATETIME") ??
  null;

const isToday = (v) => (v ? dayjs(v).isSame(dayjs(), "day") : false);

/* ---------------- компонент ---------------- */
export default function Dashboard() {
  const navigate = useNavigate();
  const headerRef = useRef(null);
  const [mapHeight, setMapHeight] = useState(420);
  const CARD_SCALE = 0.7;

  // compact mode по размеру окна
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onResize = () => {
      const h = window.innerHeight;
      const w = window.innerWidth;
      setCompact(h < 900 || w < 1280);
      const headerH = headerRef.current
        ? headerRef.current.getBoundingClientRect().height
        : 0;
      const paddingY = 32;
      const base = Math.max(300, Math.floor(h - headerH - paddingY));
      const scaled = Math.max(200, Math.floor(base * MAP_SCALE));
      setMapHeight(scaled);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // компактный Chip
  const Chip = React.memo(({ icon, title, value, color, tooltip }) => {
    const v = Number(value || 0);
    const active = v > 0;
    const tone = active ? color : "#bfbfbf";
    const labelColor = "#6b778c";
    return (
      <Tooltip
        placement="bottom"
        title={tooltip}
        overlayStyle={{ maxWidth: 420 }}
      >
        <Card
          hoverable
          size="small"
          bordered
          style={{
            borderRadius: 14,
            backdropFilter: "saturate(130%) blur(2px)",
            boxShadow: "0 4px 12px rgba(18, 31, 53, .06)",
            height: "100%",
            opacity: active ? 1 : 0.9,
          }}
          styles={{
            body: {
              padding: compact
                ? `${Math.round(10 * CARD_SCALE)}px ${Math.round(
                    12 * CARD_SCALE
                  )}px`
                : `${Math.round(12 * CARD_SCALE)}px ${Math.round(
                    16 * CARD_SCALE
                  )}px`,
            },
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `${compact ? 24 : 28}px 1fr auto`,
              alignItems: "center",
              gap: compact ? 8 : 10,
              minHeight: Math.round((compact ? 76 : 92) * CARD_SCALE),
              height: "100%",
            }}
          >
            <span style={{ fontSize: compact ? 18 : 22, color: tone }}>
              {icon}
            </span>
            <div
              style={{
                lineHeight: 1.2,
                color: labelColor,
                fontSize: compact ? 11 : 12,
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: compact ? 18 : 22,
                fontWeight: 800,
                color: tone,
              }}
            >
              {v.toLocaleString("ru-RU")}
            </div>
          </div>
        </Card>
      </Tooltip>
    );
  });

  // агрегаты под макет
  const [now, setNow] = useState(dayjs().format("DD.MM.YYYY, HH:mm:ss"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [rows7d, setRows7d] = useState([]);
  const esRef = useRef(null);

  // sums a field, accepting either a single key or an array of fallback keys
  const sumField = (fieldOrFields) =>
    rows.reduce(
      (sum, it) => sum + toNumber(pickAny(it, fieldOrFields)),
      0
    );
  const uniqCount = (getter) => new Set(rows.map(getter).filter(Boolean)).size;

  const totals = {
    totalOpen: rows.length,
    tp: sumField("TP_ALL"),
    lines: sumField("LINESN_ALL"),
    population: sumField("POPULATION_COUNT"),
    settlements: uniqCount(districtName),
    pesPower: sumField("PES_POWER"),
    filials: uniqCount((r) => pick(r, "OWN_SCNAME") || r?.OWN_SCNAME),
    pos: uniqCount((r) => pick(r, "SCNAME") || r?.SCNAME),
  };

  const MiniChip = ({ title, value }) => (
    <Card size="small" bordered style={{ borderRadius: 12 }}>
      <div style={{ fontSize: 12, color: "#6b778c", lineHeight: 1.1 }}>
        {title}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>
        {Number(value || 0).toLocaleString("ru-RU")}
      </div>
    </Card>
  );

  // const DonutToday = () => {
  //   const openedList = rows7d.filter((r) => isToday(startDate(r)));
  //   const closedList = rows7d.filter((r) => isToday(recoveryDate(r)));
  //   const deletedList = rows7d.filter((r) => {
  //     const st = String(
  //       pick(r, "STATUS_NAME") ?? r?.STATUS_NAME ?? ""
  //     ).toLowerCase();
  //     const upd = pick(r, "updatedAt") ?? r?.updatedAt ?? null;
  //     return st.includes("удален") && isToday(upd);
  //   });

  //   const opened = openedList.length;
  //   const closed = closedList.length;
  //   const deleted = deletedList.length;
  //   const total = opened + closed + deleted;

  //   const deg = (n) => (total ? (n / total) * 360 : 0);
  //   const dOpen = deg(opened);
  //   const dClosed = deg(closed);

  //   const size = compact ? 130 : 160;
  //   const ringStyle = {
  //     width: size,
  //     height: size,
  //     borderRadius: "50%",
  //     background: `conic-gradient(#ff7875 0 ${dOpen}deg, #52c41a ${dOpen}deg ${
  //       dOpen + dClosed
  //     }deg, #8c8c8c ${dOpen + dClosed}deg 360deg)`,
  //     position: "relative",
  //   };
  //   const innerStyle = {
  //     position: "absolute",
  //     top: "50%",
  //     left: "50%",
  //     transform: "translate(-50%, -50%)",
  //     width: Math.round(size * 0.68),
  //     height: Math.round(size * 0.68),
  //     background: "#fff",
  //     borderRadius: "50%",
  //     display: "flex",
  //     alignItems: "center",
  //     justifyContent: "center",
  //     flexDirection: "column",
  //     textAlign: "center",
  //   };

  //   const copyList = async (arr, label) => {
  //     try {
  //       const text =
  //         arr
  //           .map(
  //             (r, i) =>
  //               `${i + 1}. №${tnNumber(r) ?? "—"} — ${formatDateTime(
  //                 startDate(r)
  //               )}`
  //           )
  //           .join("\n") || "Нет данных";
  //       await navigator.clipboard.writeText(text);
  //       message.success(`${label}: скопировано ${arr.length}`);
  //     } catch {
  //       message.error("Не удалось скопировать");
  //     }
  //   };

  //   const LegendRow = ({ color, label, count, list }) => (
  //     <div
  //       style={{
  //         display: "flex",
  //         alignItems: "center",
  //         gap: 8,
  //         cursor: list?.length ? "copy" : "default",
  //       }}
  //       onClick={() => list?.length && copyList(list, label)}
  //     >
  //       <span
  //         style={{
  //           width: 10,
  //           height: 10,
  //           borderRadius: "50%",
  //           background: color,
  //         }}
  //       />
  //       <span style={{ fontSize: 12, color: "#6b778c" }}>{label}</span>
  //       <strong style={{ marginLeft: 4 }}>{count}</strong>
  //     </div>
  //   );

  //   return (
  //     <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
  //       <div>
  //         <div style={{ fontWeight: 700, color: "#1575bc", marginBottom: 6 }}>
  //           Сегодня: открыто / закрыто / удалено
  //         </div>
  //         <div style={ringStyle}>
  //           <div style={innerStyle}>
  //             <div
  //               style={{
  //                 fontSize: compact ? 24 : 28,
  //                 fontWeight: 900,
  //                 lineHeight: 1,
  //               }}
  //             >
  //               {total}
  //             </div>
  //             <div style={{ fontSize: 12, color: "#6b778c" }}>
  //               всего за сегодня
  //             </div>
  //           </div>
  //         </div>
  //       </div>
  //       <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
  //         <LegendRow
  //           color="#ff7875"
  //           label="Открыто"
  //           count={opened}
  //           list={openedList}
  //         />
  //         <LegendRow
  //           color="#52c41a"
  //           label="Закрыто"
  //           count={closed}
  //           list={closedList}
  //         />
  //         <LegendRow
  //           color="#8c8c8c"
  //           label="Удалено"
  //           count={deleted}
  //           list={deletedList}
  //         />
  //       </div>
  //     </div>
  //   );
  // };

  // --- 7 дней: все события (открыто/закрыто/удалено) и подписи дней недели ---
  const DonutToday = () => {
  // "сегодня создано"
  const createdToday = rows7d.filter((r) => isToday(startDate(r)));

  // всё ещё открыты (из созданных сегодня)
  const openNow = createdToday.filter((r) => isOpenTN(r));

  // закрыты сегодня (из созданных сегодня)
  const closedToday = createdToday.filter((r) => {
    const closedNow = !isOpenTN(r);
    const upd = pick(r, "updatedAt") ?? r?.updatedAt ?? null;
    const rec = recoveryDate(r);
    // считаем закрытым сегодня, если запись стала неактивной и сегодня была обновлена
    // или заполнена дата восстановления
    return closedNow && (isToday(upd) || isToday(rec));
  });

  // удалены сегодня (из созданных сегодня)
  const deletedToday = createdToday.filter((r) => {
    const st = String(pick(r, "STATUS_NAME") ?? r?.STATUS_NAME ?? "")
      .toLowerCase();
    const upd = pick(r, "updatedAt") ?? r?.updatedAt ?? null;
    const del = pick(r, "deletedAt") ?? r?.deletedAt ?? null; // если есть soft-delete
    return st.includes("удален") || isToday(del) || (st.includes("delete") && isToday(upd));
  });

  const opened = openNow.length;
  const closed = closedToday.length;
  const deleted = deletedToday.length;
  const total = opened + closed + deleted;

  const deg = (n) => (total ? (n / total) * 360 : 0);
  const dOpen = deg(opened);
  const dClosed = deg(closed);

  const size = compact ? 130 : 160;
  const ringStyle = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: `conic-gradient(#ff7875 0 ${dOpen}deg, #52c41a ${dOpen}deg ${
      dOpen + dClosed
    }deg, #8c8c8c ${dOpen + dClosed}deg 360deg)`,
    position: "relative",
  };
  const innerStyle = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: Math.round(size * 0.68),
    height: Math.round(size * 0.68),
    background: "#fff",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    textAlign: "center",
  };

  const copyList = async (arr, label) => {
    try {
      const text =
        arr
          .map(
            (r, i) =>
              `${i + 1}. №${tnNumber(r) ?? "—"} — создано: ${formatDateTime(
                startDate(r)
              )}`
          )
          .join("\n") || "Нет данных";
      await navigator.clipboard.writeText(text);
      message.success(`${label}: скопировано ${arr.length}`);
    } catch {
      message.error("Не удалось скопировать");
    }
  };

  const LegendRow = ({ color, label, count, list }) => (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, cursor: list?.length ? "copy" : "default" }}
      onClick={() => list?.length && copyList(list, label)}
    >
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
      <span style={{ fontSize: 12, color: "#6b778c" }}>{label}</span>
      <strong style={{ marginLeft: 4 }}>{count}</strong>
    </div>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div>
        <div style={{ fontWeight: 700, color: "#1575bc", marginBottom: 6 }}>
          Сегодня: открыто / закрыто / удалено
        </div>
        <div style={ringStyle}>
          <div style={innerStyle}>
            <div style={{ fontSize: compact ? 24 : 28, fontWeight: 900, lineHeight: 1 }}>{total}</div>
            <div style={{ fontSize: 12, color: "#6b778c" }}>всего за сегодня</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <LegendRow color="#ff7875" label="Открыто (остаются)" count={opened} list={openNow} />
        <LegendRow color="#52c41a" label="Закрыто" count={closed} list={closedToday} />
        <LegendRow color="#8c8c8c" label="Удалено" count={deleted} list={deletedToday} />
      </div>
    </div>
  );
};

  
  const ruDow = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

  const days7 = Array.from({ length: 7 }, (_, i) =>
    dayjs()
      .startOf("day")
      .subtract(6 - i, "day")
  );

  // посуточные счётчики
  const daily = days7.map((d) => {
    const sameDay = (dt) => (dt ? dayjs(dt).isSame(d, "day") : false);

    // Все ТН, созданные в конкретный день
    const createdDay = rows7d.filter((r) => sameDay(startDate(r)));

    // helper: признак удаления
    const isDeletedRow = (r) => {
      const st = String(pick(r, "STATUS_NAME") ?? r?.STATUS_NAME ?? "").toLowerCase();
      const upd = pick(r, "updatedAt") ?? r?.updatedAt ?? null;
      const del = pick(r, "deletedAt") ?? r?.deletedAt ?? null; // на случай soft-delete
      return st.includes("удален") || st.includes("delete") || sameDay(del);
    };

    // helper: признак закрытия (только если не удалён)
    const isClosedRow = (r) => {
      if (isOpenTN(r) || isDeletedRow(r)) return false;
      const upd = pick(r, "updatedAt") ?? r?.updatedAt ?? null;
      const rec = recoveryDate(r);
      return sameDay(upd) || sameDay(rec);
    };

    // Взаимоисключающие категории
    const opened = createdDay.filter((r) => isOpenTN(r) && !isDeletedRow(r)).length;
    const closed = createdDay.filter((r) => isClosedRow(r)).length;
    const deleted = createdDay.filter((r) => isDeletedRow(r)).length;

    const total = opened + closed + deleted; // без двойного счёта на один и тот же ТН

    return {
      label: ruDow[d.day()],
      opened,
      closed,
      deleted,
      total,
    };
  });

  // мини-линейный график с подписями дней и подсказками
  const Sparkline7 = ({ points }) => {
    const w = 900,
      h = 160,
      padX = 28,
      padY = 28;
    const max = Math.max(1, ...points.map((p) => p.total));
    const step = points.length > 1 ? (w - 2 * padX) / (points.length - 1) : 0;

    const xy = points.map((p, i) => [
      padX + i * step,
      h - padY - (h - 2 * padY) * (p.total / max),
    ]);

    const poly = xy.map((p) => p.join(",")).join(" ");

    return (
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 180 }}>
        {/* линия */}
        <polyline points={poly} fill="none" stroke="#ff4d4f" strokeWidth="2" />
        {/* точки + значения + подписи дней */}
        {xy.map(([x, y], i) => {
          const p = points[i];
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="4" fill="#ff4d4f">
                <title>
                  {`${p.label.toUpperCase()}: всего ${p.total}
— открыто: ${p.opened}
— закрыто: ${p.closed}
— удалено: ${p.deleted}`}
                </title>
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

  // const days7 = Array.from({ length: 7 }, (_, i) =>
  //   dayjs()
  //     .startOf("day")
  //     .subtract(6 - i, "day")
  // );
  // const data7 = days7.map(
  //   (d) =>
  //     rows7d.filter((r) => {
  //       const dt = startDate(r);
  //       return dt && dayjs(dt).isSame(d, "day");
  //     }).length
  // );

  // const Sparkline7 = ({ data }) => {
  //   const w = 600,
  //     h = 120,
  //     pad = 20;
  //   const max = Math.max(1, ...data);
  //   const step = data.length > 1 ? (w - 2 * pad) / (data.length - 1) : 0;
  //   const points = data.map((v, i) => [
  //     pad + i * step,
  //     h - pad - (h - 2 * pad) * (v / max),
  //   ]);
  //   const pts = points.map((p) => p.join(",")).join(" ");
  //   return (
  //     <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 140 }}>
  //       <polyline points={pts} fill="none" stroke="#ff4d4f" strokeWidth="2" />
  //       {points.map((p, i) => (
  //         <g key={i}>
  //           <circle cx={p[0]} cy={p[1]} r="4" fill="#ff4d4f" />
  //           <text
  //             x={p[0]}
  //             y={p[1] - 8}
  //             fontSize="12"
  //             textAnchor="middle"
  //             fill="#595959"
  //           >
  //             {data[i]}
  //           </text>
  //         </g>
  //       ))}
  //     </svg>
  //   );
  // };

  // FIAS для карты
  const fiasCodes = useMemo(
    () =>
      Array.from(
        new Set(rows.flatMap((r) => extractFiasFromRow(r)).filter(Boolean))
      ),
    [rows]
  );

  const fiasOwners = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const num = tnNumber(r);
      if (!num) return;
      const list = extractFiasFromRow(r);
      list.forEach((code) => {
        if (!code) return;
        if (!map.has(code)) map.set(code, new Set());
        map.get(code).add(num);
      });
    });
    const obj = {};
    map.forEach((set, key) => {
      obj[key] = Array.from(set);
    });
    return obj;
  }, [rows]);

  // header ticker
  useEffect(() => {
    const t = setInterval(
      () => setNow(dayjs().format("DD.MM.YYYY, HH:mm:ss")),
      60_000
    );
    return () => clearInterval(t);
  }, []);

  // загрузка открытых ТН и всех ТН за 7 дней
  const loadOpen = async () => {
    try {
      setLoading(true);
      setError(null);
      const jwt = localStorage.getItem("jwt");
      if (!jwt) throw new Error("Нет JWT: авторизуйтесь");

      const since7d = dayjs().startOf("day").subtract(6, "day").toISOString();

      const qsOpen = [
        "pagination[page]=1",
        "pagination[pageSize]=500",
        "sort[0]=createDateTime:DESC",
        "filters[isActive][$eq]=true",
      ].join("&");

      const qsAll7d = [
        "pagination[page]=1",
        "pagination[pageSize]=1000",
        "sort[0]=createDateTime:DESC",
        `filters[createDateTime][$gte]=${encodeURIComponent(since7d)}`,
      ].join("&");

      const headers = { Authorization: `Bearer ${jwt}` };

      const [respOpen, respAll] = await Promise.all([
        axios.get(`${URL}/api/teh-narusheniyas?${qsOpen}`, { headers }),
        axios.get(`${URL}/api/teh-narusheniyas?${qsAll7d}`, { headers }),
      ]);

      const listOpen = Array.isArray(respOpen?.data?.data)
        ? respOpen.data.data.map((x) =>
            x?.attributes ? { id: x.id, ...x.attributes } : x
          )
        : [];

      const listAll7d = Array.isArray(respAll?.data?.data)
        ? respAll.data.data.map((x) =>
            x?.attributes ? { id: x.id, ...x.attributes } : x
          )
        : [];

      setRows(listOpen.filter(isOpenTN)); // текущие открытые (для СЗО и сил/средств)
      setRows7d(listAll7d); // все ТН за последние 7 дней (для графиков/доната)
    } catch (e) {
      setError(e?.message || "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOpen();
  }, []);

  // SSE автообновление
  useEffect(() => {
    if (!URL) return;
    try {
      const es = new EventSource(`${URL}/services/event`);
      esRef.current = es;
      es.onmessage = () => setTimeout(loadOpen, 350);
      es.onerror = () => {
        es.close();
        esRef.current = null;
        setTimeout(loadOpen, 5000);
      };
      return () => {
        es.close();
        esRef.current = null;
      };
    } catch {}
  }, []);

  // copy GUIDs
  const handleCopyGuids = async () => {
    try {
      const items = rows
        .map((r) => ({
          guid: guidOf(r),
          number: tnNumber(r),
          start: startDate(r),
        }))
        .filter((x) => Boolean(x.guid));
      if (!items.length) return message.warning("GUID не найдены");
      const text = items
        .map(
          (it, i) =>
            `${i + 1}. ${it.guid} — №${it.number ?? "—"}, ${formatDateTime(
              it.start
            )}`
        )
        .join("\n");
      await navigator.clipboard.writeText(text);
      message.success(`Скопировано: ${items.length}`);
    } catch {
      message.error("Не удалось скопировать");
    }
  };

  // tooltips (детализация по районам)
  const renderMetricDetails = (m) => {
    try {
      if (!rows?.length) return "Нет данных";

      if (
        String(m?.title || "")
          .toLowerCase()
          .includes("населён")
      ) {
        const list = Array.from(
          new Set(rows.map((r) => districtName(r)).filter(Boolean))
        ).sort((a, b) => String(a).localeCompare(String(b), "ru"));
        return (
          <div style={{ maxHeight: 260, overflow: "auto", paddingRight: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Список населённых пунктов
            </div>
            {list.length
              ? list.map((d, i) => (
                  <div key={d}>
                    {i + 1}. {d}
                  </div>
                ))
              : "Нет данных"}
          </div>
        );
      }

      const field = m?.field;
      if (!field) return "Нет данных";
      const sums = new Map();
      rows.forEach((r) => {
        const d = districtName(r) || "—";
        const v = toNumber(pickAny(r, field));
        if (!v) return;
        sums.set(d, (sums.get(d) || 0) + v);
      });
      const list = Array.from(sums.entries()).sort((a, b) => b[1] - a[1]);
      if (!list.length) return "Нет данных";
      return (
        <div style={{ maxHeight: 260, overflow: "auto", paddingRight: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Список по районам
          </div>
          {list.map(([d, v], i) => (
            <div key={d}>
              {i + 1}. {d}: {Number(v).toLocaleString("ru-RU")}
            </div>
          ))}
        </div>
      );
    } catch {
      return "Нет данных";
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#f7f9fc" }}>
      {/* Hero / Header */}
      <div
        ref={headerRef}
        style={{
          background:
            "linear-gradient(90deg, #eaf4ff 0%, #f9fbff 50%, #ffffff 100%)",
          borderBottom: "1px solid #eef3f8",
        }}
      >
        <div
          style={{
            maxWidth: "min(100vw, 2400px)",
            width: "100%",
            margin: "0 auto",
            padding: "14px 24px",
          }}
        >
          <Row align="middle" justify="start">
            <Col>
              <Button onClick={() => navigate("/")} icon={<HomeOutlined />}>
                На главную
              </Button>
            </Col>
          </Row>

          <div style={{ textAlign: "center", marginTop: 8 }}>
            <Title
              level={2}
              style={{
                margin: 0,
                textAlign: "center",
                color: "#1575bc",
                fontWeight: 800,
                letterSpacing: 0.2,
              }}
            >
              ТЕХНОЛОГИЧЕСКИЕ НАРУШЕНИЯ В ЭЛЕКТРИЧЕСКИХ СЕТЯХ АО «МОСОБЛЭНЕРГО»
            </Title>
            <Text
              style={{
                display: "block",
                fontWeight: 600,
                color: "#1575bc",
                marginTop: 6,
              }}
            >
              По состоянию на {now}
            </Text>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: "min(100vw, 2400px)",
          width: "100%",
          margin: "0 auto",
          padding: "12px 24px 24px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact
              ? "1fr"
              : "minmax(820px, 2.2fr) minmax(460px, 1fr)",
            gap: compact ? 10 : 14,
            alignItems: "start",
          }}
        >
          {/* LEFT: panels */}
          <div>
            {loading && !error && (
              <Space
                style={{
                  width: "100%",
                  justifyContent: "center",
                  marginTop: 40,
                }}
              >
                <Spin size="large" />
              </Space>
            )}
            {error && (
              <Title level={4} type="danger" style={{ textAlign: "center" }}>
                {error}
              </Title>
            )}

            {!loading && !error && (
              <>
                {/* Информация о ТН */}
                <Card
                  style={{ borderRadius: 20, marginBottom: 12 }}
                  title={
                    <div style={{ fontWeight: 700, color: "#1575bc" }}>
                      Информация о ТН
                    </div>
                  }
                  styles={{ body: { padding: compact ? 12 : 16 } }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: compact ? "1fr" : "1.4fr 1fr",
                      gap: 12,
                      alignItems: "stretch",
                    }}
                  >
                    {/* мини-плашки слева */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${
                          compact ? 2 : 3
                        }, minmax(160px, 1fr))`,
                        gap: 10,
                        alignItems: "stretch",
                      }}
                    >
                      <MiniChip
                        title="Всего открытых ТН"
                        value={totals.totalOpen}
                      />
                      <MiniChip title="Отключено ТП" value={totals.tp} />
                      <MiniChip title="Население" value={totals.population} />
                      <MiniChip
                        title="Отключено ЛЭП 6–20 кВ"
                        value={totals.lines}
                      />
                      <MiniChip
                        title="Населённых пунктов"
                        value={totals.settlements}
                      />
                      <Card
                        size="small"
                        bordered
                        style={{
                          borderRadius: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Button
                          onClick={handleCopyGuids}
                          disabled={!rows?.length}
                          style={{ borderRadius: 10, width: "100%" }}
                        >
                          GUID
                        </Button>
                      </Card>
                    </div>

                    {/* круговая диаграмма справа */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <DonutToday />
                    </div>
                  </div>
                </Card>

                {/* Потребители и СЗО */}
                <Card
                  style={{ borderRadius: 20, marginBottom: 12 }}
                  title={
                    <div style={{ fontWeight: 700, color: "#1575bc" }}>
                      Потребители и СЗО
                    </div>
                  }
                  styles={{ body: { padding: compact ? 10 : 14 } }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(auto-fill, minmax(${
                        compact ? 170 : 200
                      }px, 1fr))`,
                      gap: compact ? 10 : 12,
                      alignItems: "stretch",
                    }}
                  >
                    {[
                      {
                        icon: <FireOutlined />,
                        title: "Котельные",
                        field: "BOILER_ALL",
                        color: "#eb2f96",
                      },
                      {
                        icon: <DashboardOutlined />,
                        title: "ЦТП",
                        field: "CTP_ALL",
                        color: "#13c2c2",
                      },
                      {
                        icon: <MedicineBoxOutlined />,
                        title: "Больницы",
                        field: "HOSPITALS_ALL",
                        color: "#1890ff",
                      },
                      {
                        icon: <MedicineBoxOutlined />,
                        title: "Поликлиники",
                        field: "CLINICS_ALL",
                        color: "#722ed1",
                      },
                      {
                        icon: <ExperimentOutlined />,
                        title: "ВЗУ",
                        field: "WELLS_ALL",
                        color: "#722ed1",
                      },
                      {
                        icon: <BuildOutlined />,
                        title: "ВНС",
                        field: "VNS_ALL",
                        color: "#faad14",
                      },
                      {
                        icon: <ReadOutlined />,
                        title: "Школы",
                        field: ["SCHOOLS_ALL", "SCHOOL_ALL", "SCHOOLS", "SCHOOL_COUNT"],
                        color: "#52c41a",
                      },
                      {
                        icon: <SmileOutlined />,
                        title: "Д/С",
                        field: ["KINDERGARTENS_ALL", "KINDERGARTEN_ALL", "KINDERGARTENS", "KINDERGARTEN_COUNT", "KINDERGARDENS_ALL", "KINDERGARDEN"],
                        color: "#fa541c",
                      },
                      {
                        icon: <ApartmentOutlined />,
                        title: "МКД",
                        field: "MKD_ALL",
                        color: "#fa541c",
                      },
                      {
                        icon: <BankOutlined />,
                        title: "ИЖС",
                        field: "PRIVATE_HOUSE_ALL",
                        color: "#fa8c16",
                      },
                      {
                        icon: <ShopOutlined />,
                        title: "СНТ",
                        field: "SNT_ALL",
                        color: "#52c41a",
                      },
                    ].map(({ icon, title, field, color }) => (
                      <Chip
                        key={title}
                        icon={icon}
                        title={title}
                        value={sumField(field)}
                        color={color}
                        tooltip={renderMetricDetails({ title, field })}
                      />
                    ))}
                  </div>
                </Card>

                {/* Задействовано сил и средств Мособлэнерго */}
                <Card
                  style={{ borderRadius: 20, marginBottom: 12 }}
                  styles={{ body: { padding: compact ? 10 : 14 } }}
                  title={
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#1575bc",
                        textAlign: "center",
                      }}
                    >
                      Задействовано сил и средств Мособлэнерго
                    </div>
                  }
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(auto-fill, minmax(${
                        compact ? 170 : 200
                      }px, 1fr))`,
                      gap: compact ? 10 : 12,
                      alignItems: "stretch",
                    }}
                  >
                    <Chip
                      icon={<HomeOutlined />}
                      title="Филиалы"
                      value={totals.filials}
                      color="#1575bc"
                    />
                    <Chip
                      icon={<EnvironmentOutlined />}
                      title="ПО"
                      value={totals.pos}
                      color="#1575bc"
                    />
                    <Chip
                      icon={<TeamOutlined />}
                      title="Бригады"
                      value={sumField("BRIGADECOUNT")}
                      color="#722ed1"
                    />
                    <Chip
                      icon={<UserOutlined />}
                      title="Люди"
                      value={sumField("EMPLOYEECOUNT")}
                      color="#13c2c2"
                    />
                    <Chip
                      icon={<ToolOutlined />}
                      title="Техника"
                      value={sumField("SPECIALTECHNIQUECOUNT")}
                      color="#eb2f96"
                    />
                    <Chip
                      icon={<ThunderboltOutlined />}
                      title="ПЭС"
                      value={sumField("PES_COUNT")}
                      color="#faad14"
                    />
                    <Chip
                      icon={<ThunderboltOutlined />}
                      title="Мощность ПЭС (кВт)"
                      value={totals.pesPower}
                      color="#faad14"
                    />
                  </div>
                </Card>

                {/* Динамика ТН за 7 дней */}
                <Card
                  style={{ borderRadius: 20, marginBottom: 12 }}
                  title={
                    <div style={{ fontWeight: 700, color: "#1575bc" }}>
                      Динамика ТН за 7 дней (все события)
                    </div>
                  }
                  styles={{ body: { padding: compact ? 8 : 12 } }}
                >
                  <Sparkline7 points={daily} />
                </Card>
              </>
            )}

            {rows.length === 0 && loading && (
              <Skeleton
                active
                paragraph={{ rows: 4 }}
                style={{ marginTop: 24 }}
              />
            )}
          </div>

          {/* RIGHT: map */}
          <div>
            <Card
              style={{ borderRadius: 20, overflow: "hidden" }}
              styles={{ body: { padding: 0 } }}
              title={
                <div style={{ fontWeight: 700, color: "#1575bc" }}>
                  Карта отключённых потребителей
                </div>
              }
            >
              <div
                style={{
                  width: "100%",
                  height: mapHeight,
                  minHeight: compact ? 180 : 220,
                  position: "relative",
                }}
              >
                <MapPanel
                  height="100%"
                  initialState={{ center: [55.751244, 37.618423], zoom: 8 }}
                  fiasCodes={fiasCodes}
                  url={URL}
                  fiasCollection={FIAS_COLLECTION}
                  fiasOwners={fiasOwners}
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// import React, { useEffect, useMemo, useRef, useState } from "react";
// import {
//   Typography,
//   Row,
//   Col,
//   Card,
//   Space,
//   Spin,
//   Skeleton,
//   Button,
//   message,
//   Tooltip,
// } from "antd";
// import {
//   ThunderboltOutlined,
//   EnvironmentOutlined,
//   HomeOutlined,
//   TeamOutlined,
//   ApartmentOutlined,
//   BankOutlined,
//   ShopOutlined,
//   FireOutlined,
//   DashboardOutlined,
//   ExperimentOutlined,
//   BuildOutlined,
//   MedicineBoxOutlined,
//   ReadOutlined,
//   SmileOutlined,
//   UserOutlined,
//   ToolOutlined,
// } from "@ant-design/icons";
// import { useNavigate } from "react-router-dom";
// import MapPanel from "./Map";
// import dayjs from "dayjs";
// import axios from "axios";

// const { Title, Text } = Typography;
// const URL = import.meta.env.VITE_URL_BACKEND;
// const FIAS_COLLECTION = import.meta.env.VITE_STRAPI_FIAS_COLLECTION || "adress";

// const MAP_SCALE = 0.58; // коэффициент высоты карты относительно доступного места

// // Try to extract an array of FIAS codes from different shapes of a row (strict)

// // strict GUID validator for FIAS (32 hex или 36 с дефисами)
// const isFiasGuid = (s) => {
//   if (!s && s !== 0) return false;
//   const str = String(s).trim();
//   return (
//     /^[0-9a-fA-F]{32}$/.test(str) ||
//     /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
//       str
//     )
//   );
// };

// // Достаём ФИАСы ТОЛЬКО из FIAS_LIST
// const extractFiasFromRow = (row) => {
//   const seen = new Set();
//   const candidates = [
//     row?.data?.FIAS_LIST, // обычное место
//     row?.FIAS_LIST, // на всякий случай
//     row?.data?.data?.FIAS_LIST, // сверх-защита
//   ];
//   for (const src of candidates) {
//     if (!src) continue;
//     String(src)
//       .split(/[;,]/) // FIAS разделены ; или ,
//       .map((t) => t.trim())
//       .filter(Boolean)
//       .forEach((t) => {
//         if (isFiasGuid(t)) seen.add(t);
//       });
//   }
//   return Array.from(seen);
// };

// // Chunk helper
// // const chunk = (arr, n) => {
// //   const out = [];
// //   for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
// //   return out;
// // };

// /* ---------------- helpers ---------------- */
// const toNumber = (v) => {
//   const val = v != null && typeof v === "object" && "value" in v ? v.value : v;
//   const n = Number(val);
//   return Number.isFinite(n) ? n : 0;
// };

// // попытаться достать поле из разных мест (атрибут, data, data.data)
// const pick = (obj, key) =>
//   obj?.[key] ?? obj?.data?.[key] ?? obj?.data?.data?.[key] ?? null;

// // статус «открыта»/isActive
// const isOpenTN = (row) => {
//   const v =
//     row?.isActive ??
//     row?.data?.isActive ??
//     row?.data?.data?.isActive ??
//     row?.attributes?.isActive ??
//     (row?.attributes && row.attributes.isActive?.value);

//   return v === true || v === 1 || v === "true";
// };

// const districtName = (row) =>
//   pick(row, "DISTRICT") || row?.dispCenter || row?.district || null;

// // попытаться достать GUID (documentId/VIOLATION_GUID_STR) из строки
// const guidOf = (row) =>
//   pick(row, "guid") ||
//   pick(row, "VIOLATION_GUID_STR") ||
//   row?.guid ||
//   row?.VIOLATION_GUID_STR ||
//   null;

// const tnNumber = (row) => pick(row, "number") ?? row?.number ?? null;
// const startDate = (row) =>
//   pick(row, "createDateTime") ?? pick(row, "F81_060_EVENTDATETIME") ?? null;
// const formatDateTime = (v) =>
//   v ? dayjs(v).format("DD.MM.YYYY HH:mm:ss") : "—";

// /* ---------------- metric definitions ---------------- */
// const metricDefs = [
//   {
//     icon: <ThunderboltOutlined />,
//     title: "Отключено ТП",
//     field: "TP_ALL",
//     color: "#faad14",
//   },
//   {
//     icon: <EnvironmentOutlined />,
//     title: "Отключено ЛЭП 6-20 кВ",
//     field: "LINESN_ALL",
//     color: "#52c41a",
//   },
//   {
//     icon: <HomeOutlined />,
//     title: "Населённых пунктов",
//     custom: (arr) =>
//       new Set(arr.map((i) => districtName(i)).filter(Boolean)).size,
//     color: "#1890ff",
//   },
//   {
//     icon: <TeamOutlined />,
//     title: "Население",
//     field: "POPULATION_COUNT",
//     color: "#722ed1",
//   },
//   {
//     icon: <ApartmentOutlined />,
//     title: "МКД",
//     field: "MKD_ALL",
//     color: "#fa541c",
//   },
//   {
//     icon: <BankOutlined />,
//     title: "Частные дома",
//     field: "PRIVATE_HOUSE_ALL",
//     color: "#fa8c16",
//   },
//   { icon: <ShopOutlined />, title: "СНТ", field: "SNT_ALL", color: "#52c41a" },
//   {
//     icon: <FireOutlined />,
//     title: "Котельных",
//     field: "BOILER_ALL",
//     color: "#eb2f96",
//   },
//   {
//     icon: <DashboardOutlined />,
//     title: "ЦТП",
//     field: "CTP_ALL",
//     color: "#13c2c2",
//   },
//   {
//     icon: <ExperimentOutlined />,
//     title: "ВЗУ",
//     field: "WELLS_ALL",
//     color: "#722ed1",
//   },
//   { icon: <BuildOutlined />, title: "КНС", field: "KNS_ALL", color: "#faad14" },
//   {
//     icon: <MedicineBoxOutlined />,
//     title: "Больниц",
//     field: "HOSPITALS_ALL",
//     color: "#1890ff",
//   },
//   {
//     icon: <MedicineBoxOutlined />,
//     title: "Поликлиник",
//     field: "CLINICS_ALL",
//     color: "#722ed1",
//   },
//   {
//     icon: <ReadOutlined />,
//     title: "Школ",
//     field: "SCHOOLS_ALL",
//     color: "#52c41a",
//   },
//   {
//     icon: <SmileOutlined />,
//     title: "Детских садов",
//     field: "KINDERGARTENS_ALL",
//     color: "#fa541c",
//   },
// ];

// const statDefs = [
//   {
//     icon: <TeamOutlined />,
//     title: "Бригады",
//     field: "BRIGADECOUNT",
//     color: "#722ed1",
//   },
//   {
//     icon: <UserOutlined />,
//     title: "Люди",
//     field: "EMPLOYEECOUNT",
//     color: "#13c2c2",
//   },
//   {
//     icon: <ToolOutlined />,
//     title: "Техника",
//     field: "SPECIALTECHNIQUECOUNT",
//     color: "#eb2f96",
//   },
//   {
//     icon: <ThunderboltOutlined />,
//     title: "ПЭС",
//     field: "PES_COUNT",
//     color: "#faad14",
//   },
// ];

// /* ---------------- redesigned component ---------------- */
// export default function Dashboard() {
//   const navigate = useNavigate();
//   const headerRef = useRef(null);
//   const [mapHeight, setMapHeight] = useState(420);
//   // const MAP_SCALE = 0.6;
//   const CARD_SCALE = 0.7; // уменьшаем высоту карточек ~на 30%

//   // density / compact mode by window size (to always fit one screen)
//   const [compact, setCompact] = useState(false);
//   useEffect(() => {
//     const onResize = () => {
//       const h = window.innerHeight;
//       const w = window.innerWidth;
//       setCompact(h < 900 || w < 1280);

//       // вычисляем доступную высоту для карты исходя из высоты шапки
//       const headerH = headerRef.current
//         ? headerRef.current.getBoundingClientRect().height
//         : 0;
//       const paddingY = 32; // паддинги контейнера контента
//       const base = Math.max(300, Math.floor(h - headerH - paddingY));
//       const scaled = Math.max(200, Math.floor(base * MAP_SCALE));
//       setMapHeight(scaled);
//     };
//     onResize();
//     window.addEventListener("resize", onResize);
//     return () => window.removeEventListener("resize", onResize);
//   }, []);

//   // small, modern “chip” (card height ~30% ниже)
//   const Chip = React.memo(({ icon, title, value, color, tooltip }) => (
//     <Tooltip
//       placement="bottom"
//       title={tooltip}
//       overlayStyle={{ maxWidth: 420 }}
//     >
//       <Card
//         hoverable
//         size="small"
//         bordered
//         style={{
//           borderRadius: 14,
//           backdropFilter: "saturate(130%) blur(2px)",
//           boxShadow: "0 4px 12px rgba(18, 31, 53, .06)",
//           height: "100%",
//         }}
//         styles={{
//           body: {
//             padding: compact
//               ? `${Math.round(10 * CARD_SCALE)}px ${Math.round(
//                   12 * CARD_SCALE
//                 )}px`
//               : `${Math.round(12 * CARD_SCALE)}px ${Math.round(
//                   16 * CARD_SCALE
//                 )}px`,
//           },
//         }}
//       >
//         <div
//           style={{
//             display: "grid",
//             gridTemplateColumns: `${compact ? 24 : 28}px 1fr auto`,
//             alignItems: "center",
//             gap: compact ? 8 : 10,
//             minHeight: Math.round((compact ? 76 : 92) * CARD_SCALE),
//             height: "100%",
//           }}
//         >
//           <span style={{ fontSize: compact ? 18 : 22, color }}>{icon}</span>
//           <div
//             style={{
//               lineHeight: 1.2,
//               color: "#6b778c",
//               fontSize: compact ? 11 : 12,
//             }}
//           >
//             {title}
//           </div>
//           <div style={{ fontSize: compact ? 18 : 22, fontWeight: 800, color }}>
//             {Number(value || 0).toLocaleString("ru-RU")}
//           </div>
//         </div>
//       </Card>
//     </Tooltip>
//   ));

//   const [now, setNow] = useState(dayjs().format("DD.MM.YYYY, HH:mm:ss"));
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);
//   const [rows, setRows] = useState([]);
//   const esRef = useRef(null);

//   const fiasCodes = useMemo(
//     () =>
//       Array.from(
//         new Set(rows.flatMap((r) => extractFiasFromRow(r)).filter(Boolean))
//       ),
//     [rows]
//   );

//   // Build mapping: FIAS code -> array of TN numbers
//   const fiasOwners = useMemo(() => {
//     const map = new Map();
//     rows.forEach((r) => {
//       const num = tnNumber(r);
//       if (!num) return;
//       const list = extractFiasFromRow(r);
//       list.forEach((code) => {
//         if (!code) return;
//         if (!map.has(code)) map.set(code, new Set());
//         map.get(code).add(num);
//       });
//     });
//     const obj = {};
//     map.forEach((set, key) => {
//       obj[key] = Array.from(set);
//     });
//     return obj;
//   }, [rows]);

//   // header ticker
//   useEffect(() => {
//     const t = setInterval(
//       () => setNow(dayjs().format("DD.MM.YYYY, HH:mm:ss")),
//       60_000
//     );
//     return () => clearInterval(t);
//   }, []);

//   const loadOpen = async () => {
//     try {
//       setLoading(true);
//       setError(null);
//       const jwt = localStorage.getItem("jwt");
//       if (!jwt) throw new Error("Нет JWT: авторизуйтесь");

//       const qs = [
//         "pagination[page]=1",
//         "pagination[pageSize]=500",
//         "sort[0]=createDateTime:DESC",
//         "filters[isActive][$eq]=true",
//       ].join("&");
//       const { data } = await axios.get(`${URL}/api/teh-narusheniyas?${qs}`, {
//         headers: { Authorization: `Bearer ${jwt}` },
//       });

//       const list = Array.isArray(data?.data)
//         ? data.data.map((x) =>
//             x?.attributes ? { id: x.id, ...x.attributes } : x
//           )
//         : [];
//       setRows(list.filter(isOpenTN));
//     } catch (e) {
//       setError(e?.message || "Ошибка загрузки данных");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     loadOpen();
//   }, []);

//   // SSE автообновление
//   useEffect(() => {
//     if (!URL) return;
//     try {
//       const es = new EventSource(`${URL}/services/event`);
//       esRef.current = es;
//       es.onmessage = () => setTimeout(loadOpen, 350);
//       es.onerror = () => {
//         es.close();
//         esRef.current = null;
//         setTimeout(loadOpen, 5000);
//       };
//       return () => {
//         es.close();
//         esRef.current = null;
//       };
//     } catch {}
//   }, []);

//   // copy GUIDs
//   const handleCopyGuids = async () => {
//     try {
//       const items = rows
//         .map((r) => ({
//           guid: guidOf(r),
//           number: tnNumber(r),
//           start: startDate(r),
//         }))
//         .filter((x) => Boolean(x.guid));
//       if (!items.length) return message.warning("GUID не найдены");
//       const text = items
//         .map(
//           (it, i) =>
//             `${i + 1}. ${it.guid} — №${it.number ?? "—"}, ${formatDateTime(
//               it.start
//             )}`
//         )
//         .join("\n");
//       await navigator.clipboard.writeText(text);
//       message.success(`Скопировано: ${items.length}`);
//     } catch {
//       message.error("Не удалось скопировать");
//     }
//   };

//   // tooltips (details by district)
//   const renderMetricDetails = (m) => {
//     try {
//       if (!rows?.length) return "Нет данных";

//       if (
//         String(m?.title || "")
//           .toLowerCase()
//           .includes("населён")
//       ) {
//         const list = Array.from(
//           new Set(rows.map((r) => districtName(r)).filter(Boolean))
//         ).sort((a, b) => String(a).localeCompare(String(b), "ru"));
//         return (
//           <div style={{ maxHeight: 260, overflow: "auto", paddingRight: 8 }}>
//             <div style={{ fontWeight: 600, marginBottom: 4 }}>
//               Список населённых пунктов
//             </div>
//             {list.length
//               ? list.map((d, i) => (
//                   <div key={d}>
//                     {i + 1}. {d}
//                   </div>
//                 ))
//               : "Нет данных"}
//           </div>
//         );
//       }

//       if (m?.field === "POPULATION_COUNT") {
//         const sums = new Map();
//         rows.forEach((r) => {
//           const d = districtName(r) || "—";
//           const v = toNumber(pick(r, "POPULATION_COUNT"));
//           if (!v) return;
//           sums.set(d, (sums.get(d) || 0) + v);
//         });
//         const list = Array.from(sums.entries()).sort((a, b) => b[1] - a[1]);
//         return (
//           <div style={{ maxHeight: 260, overflow: "auto", paddingRight: 8 }}>
//             <div style={{ fontWeight: 600, marginBottom: 4 }}>
//               ТОП по населению (по отключениям)
//             </div>
//             {list.length
//               ? list.map(([d, v], i) => (
//                   <div key={d}>
//                     {i + 1}. {d}: {Number(v).toLocaleString("ru-RU")}
//                   </div>
//                 ))
//               : "Нет данных"}
//           </div>
//         );
//       }

//       const field = m?.field;
//       if (!field) return "Нет данных";
//       const sums = new Map();
//       rows.forEach((r) => {
//         const d = districtName(r) || "—";
//         const v = toNumber(pick(r, field));
//         if (!v) return;
//         sums.set(d, (sums.get(d) || 0) + v);
//       });
//       const list = Array.from(sums.entries()).sort((a, b) => b[1] - a[1]);
//       if (!list.length) return "Нет данных";
//       return (
//         <div style={{ maxHeight: 260, overflow: "auto", paddingRight: 8 }}>
//           <div style={{ fontWeight: 600, marginBottom: 4 }}>
//             Список по районам
//           </div>
//           {list.map(([d, v], i) => (
//             <div key={d}>
//               {i + 1}. {d}: {Number(v).toLocaleString("ru-RU")}
//             </div>
//           ))}
//         </div>
//       );
//     } catch {
//       return "Нет данных";
//     }
//   };

//   // aggregates
//   const metrics = useMemo(() => {
//     if (!rows.length) return [];
//     return metricDefs.map((m) => ({
//       ...m,
//       value:
//         typeof m.custom === "function"
//           ? m.custom(rows)
//           : rows.reduce((sum, it) => sum + toNumber(pick(it, m.field)), 0),
//     }));
//   }, [rows]);

//   const stats = useMemo(() => {
//     if (!rows.length) return [];
//     return statDefs.map((s) => ({
//       ...s,
//       value: rows.reduce((sum, it) => sum + toNumber(pick(it, s.field)), 0),
//     }));
//   }, [rows]);

//   /* ---------------- UI ---------------- */
//   return (
//     <div style={{ width: "100%", minHeight: "100vh", background: "#f7f9fc" }}>
//       {/* Hero / Header */}
//       <div
//         ref={headerRef}
//         style={{
//           background:
//             "linear-gradient(90deg, #eaf4ff 0%, #f9fbff 50%, #ffffff 100%)",
//           borderBottom: "1px solid #eef3f8",
//         }}
//       >
//         <div
//           style={{
//             maxWidth: "min(100vw, 2400px)",
//             width: "100%",
//             margin: "0 auto",
//             padding: "14px 24px",
//           }}
//         >
//           <Row align="middle" justify="start">
//             <Col>
//               <Button onClick={() => navigate("/")} icon={<HomeOutlined />}>
//                 На главную
//               </Button>
//             </Col>
//           </Row>

//           <div style={{ textAlign: "center", marginTop: 8 }}>
//             <Title
//               level={2}
//               style={{
//                 margin: 0,
//                 textAlign: "center",
//                 color: "#1575bc",
//                 fontWeight: 800,
//                 letterSpacing: 0.2,
//               }}
//             >
//               ТЕХНОЛОГИЧЕСКИЕ НАРУШЕНИЯ В ЭЛЕКТРИЧЕСКИХ СЕТЯХ АО «МОСОБЛЭНЕРГО»
//             </Title>
//             <Text
//               style={{
//                 display: "block",
//                 fontWeight: 600,
//                 color: "#1575bc",
//                 marginTop: 6,
//               }}
//             >
//               По состоянию на {now}
//             </Text>

//             {/* <Typography.Title
//               level={5}
//               style={{ marginBottom: 4, color: "red" }}
//             >
//               Коллеги, у нас закончились лимиты обращений к DaData, поэтому
//               карта на ДашБорде не будет работать (лимиты раз в сутки
//               обновляются, так что в понедельник починим 💪){" "}
//             </Typography.Title> */}
//           </div>
//         </div>
//       </div>

//       {/* Content */}
//       <div
//         style={{
//           maxWidth: "min(100vw, 2400px)",
//           width: "100%",
//           margin: "0 auto",
//           padding: "12px 24px 24px",
//         }}
//       >
//         <div
//           style={{
//             display: "grid",
//             gridTemplateColumns: compact
//               ? "1fr"
//               : "minmax(820px, 2.2fr) minmax(460px, 1fr)",
//             gap: compact ? 10 : 14,
//             alignItems: "start",
//           }}
//         >
//           {/* LEFT: cards & stats */}
//           <div>
//             {loading && !error && (
//               <Space
//                 style={{
//                   width: "100%",
//                   justifyContent: "center",
//                   marginTop: 40,
//                 }}
//               >
//                 <Spin size="large" />
//               </Space>
//             )}
//             {error && (
//               <Title level={4} type="danger" style={{ textAlign: "center" }}>
//                 {error}
//               </Title>
//             )}

//             {!loading && !error && (
//               <>
//                 <div
//                   style={{
//                     display: "grid",
//                     gridTemplateColumns: `minmax(${compact ? 260 : 300}px, ${
//                       compact ? 320 : 360
//                     }px) repeat(auto-fill, minmax(${
//                       compact ? 190 : 220
//                     }px, 1fr))`,
//                     gridAutoFlow: "row dense",
//                     gridAutoRows: "minmax(50px, auto)",
//                     gap: compact ? 10 : 14,
//                     alignItems: "stretch",
//                   }}
//                 >
//                   {/* main summary card */}
//                   <Card
//                     variant="filled"
//                     style={{ borderRadius: 20, background: "#e9f4ff" }}
//                     styles={{ body: { padding: compact ? 12 : 16 } }}
//                   >
//                     <div
//                       style={{
//                         display: "flex",
//                         alignItems: "baseline",
//                         justifyContent: "center",
//                         gap: 12,
//                         flexWrap: "wrap",
//                       }}
//                     >
//                       <Text strong style={{ fontSize: compact ? 18 : 20 }}>
//                         Всего открытых ТН:
//                       </Text>
//                       <span
//                         style={{
//                           fontSize: compact ? 40 : 50,
//                           color: "#1575bc",
//                           fontWeight: 900,
//                           lineHeight: 1,
//                         }}
//                       >
//                         {rows.length}
//                       </span>
//                     </div>
//                     <Button
//                       onClick={handleCopyGuids}
//                       disabled={!rows?.length}
//                       style={{ marginTop: 12, borderRadius: 12, width: "100%" }}
//                     >
//                       Скопировать GUID
//                     </Button>

//                     {/* <Button
//                       onClick={handleCopyFias}
//                       disabled={!rows?.length}
//                       style={{ marginTop: 8, borderRadius: 12, width: "100%" }}
//                     >
//                       Скопировать все ФИАС
//                     </Button> */}
//                   </Card>

//                   {/* metrics */}
//                   {metrics.map(
//                     ({ icon, title, value, color, field, custom }) => (
//                       <Chip
//                         key={title}
//                         icon={icon}
//                         title={title}
//                         value={value}
//                         color={color}
//                         tooltip={renderMetricDetails({ title, field, custom })}
//                       />
//                     )
//                   )}
//                 </div>
//                 {/* Задействовано сил и средств Мособлэнерго card */}
//                 <div style={{ marginTop: 12 }}>
//                   <Card
//                     style={{ borderRadius: 20 }}
//                     styles={{ body: { padding: compact ? 10 : 14 } }}
//                     title={
//                       <div
//                         style={{
//                           fontWeight: 700,
//                           color: "#1575bc",
//                           textAlign: "center",
//                         }}
//                       >
//                         Задействовано сил и средств Мособлэнерго
//                       </div>
//                     }
//                   >
//                     <div
//                       style={{
//                         display: "grid",
//                         gridTemplateColumns: `repeat(auto-fill, minmax(${
//                           compact ? 170 : 200
//                         }px, 1fr))`,
//                         gap: compact ? 10 : 12,
//                         alignItems: "stretch",
//                       }}
//                     >
//                       {stats.map(({ icon, title, value, color }) => (
//                         <Chip
//                           key={title}
//                           icon={icon}
//                           title={title}
//                           value={value}
//                           color={color}
//                         />
//                       ))}
//                     </div>
//                   </Card>
//                 </div>
//               </>
//             )}

//             {rows.length === 0 && loading && (
//               <Skeleton
//                 active
//                 paragraph={{ rows: 4 }}
//                 style={{ marginTop: 24 }}
//               />
//             )}
//           </div>

//           {/* RIGHT: map */}
//           <div>
//             <Card
//               style={{ borderRadius: 20, overflow: "hidden" }}
//               styles={{ body: { padding: 0 } }}
//               title={
//                 <div style={{ fontWeight: 700, color: "#1575bc" }}>
//                   Карта отключений (подложка)
//                 </div>
//               }
//             >
//               <div
//                 style={{
//                   width: "100%",
//                   height: mapHeight,
//                   minHeight: compact ? 180 : 220,
//                   position: "relative",
//                 }}
//               >
//                 <MapPanel
//                   height="100%"
//                   initialState={{ center: [55.751244, 37.618423], zoom: 8 }}
//                   fiasCodes={fiasCodes}
//                   url={URL}
//                   fiasCollection={FIAS_COLLECTION}
//                   fiasOwners={fiasOwners}
//                 />
//               </div>
//             </Card>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
