import React, { useEffect, useState } from "react";
import { Typography, Card, Button, message, Tooltip } from "antd";
import {
  ThunderboltOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  DashboardOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import axios from "axios";
const URL = import.meta.env.VITE_URL_BACKEND;

/**
 * InfoTN — БЛОК 1: "Информация о ТН"
 * Самодостаточный компонент: грузит данные из Strapi и рендерит:
 *  - компактные карточки (как во 2-м блоке) с метриками;
 *  - круговую диаграмму "За сегодня: открыто / закрыто / удалено"
 * Никаких других блоков/зависимостей внутри нет.
 */

const { Title } = Typography;

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

// Рабочие сутки 08:00→08:00: приводим дату к ключу суток со сдвигом -8ч
const dayKey0808 = (v) =>
  v ? dayjs(v).subtract(8, "hour").format("YYYY-MM-DD") : null;

/* ---------------- компонент ---------------- */
export default function InfoTN({ rows = [], rows7d = [] }) {
  // локальный фолбэк на случай, если rows7d не передан сверху
  const [rows7dLocal, setRows7dLocal] = useState([]);
  const [loading7d, setLoading7d] = useState(false);

  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onResize = () => {
      const h = window.innerHeight;
      const w = window.innerWidth;
      setCompact(h < 900 || w < 1280);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Подгружаем все ТН за 7 суток (08→08) если сверху не передали rows7d
  useEffect(() => {
    const needFetch = !Array.isArray(rows7d) || rows7d.length === 0;
    if (!needFetch) return;

    const load7d = async () => {
      try {
        setLoading7d(true);
        const jwt = localStorage.getItem("jwt");
        if (!jwt) throw new Error("Нет JWT");

        const since7d = dayjs().startOf("day").subtract(6, "day").toISOString();
        const qsAll7d = [
          "pagination[page]=1",
          "pagination[pageSize]=1000",
          "sort[0]=createDateTime:DESC",
          `filters[createDateTime][$gte]=${encodeURIComponent(since7d)}`,
        ].join("&");

        const resp = await axios.get(`${URL}/api/teh-narusheniyas?${qsAll7d}`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });

        const listAll7d = Array.isArray(resp?.data?.data)
          ? resp.data.data.map((x) =>
              x?.attributes ? { id: x.id, ...x.attributes } : x
            )
          : [];

        setRows7dLocal(listAll7d);
      } catch (e) {
        console.warn("[InfoTN] 7d fetch error:", e?.message || e);
        setRows7dLocal([]);
      } finally {
        setLoading7d(false);
      }
    };

    load7d();
  }, [rows7d]);

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
            boxShadow: "0 3px 10px rgba(18, 31, 53, .05)",
            width: "100%",
            minWidth: 0,
            height: "100%",
            opacity: active ? 1 : 0.9,
          }}
          styles={{
            body: {
              padding: compact ? "6px 10px" : "8px 12px",
              whiteSpace: "normal",
            },
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `${compact ? 18 : 20}px 1fr auto`,
              alignItems: "center",
              gap: compact ? 6 : 8,
              minHeight: compact ? 38 : 44,
            }}
          >
            <span style={{ fontSize: compact ? 14 : 16, color: tone }}>
              {icon}
            </span>
            <div
              style={{
                lineHeight: 1.1,
                color: labelColor,
                fontSize: compact ? 11 : 12,
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: compact ? 14 : 17,
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

  // sums a field, accepting either a single key or an array of fallback keys
  const sumField = (fieldOrFields) =>
    rows.reduce((sum, it) => sum + toNumber(pickAny(it, fieldOrFields)), 0);
  const uniqCount = (getter) => new Set(rows.map(getter).filter(Boolean)).size;

  // агрегаты для карточек
  const totals = {
    totalOpen: rows.length,
    tp: sumField("TP_ALL"),
    tpFull: sumField([
      "TP_ALL",
      "TP_FULL_ALL",
      "TP_OFF_FULL_ALL",
      "TPFULL_ALL",
      "TP_FULL",
      "TP_PL_FULL_ALL",
    ]),
    tp1sec: sumField([
      "TP_SECTION",
      "TP_1SEC_ALL",
      "TP1SEC_ALL",
      "TP_1_SECTION_ALL",
      "TP_ONE_SECTION_ALL",
      "TP_BY_1_SECTION_ALL",
    ]),
    lines: sumField("LINESN_ALL"),
    population: sumField("POPULATION_COUNT"),
    go: uniqCount(districtName),
  };

  const effectiveRows7d =
    Array.isArray(rows7d) && rows7d.length ? rows7d : rows7dLocal;

  // Донат "за сегодня" (без двойного учёта)
  const DonutToday = () => {
    const todayKey = dayKey0808(dayjs());
    const sameWorkday = (v) => (v ? dayKey0808(v) === todayKey : false);
    const createdToday = effectiveRows7d.filter((r) =>
      sameWorkday(startDate(r))
    );

    const isDeletedRow = (r) => {
      const st = String(
        pick(r, "STATUS_NAME") ?? r?.STATUS_NAME ?? ""
      ).toLowerCase();
      const upd = pick(r, "updatedAt") ?? r?.updatedAt ?? null;
      const del = pick(r, "deletedAt") ?? r?.deletedAt ?? null;
      return st.includes("удален") || st.includes("delete") || sameWorkday(del);
    };

    const isClosedRow = (r) => {
      if (isOpenTN(r) || isDeletedRow(r)) return false;
      const upd = pick(r, "updatedAt") ?? r?.updatedAt ?? null;
      const rec = recoveryDate(r);
      return sameWorkday(upd) || sameWorkday(rec);
    };

    const openList = [];
    const closedList = [];
    createdToday.forEach((r) => {
      if (isDeletedRow(r)) return; // игнорируем удалённые
      if (isClosedRow(r)) closedList.push(r);
      else openList.push(r);
    });

    const opened = openList.length;
    const closed = closedList.length;
    // не учитываем удалённые в сумме
    const total = opened + closed;

    const deg = (n) => (total ? (n / total) * 360 : 0);
    const dOpen = deg(opened);
    const dClosed = deg(closed);

    const size = compact ? 96 : 112;
    const ringStyle = {
      width: size,
      height: size,
      borderRadius: "50%",
      background: `conic-gradient(#ff7875 0 ${dOpen}deg, #52c41a ${dOpen}deg 360deg)`,
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
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          cursor: list?.length ? "copy" : "default",
        }}
        onClick={() => list?.length && copyList(list, label)}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: color,
          }}
        />
        <span style={{ fontSize: 10.5, color: "#6b778c" }}>{label}</span>
        <strong style={{ marginLeft: 4 }}>{count}</strong>
      </div>
    );

    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, color: "#1575bc", marginBottom: 6 }}>
            За сегодня:
          </div>
          <div style={ringStyle}>
            <div style={innerStyle}>
              <div
                style={{
                  fontSize: compact ? 22 : 26,
                  fontWeight: 900,
                  lineHeight: 1,
                }}
              >
                {total}
              </div>
              <div style={{ fontSize: 12, color: "#6b778c" }}>
                всего за сегодня
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <LegendRow
            color="#ff7875"
            label="Открыты"
            count={opened}
            list={openList}
          />
          <LegendRow
            color="#52c41a"
            label="Закрыто"
            count={closed}
            list={closedList}
          />
        </div>
      </div>
    );
  };

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

  // UI — только карточки и донат
  return (
    <Card
      style={{ borderRadius: 20 }}
      title={
        <div style={{ fontWeight: 700, color: "#1575bc" }}>Информация о ТН</div>
      }
      styles={{ body: { padding: compact ? 6 : 8 } }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact
            ? "1fr"
            : "minmax(520px,1.2fr) minmax(300px,0.8fr)",
          columnGap: 16,
          rowGap: 6,
          alignItems: "start",
        }}
      >
        {/* левая колонка — компактные карточки */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(${
              compact ? 150 : 168
            }px, 1fr))`,
            columnGap: compact ? 10 : 12,
            rowGap: compact ? 10 : 12,
            gridAutoRows: "minmax(44px, auto)",
            justifyItems: "stretch",
            alignItems: "stretch",
            alignContent: "start",
          }}
        >
          {[
            {
              icon: <ThunderboltOutlined />,
              title: "Всего открытых ТН",
              value: totals.totalOpen,
              color: "#1575bc",
            },
            {
              icon: <DashboardOutlined />,
              title: "Отключенных ТП полностью",
              value: totals.tpFull,
              color: "#faad14",
            },
            {
              icon: <DashboardOutlined />,
              title: "Отключенных ТП по 1 сек",
              value: totals.tp1sec,
              color: "#13c2c2",
            },
            {
              icon: <ThunderboltOutlined />,
              title: "Отключено ЛЭП 6–20 кВ",
              value: totals.lines,
              color: "#ff4d4f",
            },
            {
              icon: <TeamOutlined />,
              title: "Население",
              value: totals.population,
              color: "#13c2c2",
            },
            {
              icon: <EnvironmentOutlined />,
              title: "Городские округа",
              value: totals.go,
              color: "#722ed1",
            },
          ].map(({ icon, title, value, color }) => (
            <Chip
              key={title}
              icon={icon}
              title={title}
              value={value}
              color={color}
            />
          ))}

          {/* GUID — кнопка в том же визуальном размере */}
          <Card
            size="small"
            bordered
            styles={{ body: { padding: compact ? 3 : 5 } }}
            style={{
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Button
              onClick={handleCopyGuids}
              disabled={!rows?.length}
              style={{ borderRadius: 8, width: "100%" }}
            >
              GUID
            </Button>
          </Card>
        </div>

        {/* правая колонка — круговая диаграмма */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingLeft: compact ? 12 : 16,
          }}
        >
          <DonutToday />
        </div>
      </div>
    </Card>
  );
}
