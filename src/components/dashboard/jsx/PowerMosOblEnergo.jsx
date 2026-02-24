import React, { useEffect, useMemo, useState } from "react";
import { Card, Tooltip } from "antd";
import {
  ThunderboltOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  TeamOutlined,
  UserOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import axios from "axios";
import {
  URL,
  toNumber,
  pick,
  pickAny,
  isOpenTN,
  uniqueSorted,
} from "../js/dashboardCommon"; // Общие хелперы dashboard.

/**
 * Компонент "Задействовано сил и средств Мособлэнерго"
 * — выделен в отдельный, автономный блок.
 * Данные тянутся только из открытых ТН (isActive=true),
 * агрегируются и выводятся компактными карточками (Chip).
 */

const renderList = (items, heading) => (
  <div style={{ maxHeight: 260, overflow: "auto", paddingRight: 8 }}>
    <div style={{ fontWeight: 600, marginBottom: 6 }}>{heading}</div>
    {items.length ? items.map((name, i) => (
      <div key={name + i}>{i + 1}. {name}</div>
    )) : "Нет данных"}
  </div>
);

/* ------------ компактная карточка ------------ */
const Chip = React.memo(function Chip({ icon, title, value, color, compact, tooltip }) {
  const v = Number(value || 0);
  const active = v > 0;
  const tone = active ? color : "#bfbfbf";
  const labelColor = "#6b778c";
  const CARD_SCALE = 0.42;

  return (
    <Tooltip placement="bottom" title={tooltip ?? title} overlayStyle={{ maxWidth: 420 }}>
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
            padding: compact
              ? `${Math.round(6 * CARD_SCALE)}px ${Math.round(
                  8 * CARD_SCALE
                )}px`
              : `${Math.round(8 * CARD_SCALE)}px ${Math.round(
                  10 * CARD_SCALE
                )}px`,
          },
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${compact ? 18 : 20}px 1fr auto`,
            alignItems: "center",
            gap: compact ? 4 : 6,
            minHeight: Math.round((compact ? 50 : 56) * CARD_SCALE),
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

/* ------------ основной компонент ------------ */
export default function PowerMosOblEnergo() {
  const [rows, setRows] = useState([]);
  const [compact, setCompact] = useState(false);

  // компактный режим по размеру окна (как в остальных блоках)
  useEffect(() => {
    const onResize = () =>
      setCompact(window.innerHeight < 900 || window.innerWidth < 1280);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const sumField = (fieldOrFields) =>
    rows.reduce((sum, it) => sum + toNumber(pickAny(it, fieldOrFields)), 0);

  const norm = (v) =>
    typeof v === "string" ? v.replace(/\s+/g, " ").trim().toLowerCase() : "";
  const uniqCountBy = (resolver) => {
    const set = new Set();
    rows.forEach((r) => {
      const raw = resolver(r);
      const val = norm(raw);
      if (val) set.add(val);
    });
    return set.size;
  };

  const totals = useMemo(
    () => ({
      // Филиалы считаем строго по OWN_SCNAME (уникальные значения)
      filials: uniqCountBy((r) => pickAny(r, "OWN_SCNAME")),
      // ПО считаем строго по SCNAME (уникальные значения)
      pos: uniqCountBy((r) => pickAny(r, "SCNAME")),
      brigades: sumField("BRIGADECOUNT"),
      employees: sumField("EMPLOYEECOUNT"),
      tech: sumField("SPECIALTECHNIQUECOUNT"),
      pesCount: sumField("PES_COUNT"),
      pesPower: sumField("PES_POWER"),
    }),
    [rows]
  );

  const lists = useMemo(() => ({
    filials: uniqueSorted(rows.map((r) => pickAny(r, "OWN_SCNAME"))),
    pos: uniqueSorted(rows.map((r) => pickAny(r, "SCNAME"))),
  }), [rows]);

  // загрузка только открытых ТН
  useEffect(() => {
    let es;
    const loadOpen = async () => {
      try {
        const jwt = localStorage.getItem("jwt");
        const headers = jwt ? { Authorization: `Bearer ${jwt}` } : {};
        const qsOpen = [
          "pagination[page]=1",
          "pagination[pageSize]=500",
          "sort[0]=createDateTime:DESC",
          "filters[isActive][$eq]=true",
        ].join("&");
        const resp = await axios.get(`${URL}/api/teh-narusheniyas?${qsOpen}`, {
          headers,
        });

        const list = Array.isArray(resp?.data?.data)
          ? resp.data.data.map((x) =>
              x?.attributes ? { id: x.id, ...x.attributes } : x
            )
          : [];

        setRows(list.filter(isOpenTN));
      } catch (e) {
        // мягко игнорируем, блок не критичен
        console.warn("PowerMosOblEnergo: load error:", e?.message || e);
      }
    };

    loadOpen();

    // SSE автообновление
    try {
      es = new EventSource(`${URL}/services/event`);
      es.onmessage = () => setTimeout(loadOpen, 350);
      es.onerror = () => {
        try {
          es.close();
        } catch {}
      };
    } catch {}

    return () => {
      try {
        es?.close();
      } catch {}
    };
  }, []);

  return (
    <Card
      style={{ borderRadius: 20, marginBottom: 8 }}
      styles={{ body: { padding: compact ? 8 : 10 } }}
      title={
        <div
          style={{
            fontWeight: 700,
            color: "#1575bc",
            // textAlign: "center",
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
            compact ? 150 : 180
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
          compact={compact}
          tooltip={renderList(lists.filials, "Филиалы")}
        />
        <Chip
          icon={<EnvironmentOutlined />}
          title="ПО"
          value={totals.pos}
          color="#1575bc"
          compact={compact}
          tooltip={renderList(lists.pos, "ПО")}
        />
        <Chip
          icon={<TeamOutlined />}
          title="Бригады"
          value={totals.brigades}
          color="#722ed1"
          compact={compact}
        />
        <Chip
          icon={<UserOutlined />}
          title="Люди"
          value={totals.employees}
          color="#13c2c2"
          compact={compact}
        />
        <Chip
          icon={<ToolOutlined />}
          title="Техника"
          value={totals.tech}
          color="#eb2f96"
          compact={compact}
        />
        <Chip
          icon={<ThunderboltOutlined />}
          title="ПЭС"
          value={totals.pesCount}
          color="#faad14"
          compact={compact}
        />
        <Chip
          icon={<ThunderboltOutlined />}
          title="Мощность ПЭС (кВт)"
          value={totals.pesPower}
          color="#faad14"
          compact={compact}
        />
      </div>
    </Card>
  );
}
