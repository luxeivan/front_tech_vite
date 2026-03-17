import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, Tooltip, Space, Spin } from "antd";
import {
  FireOutlined,
  DashboardOutlined,
  MedicineBoxOutlined,
  ExperimentOutlined,
  BuildOutlined,
  ToolOutlined,
  ReadOutlined,
  SmileOutlined,
  ApartmentOutlined,
  BankOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { URL, getRowSzoCounts, isOpenTN } from "../js/dashboardCommon"; // Общие хелперы dashboard.
const CARD_SCALE = 0.36;

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
      const respOpen = await axios.get(
        `${URL}/api/teh-narusheniyas?${qsOpen}`,
        {
          headers,
        }
      );

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
      kns: 0,
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
    hosp: {
      icon: <MedicineBoxOutlined />,
      title: "Больницы",
      color: "#1890ff",
    },
    clinics: {
      icon: <MedicineBoxOutlined />,
      title: "Поликлиники",
      color: "#722ed1",
    },
    vzu: { icon: <ExperimentOutlined />, title: "ВЗУ", color: "#722ed1" },
    vns: { icon: <BuildOutlined />, title: "ВНС", color: "#faad14" },
    kns: { icon: <ToolOutlined />, title: "КНС", color: "#13c2c2" },
    schools: { icon: <ReadOutlined />, title: "Школы", color: "#52c41a" },
    kindergartens: { icon: <SmileOutlined />, title: "Д/С", color: "#fa541c" },
    mkd: { icon: <ApartmentOutlined />, title: "МКД", color: "#fa541c" },
    izhs: { icon: <BankOutlined />, title: "ИЖС", color: "#fa8c16" },
    snt: { icon: <ShopOutlined />, title: "СНТ", color: "#52c41a" },
  };

  // Пары в нужном порядке: верхняя и нижняя строка по колонкам.
  const PAIRS = [
    ["boilers", "ctp"],
    ["hosp", "clinics"],
    ["vzu", "vns"],
    ["schools", "kindergartens"],
    ["mkd", "izhs"],
    ["kns", "snt"],
  ];

  return (
    <Card
      style={{ borderRadius: 20, marginBottom: 8 }}
      title={
        <div style={{ fontWeight: 700, color: "#1575bc" }}>
          Потребители и СЗО
        </div>
      }
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
            gridTemplateColumns: `repeat(auto-fit, minmax(${
              compact ? 112 : 128
            }px, max-content))`,
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
                    title={`${meta[k].title}: ${Number(
                      szoTotals[k] || 0
                    ).toLocaleString("ru-RU")}`}
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
