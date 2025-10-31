import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, Tooltip, Space, Spin } from "antd";
import {
  FireOutlined,
  DashboardOutlined,
  MedicineBoxOutlined,
  ExperimentOutlined,
  BuildOutlined,
  ReadOutlined,
  SmileOutlined,
  ApartmentOutlined,
  BankOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import axios from "axios";

const URL = import.meta.env.VITE_URL_BACKEND;
const CARD_SCALE = 0.42;

/* ---------------- helpers ---------------- */
const s = (v) =>
  typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();

const isOpenTN = (row) => {
  const v =
    row?.isActive ??
    row?.data?.isActive ??
    row?.data?.data?.isActive ??
    row?.attributes?.isActive ??
    (row?.attributes && row.attributes.isActive?.value);

  return v === true || v === 1 || v === "true";
};

// классификация типов СЗО ровно по той же логике, что и в главной таблице
const classifySocialTyp = (t) => {
  const x = s(t).toLowerCase();
  if (x.includes("мкд") || x.includes("дом")) return "mkd";
  if (x.includes("школ")) return "schools";
  if (x.includes("детс") || x.includes("сад")) return "kindergartens";
  if (x.includes("больниц")) return "hosp";
  if (x.includes("поликлин")) return "clinics";
  if (x.includes("котель")) return "boilers";
  if (x.includes("взу") || x.includes("скваж")) return "vzu";
  if (x.includes("внс")) return "vns";
  if (x.includes("ижс")) return "izhs";
  if (x.includes("снт")) return "snt";
  return null;
};

// Подсчёт СЗО по одной строке ТН (учитываем SocialObjects и *_ALL фолбэки)
const getRowSzoCounts = (row) => {
  const raw = row?.data?.data ?? row?.data ?? row ?? {};
  const socials = Array.isArray(raw.SocialObjects) ? raw.SocialObjects : [];
  const base = {
    boilers: 0,
    ctp: 0,
    hosp: 0,
    clinics: 0,
    schools: 0,
    kindergartens: 0,
    vzu: 0,
    vns: 0,
    mkd: 0,
    izhs: 0,
    snt: 0,
  };
  if (socials.length) {
    const seen = {
      mkd: new Set(),
      schools: new Set(),
      kindergartens: new Set(),
      hosp: new Set(),
      clinics: new Set(),
      boilers: new Set(),
      vzu: new Set(),
      vns: new Set(),
      izhs: new Set(),
      snt: new Set(),
    };
    socials.forEach((it) => {
      const key = classifySocialTyp(it?.SocialTyp);
      if (!key) return;
      const uniq =
        s(it?.FIAS).toLowerCase() || s(it?.Name) || Math.random().toString(36);
      if (seen[key].has(uniq)) return;
      seen[key].add(uniq);
      base[key] += 1;
    });
  } else {
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    base.boilers = num(raw.BOILER_ALL);
    base.ctp = num(raw.CTP_ALL);
    base.hosp = num(raw.HOSPITALS_ALL);
    base.clinics = num(raw.CLINICS_ALL);
    base.schools = num(raw.SCHOOLS_ALL ?? raw.SCHOOL_ALL);
    base.kindergartens = num(
      raw.KINDERGARTENS_ALL ?? raw.KINDERGARTEN_ALL ?? raw.KINDERGARDENS_ALL
    );
    base.vzu = num(raw.WELLS_ALL);
    base.vns = num(raw.VNS_ALL);
    base.mkd = num(raw.MKD_ALL);
    base.izhs = num(raw.PRIVATE_HOUSE_ALL);
    base.snt = num(raw.SNT_ALL);
  }
  return base;
};

/* ---------------- UI: компактный Chip ---------------- */
const Chip = React.memo(function Chip({ icon, title, value, color, compact }) {
  const v = Number(value || 0);
  const active = v > 0;
  const tone = active ? color : "#bfbfbf";
  const labelColor = "#6b778c";
  return (
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
            ? `${Math.round(6 * CARD_SCALE)}px ${Math.round(8 * CARD_SCALE)}px`
            : `${Math.round(8 * CARD_SCALE)}px ${Math.round(10 * CARD_SCALE)}px`,
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
        <span style={{ fontSize: compact ? 14 : 16, color: tone }}>{icon}</span>
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
  );
});

/* ---------------- компонент: только Блок 2 ---------------- */
export default function PotrebiteliSZO() {
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

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const esRef = useRef(null);

  const loadOpen = async () => {
    try {
      setLoading(true);
      const jwt = localStorage.getItem("jwt");
      if (!jwt) throw new Error("Нет JWT: авторизуйтесь");

      const qsOpen = [
        "pagination[page]=1",
        "pagination[pageSize]=500",
        "sort[0]=createDateTime:DESC",
        "filters[isActive][$eq]=true",
      ].join("&");

      const headers = { Authorization: `Bearer ${jwt}` };
      const respOpen = await axios.get(`${URL}/api/teh-narusheniyas?${qsOpen}`, {
        headers,
      });

      const listOpen = Array.isArray(respOpen?.data?.data)
        ? respOpen.data.data.map((x) =>
            x?.attributes ? { id: x.id, ...x.attributes } : x
          )
        : [];

      setRows(listOpen.filter(isOpenTN));
    } catch (e) {
      // молча, чтобы блок не шумел
      console.warn("[PotrebiteliSZO] load error:", e?.message || e);
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

  const szoTotals = useMemo(() => {
    const acc = {
      boilers: 0,
      ctp: 0,
      hosp: 0,
      clinics: 0,
      schools: 0,
      kindergartens: 0,
      vzu: 0,
      vns: 0,
      mkd: 0,
      izhs: 0,
      snt: 0,
    };
    rows.forEach((r) => {
      const z = getRowSzoCounts(r);
      Object.keys(acc).forEach((k) => (acc[k] += z[k] || 0));
    });
    return acc;
  }, [rows]);

  const items = [
    { key: "boilers", icon: <FireOutlined />, title: "Котельные", color: "#eb2f96" },
    { key: "ctp", icon: <DashboardOutlined />, title: "ЦТП", color: "#13c2c2" },
    { key: "hosp", icon: <MedicineBoxOutlined />, title: "Больницы", color: "#1890ff" },
    { key: "clinics", icon: <MedicineBoxOutlined />, title: "Поликлиники", color: "#722ed1" },
    { key: "vzu", icon: <ExperimentOutlined />, title: "ВЗУ", color: "#722ed1" },
    { key: "vns", icon: <BuildOutlined />, title: "ВНС", color: "#faad14" },
    { key: "schools", icon: <ReadOutlined />, title: "Школы", color: "#52c41a" },
    { key: "kindergartens", icon: <SmileOutlined />, title: "Д/С", color: "#fa541c" },
    { key: "mkd", icon: <ApartmentOutlined />, title: "МКД", color: "#fa541c" },
    { key: "izhs", icon: <BankOutlined />, title: "ИЖС", color: "#fa8c16" },
    { key: "snt", icon: <ShopOutlined />, title: "СНТ", color: "#52c41a" },
  ];

  return (
    <Card
      style={{ borderRadius: 20, marginBottom: 8 }}
      title={<div style={{ fontWeight: 700, color: "#1575bc" }}>Потребители и СЗО</div>}
      styles={{ body: { padding: compact ? 8 : 10 } }}
    >
      {loading ? (
        <Space style={{ width: "100%", justifyContent: "center", padding: 12 }}>
          <Spin />
        </Space>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 150 : 180}px, 1fr))`,
            gap: compact ? 10 : 12,
            alignItems: "stretch",
          }}
        >
          {items.map(({ key, icon, title, color }) => (
            <Tooltip
              key={key}
              placement="bottom"
              title={`${title}: ${Number(szoTotals[key] || 0).toLocaleString("ru-RU")}`}
              overlayStyle={{ maxWidth: 420 }}
            >
              <div>
                <Chip
                  icon={icon}
                  title={title}
                  value={szoTotals[key]}
                  color={color}
                  compact={compact}
                />
              </div>
            </Tooltip>
          ))}
        </div>
      )}
    </Card>
  );
}
