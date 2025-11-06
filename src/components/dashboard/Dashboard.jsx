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
} from "antd";
import { HomeOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import MapPanel from "./Map";
import dayjs from "dayjs";
import axios from "axios";

import InfoTN from "./InfoTN";
import PotrebiteliSZO from "./PotrebiteliSZO";
import PowerMosOblEnergo from "./PowerMosOblEnergo";
import Dinamica7Days from "./Dinamica";
import RegionSZO from "./RegionSZO";

const { Title, Text } = Typography;
const URL = import.meta.env.VITE_URL_BACKEND;
const FIAS_COLLECTION = import.meta.env.VITE_STRAPI_FIAS_COLLECTION || "adress";

const MAP_SCALE = 0.55; // increase map height relative to viewport

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

const tnNumber = (row) => pick(row, "number") ?? row?.number ?? null;
/* ---------------- компонент ---------------- */
export default function Dashboard() {
  const navigate = useNavigate();
  const headerRef = useRef(null);
  const [mapHeight, setMapHeight] = useState(420);
  const CARD_SCALE = 0.42; // делаем карточки заметно компактнее

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

  // агрегаты под макет
  const [now, setNow] = useState(dayjs().format("DD.MM.YYYY, HH:mm:ss"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [rows7d, setRows7d] = useState([]);
  const esRef = useRef(null);

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

  // единая загрузка: открытые ТН + все ТН за 7 дней
  const loadData = async () => {
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

      const mapIt = (x) => (x?.attributes ? { id: x.id, ...x.attributes } : x);
      const listOpen = Array.isArray(respOpen?.data?.data)
        ? respOpen.data.data.map(mapIt)
        : [];
      const listAll7d = Array.isArray(respAll?.data?.data)
        ? respAll.data.data.map(mapIt)
        : [];

      setRows(listOpen.filter(isOpenTN));
      setRows7d(listAll7d);
    } catch (e) {
      setError(e?.message || "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // SSE автообновление
  useEffect(() => {
    if (!URL) return;
    try {
      const es = new EventSource(`${URL}/services/event`);
      esRef.current = es;
      es.onmessage = () => setTimeout(loadData, 350);
      es.onerror = () => {
        es.close();
        esRef.current = null;
        setTimeout(loadData, 5000);
      };
      return () => {
        es.close();
        esRef.current = null;
      };
    } catch {}
  }, []);

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
            padding: "12px 16px",
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
                fontSize: "clamp(18px, 2vw, 26px)",
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
          padding: "12px 16px 20px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact
              ? "1fr"
              : "minmax(700px, 1.4fr) minmax(560px, 1.6fr)", // give more room to the map (right column)
            gap: compact ? 8 : 12,
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
                {/* ===== Блок 1: Информация о ТН ===== */}
                <InfoTN rows={rows} rows7d={rows7d} />
                {/* ===== Блок 2: Потребители и СЗО ===== */}
                <PotrebiteliSZO />
                {/* ===== Блок 3: Задействовано сил и средств Мособлэнерго ===== */}
                <PowerMosOblEnergo />
                {/* ===== Блок 5: СЗО по округам ===== */}
                <RegionSZO />
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
            {/* ===== Блок 6: Карта отключённых потребителей ===== */}
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
            <div style={{ marginTop: 12 }}>
              <Dinamica7Days />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
