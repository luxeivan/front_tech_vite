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
const CARD_SCALE = 0.36;

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
        width: "max-content",
        opacity: active ? 1 : 0.9,
        minWidth: 112,
      }}
      styles={{
        body: {
          padding: compact ? "3px 8px" : "5px 10px",
          whiteSpace: "nowrap",
        },
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${compact ? 18 : 20}px auto auto`,
          alignItems: "center",
          gap: compact ? 3 : 5,
          minHeight: compact ? 28 : 32,
        }}
      >
        <span style={{ fontSize: compact ? 12 : 14, color: tone }}>{icon}</span>
        <div
          style={{
            lineHeight: 1.1,
            color: labelColor,
            fontSize: compact ? 8.5 : 9.5,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: compact ? 12.5 : 15,
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
export default function PotrebiteliSZO({ rowsOpen, loadingExternal }) {
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

  // --- external data mode ---
  const useExternal = Array.isArray(rowsOpen);

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
      console.warn("[PotrebiteliSZO] load error:", e?.message || e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!useExternal) {
      loadOpen();
    }
  }, [useExternal]);

  // SSE автообновление
  useEffect(() => {
    if (useExternal || !URL) return;
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
  }, [useExternal]);

  // prefer external data if provided
  const effectiveRows = useExternal ? rowsOpen : rows;
  const effectiveLoading = useExternal ? !!loadingExternal : loading;

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
    effectiveRows.forEach((r) => {
      const z = getRowSzoCounts(r);
      Object.keys(acc).forEach((k) => (acc[k] += z[k] || 0));
    });
    return acc;
  }, [effectiveRows]);

  const meta = {
    boilers: { icon: <FireOutlined />, title: "Котельные", color: "#eb2f96" },
    ctp: { icon: <DashboardOutlined />, title: "ЦТП", color: "#13c2c2" },
    hosp: { icon: <MedicineBoxOutlined />, title: "Больницы", color: "#1890ff" },
    clinics: { icon: <MedicineBoxOutlined />, title: "Поликлиники", color: "#722ed1" },
    vzu: { icon: <ExperimentOutlined />, title: "ВЗУ", color: "#722ed1" },
    vns: { icon: <BuildOutlined />, title: "ВНС", color: "#faad14" },
    schools: { icon: <ReadOutlined />, title: "Школы", color: "#52c41a" },
    kindergartens: { icon: <SmileOutlined />, title: "Д/С", color: "#fa541c" },
    mkd: { icon: <ApartmentOutlined />, title: "МКД", color: "#fa541c" },
    izhs: { icon: <BankOutlined />, title: "ИЖС", color: "#fa8c16" },
    snt: { icon: <ShopOutlined />, title: "СНТ", color: "#52c41a" },
  };

  // Пары как в макете Миро: верх/низ в одной колонке
  const PAIRS = [
    ["boilers", "ctp"],
    ["hosp", "clinics"],
    ["vzu", "vns"],
    ["schools", "kindergartens"],
    ["mkd", "izhs"],
    ["snt", null],
  ];

  return (
    <Card
      style={{ borderRadius: 20, marginBottom: 8 }}
      title={<div style={{ fontWeight: 700, color: "#1575bc" }}>Потребители и СЗО</div>}
      styles={{ body: { padding: compact ? 6 : 8 } }}
    >
      {effectiveLoading ? (
        <Space style={{ width: "100%", justifyContent: "center", padding: 12 }}>
          <Spin />
        </Space>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fit, minmax(${compact ? 112 : 128}px, max-content))`,
            justifyContent: "start",
            columnGap: compact ? 8 : 10,
            rowGap: compact ? 6 : 8,
            alignItems: "start",
          }}
        >
          {PAIRS.map((pair, colIdx) => (
            <div
              key={colIdx}
              style={{
                display: "grid",
                gridTemplateRows: "auto auto",
                gap: compact ? 5 : 7,
                width: "max-content",
                marginBottom: 0,
              }}
            >
              {pair.map((k, i) =>
                k ? (
                  <Tooltip
                    key={k}
                    placement="bottom"
                    title={`${meta[k].title}: ${Number(szoTotals[k] || 0).toLocaleString("ru-RU")}`}
                    overlayStyle={{ maxWidth: 420 }}
                  >
                    <div>
                      <Chip
                        icon={meta[k].icon}
                        title={meta[k].title}
                        value={szoTotals[k]}
                        color={meta[k].color}
                        compact={compact}
                      />
                    </div>
                  </Tooltip>
                ) : (
                  <div key={`sp-${i}`} />
                )
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
