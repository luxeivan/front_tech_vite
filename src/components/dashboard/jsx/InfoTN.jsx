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
import {
  URL,
  isDashboardViolationType,
  toNumber,
  pick,
  pickAny,
  isOpenTN,
  districtName,
  guidOf,
  tnNumber,
  startDate,
  formatDateTime,
  recoveryDate,
  dayKey0808,
} from "../js/dashboardCommon"; // Общие хелперы dashboard.

/**
 * InfoTN — БЛОК 1: "Информация о ТН"
 * Самодостаточный компонент: грузит данные из Strapi и рендерит:
 *  - компактные карточки (как во 2-м блоке) с метриками;
 *  - круговую диаграмму "За сегодня: открыто / закрыто / удалено"
 * Никаких других блоков/зависимостей внутри нет.
 */

const { Title } = Typography;

/* ---------------- компонент ---------------- */
export default function InfoTN({ rows = [], rows7d = [] }) {
  // локальный фолбэк на случай, если rows7d не передан сверху
  const [rows7dLocal, setRows7dLocal] = useState([]);
  const [loading7d, setLoading7d] = useState(false);

  const [compact, setCompact] = useState(false);
  const [medium, setMedium] = useState(false);
  useEffect(() => {
    const onResize = () => {
      const h = window.innerHeight;
      const w = window.innerWidth;
      setCompact(h < 900 || w < 1280);
      setMedium(w >= 1280 && w < 1540);
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

        const since7d = dayjs().startOf("day").add(8, "hour").subtract(6, "day").toISOString();
        const qsAll7d = [
          "pagination[page]=1",
          "pagination[pageSize]=1000",
          "sort[0]=createDateTime:DESC",
          `filters[createDateTime][$gte]=${encodeURIComponent(since7d)}`,
          "filters[VIOLATION_TYPE][$in][0]=А",
          "filters[VIOLATION_TYPE][$in][1]=В",
        ].join("&");

        const resp = await axios.get(`${URL}/api/teh-narusheniyas?${qsAll7d}`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });

        const listAll7d = Array.isArray(resp?.data?.data)
          ? resp.data.data.map((x) =>
              x?.attributes ? { id: x.id, ...x.attributes } : x
            )
          : [];

        setRows7dLocal(listAll7d.filter(isDashboardViolationType));
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

  const filteredRows = React.useMemo(
    () => (Array.isArray(rows) ? rows.filter(isDashboardViolationType) : []),
    [rows]
  );

  // sums a field, accepting either a single key or an array of fallback keys
  const sumField = (fieldOrFields) =>
    filteredRows.reduce((sum, it) => sum + toNumber(pickAny(it, fieldOrFields)), 0);
  const uniqCount = (getter) => new Set(filteredRows.map(getter).filter(Boolean)).size;

  // агрегаты для карточек
  const totals = {
    totalOpen: filteredRows.length,
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

  const effectiveRows7d = React.useMemo(() => {
    const source = Array.isArray(rows7d) && rows7d.length ? rows7d : rows7dLocal;
    return Array.isArray(source) ? source.filter(isDashboardViolationType) : [];
  }, [rows7d, rows7dLocal]);

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

  const todayStats = React.useMemo(() => {
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
    const duration = {
      green: [],
      orange: [],
      red: [],
    };

    const durationHoursOf = (r) => {
      const startTs = dayjs(startDate(r)).valueOf();
      if (!Number.isFinite(startTs) || startTs <= 0) return null;

      const recoveryTs = dayjs(recoveryDate(r)).valueOf();
      const updatedTs = dayjs(pick(r, "updatedAt") ?? r?.updatedAt ?? null).valueOf();
      const status = String(pick(r, "STATUS_NAME") ?? r?.STATUS_NAME ?? "").toLowerCase();
      const isFinal = ["запитана", "закрыта"].includes(status);

      let endTs = Date.now();
      if (Number.isFinite(recoveryTs) && recoveryTs > 0) {
        endTs = recoveryTs;
      } else if (isFinal && Number.isFinite(updatedTs) && updatedTs > 0) {
        endTs = updatedTs;
      }

      if (endTs <= startTs) return null;
      return (endTs - startTs) / (60 * 60 * 1000);
    };

    const activeToday = [];
    createdToday.forEach((r) => {
      if (isDeletedRow(r)) return; // игнорируем удалённые
      activeToday.push(r);
      if (isClosedRow(r)) closedList.push(r);
      else openList.push(r);

      const hours = durationHoursOf(r);
      if (hours == null) return;
      if (hours > 4) duration.red.push(r);
      else if (hours > 2) duration.orange.push(r);
      else duration.green.push(r);
    });

    return {
      openList,
      closedList,
      duration,
      total: activeToday.length,
    };
  }, [effectiveRows7d]);

  const donutSize = compact ? 112 : medium ? 96 : 128;
  const donutPanelWidth = compact ? 320 : medium ? 220 : 360;
  const donutPanelStyle = {
    width: "100%",
    maxWidth: donutPanelWidth,
    minWidth: 0,
  };
  const donutTitleStyle = {
    fontWeight: 700,
    color: "#1575bc",
    marginBottom: compact || medium ? 6 : 8,
    textAlign: "left",
    fontSize: compact ? 18 : medium ? 15 : 20,
  };
  const donutBodyStyle = {
    display: "grid",
    gridTemplateColumns: `${donutSize}px minmax(${medium ? 72 : 130}px, 1fr)`,
    alignItems: "center",
    columnGap: compact ? 12 : medium ? 8 : 18,
  };
  const donutLegendStyle = {
    display: "flex",
    flexDirection: "column",
    gap: compact ? 6 : medium ? 5 : 8,
    minWidth: 0,
  };

  // Донат "за сегодня" (без двойного учёта)
  const DonutToday = () => {
    const opened = todayStats.openList.length;
    const closed = todayStats.closedList.length;
    const total = opened + closed;
    const deg = (n) => (total ? (n / total) * 360 : 0);
    const dOpen = deg(opened);
    const dClosed = deg(closed);

    const ringStyle = {
      width: donutSize,
      height: donutSize,
      borderRadius: "50%",
      background: `conic-gradient(#ff7875 0 ${dOpen}deg, #52c41a ${dOpen}deg 360deg)`,
      position: "relative",
    };
    const innerStyle = {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: Math.round(donutSize * 0.68),
      height: Math.round(donutSize * 0.68),
      background: "#fff",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      textAlign: "center",
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
            width: medium ? 8 : 10,
            height: medium ? 8 : 10,
            borderRadius: "50%",
            background: color,
            flex: "0 0 auto",
          }}
        />
        <span
          style={{
            fontSize: medium ? 9.5 : 10.5,
            color: "#6b778c",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <strong style={{ marginLeft: medium ? 2 : 4, fontSize: medium ? 12 : 14 }}>
          {count}
        </strong>
      </div>
    );

    return (
      <div style={donutPanelStyle}>
        <div style={donutTitleStyle}>За сегодня:</div>
        <div style={donutBodyStyle}>
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
              <div style={{ fontSize: medium ? 10 : 12, color: "#6b778c" }}>
                всего за сегодня
              </div>
            </div>
          </div>
          <div style={donutLegendStyle}>
          <LegendRow
            color="#ff7875"
            label="Открыты"
            count={opened}
            list={todayStats.openList}
          />
          <LegendRow
            color="#52c41a"
            label="Закрыто"
            count={closed}
            list={todayStats.closedList}
          />
          </div>
        </div>
      </div>
    );
  };

  const DonutDuration = () => {
    const green = todayStats.duration.green.length;
    const orange = todayStats.duration.orange.length;
    const red = todayStats.duration.red.length;
    const total = todayStats.total;
    const chartTotal = green + orange + red;

    const deg = (n) => (chartTotal ? (n / chartTotal) * 360 : 0);
    const dGreen = deg(green);
    const dOrange = deg(orange);
    const dRed = deg(red);

    const ringStyle = {
      width: donutSize,
      height: donutSize,
      borderRadius: "50%",
      background: chartTotal
        ? `conic-gradient(#52c41a 0 ${dGreen}deg, #fa8c16 ${dGreen}deg ${
            dGreen + dOrange
          }deg, #ff4d4f ${dGreen + dOrange}deg ${dGreen + dOrange + dRed}deg)`
        : "#f0f0f0",
      position: "relative",
    };
    const innerStyle = {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: Math.round(donutSize * 0.68),
      height: Math.round(donutSize * 0.68),
      background: "#fff",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      textAlign: "center",
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
            width: medium ? 8 : 10,
            height: medium ? 8 : 10,
            borderRadius: "50%",
            background: color,
            flex: "0 0 auto",
          }}
        />
        <span
          style={{
            fontSize: medium ? 9.5 : 10.5,
            color: "#6b778c",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <strong style={{ marginLeft: medium ? 2 : 4, fontSize: medium ? 12 : 14 }}>
          {count}
        </strong>
      </div>
    );

    return (
      <div style={donutPanelStyle}>
        <div style={donutTitleStyle}>Длительность ТН</div>
        <div style={donutBodyStyle}>
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
              <div style={{ fontSize: medium ? 10 : 12, color: "#6b778c" }}>всего</div>
            </div>
          </div>
          <div style={donutLegendStyle}>
          <LegendRow
            color="#52c41a"
            label="До 2 ч."
            count={green}
            list={todayStats.duration.green}
          />
          <LegendRow
            color="#fa8c16"
            label="От 2 до 4 ч."
            count={orange}
            list={todayStats.duration.orange}
          />
          <LegendRow
            color="#ff4d4f"
            label="Более 4 ч."
            count={red}
            list={todayStats.duration.red}
          />
          </div>
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
            : medium
              ? "minmax(350px,1fr) minmax(210px,0.55fr)"
              : "minmax(520px,1.2fr) minmax(300px,0.8fr)",
          columnGap: compact ? 12 : medium ? 10 : 16,
          rowGap: 6,
          alignItems: "start",
          overflow: "hidden",
        }}
      >
        {/* левая колонка — компактные карточки */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(${
              compact ? 150 : medium ? 140 : 168
            }px, 1fr))`,
            columnGap: compact ? 10 : medium ? 8 : 12,
            rowGap: compact ? 10 : medium ? 8 : 12,
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

        {/* правая колонка — круговые диаграммы */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: compact ? 12 : medium ? 10 : 16,
            paddingLeft: compact ? 12 : medium ? 0 : 16,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <DonutToday />
          <div
            style={{
              width: "100%",
              maxWidth: medium ? 220 : 330,
              borderTop: "1px solid #e6f0ff",
            }}
          />
          <DonutDuration />
        </div>
      </div>
    </Card>
  );
}
