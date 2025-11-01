import React, { useEffect, useState } from "react";
import { Typography, Card, Button, message, Tooltip } from "antd";
import {
  ThunderboltOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  DashboardOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

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

/* ---------------- компонент ---------------- */
export default function InfoTN({ rows = [], rows7d = [] }) {
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
            height: "100%",
            opacity: active ? 1 : 0.9,
          }}
          styles={{
            body: {
              padding: compact ? "6px 8px" : "8px 10px",
            },
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `${compact ? 18 : 20}px 1fr auto`,
              alignItems: "center",
              gap: compact ? 4 : 6,
              minHeight: compact ? 46 : 54,
              height: "100%",
            }}
          >
            <span style={{ fontSize: compact ? 14 : 16, color: tone }}>
              {icon}
            </span>
            <div
              style={{
                lineHeight: 1.1,
                color: labelColor,
                fontSize: compact ? 9 : 10,
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: compact ? 14 : 18,
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
      "TP_FULL_ALL",
      "TP_OFF_FULL_ALL",
      "TPFULL_ALL",
      "TP_FULL",
      "TP_PL_FULL_ALL",
    ]),
    tp1sec: sumField([
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

  // Донат "за сегодня" (без двойного учёта)
  const DonutToday = () => {
    const createdToday = rows7d.filter((r) =>
      dayjs(startDate(r)).isSame(dayjs(), "day")
    );

    const sameDay = (v) => (v ? dayjs(v).isSame(dayjs(), "day") : false);

    const isDeletedRow = (r) => {
      const st = String(
        pick(r, "STATUS_NAME") ?? r?.STATUS_NAME ?? ""
      ).toLowerCase();
      const upd = pick(r, "updatedAt") ?? r?.updatedAt ?? null;
      const del = pick(r, "deletedAt") ?? r?.deletedAt ?? null;
      return st.includes("удален") || st.includes("delete") || sameDay(del);
    };

    const isClosedRow = (r) => {
      if (isOpenTN(r) || isDeletedRow(r)) return false;
      const upd = pick(r, "updatedAt") ?? r?.updatedAt ?? null;
      const rec = recoveryDate(r);
      return sameDay(upd) || sameDay(rec);
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

    const size = compact ? 110 : 135;
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
          gap: 4,
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
        <span style={{ fontSize: 11, color: "#6b778c" }}>{label}</span>
        <strong style={{ marginLeft: 4 }}>{count}</strong>
      </div>
    );

    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, color: "#1575bc", marginBottom: 6 }}>
            За сегодня: открыто / закрыто
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
            label="Открыто (остаются)"
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
      styles={{ body: { padding: compact ? 8 : 10 } }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr" : "1.4fr 1fr",
          gap: 12,
          alignItems: "stretch",
        }}
      >
        {/* левая колонка — компактные карточки */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(${
              compact ? 150 : 180
            }px, 1fr))`,
            gap: compact ? 10 : 12,
            alignItems: "stretch",
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
            styles={{ body: { padding: compact ? 6 : 8 } }}
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

        {/* правая колонка — круговая диаграмма */}
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
  );
}
