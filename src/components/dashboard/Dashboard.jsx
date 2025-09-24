import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Typography,
  Row,
  Col,
  Card,
  Statistic,
  Space,
  Spin,
  Skeleton,
  Button,
  message,
  Tooltip,
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

const FIAS_BATCH_SIZE = 100; // Strapi page size cap
const FIAS_CONCURRENCY = 4; // parallel requests (be gentle)
const MAP_MAX_POINTS = 50000; // safety limit for client-side rendering

// Try to extract an array of FIAS codes from different shapes of a row (strict)

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
    row?.data?.FIAS_LIST, // обычное место
    row?.FIAS_LIST, // на всякий случай
    row?.data?.data?.FIAS_LIST, // сверх-защита
  ];
  for (const src of candidates) {
    if (!src) continue;
    String(src)
      .split(/[;,]/) // FIAS разделены ; или ,
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => {
        if (isFiasGuid(t)) seen.add(t);
      });
  }
  return Array.from(seen);
};

// Chunk helper
const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

// Build Strapi $in filter for arrays using bracket notation (qs will encode properly)
const buildInParams = (field, values) => {
  const params = {};
  params[`filters[${field}][$in]`] = values; // qs encodes arrays as [0],[1],...
  return params;
};

// Safely extract lat/lon from various attribute shapes
const pickLatLon = (obj) => {
  if (!obj) return null;
  const a = obj.attributes ? obj.attributes : obj;
  const latRaw =
    a.lat ??
    a.latitude ??
    a.geo_lat ??
    a.geoLat ??
    (Array.isArray(a?.coords) ? a.coords[0] : undefined);
  const lonRaw =
    a.lon ??
    a.longitude ??
    a.geo_lon ??
    a.geoLon ??
    (Array.isArray(a?.coords) ? a.coords[1] : undefined);
  const lat = typeof latRaw === "number" ? latRaw : parseFloat(latRaw);
  const lon = typeof lonRaw === "number" ? lonRaw : parseFloat(lonRaw);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  return null;
};

// Encode params for Strapi (supports bracket-notation arrays like fields[0]=...)
const encodeStrapiQuery = (params) => {
  const parts = [];
  const push = (k, v) =>
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((v, i) => push(`${key}[${i}]`, v));
    } else {
      push(key, value);
    }
  }
  return parts.join("&");
};

/* ---------------- helpers ---------------- */
const toNumber = (v) => {
  const val = v != null && typeof v === "object" && "value" in v ? v.value : v;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

// попытаться достать поле из разных мест (атрибут, data, data.data)
const pick = (obj, key) =>
  obj?.[key] ?? obj?.data?.[key] ?? obj?.data?.data?.[key] ?? null;

// статус «открыта»/isActive
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

// попытаться достать GUID (documentId/VIOLATION_GUID_STR) из строки
const guidOf = (row) =>
  pick(row, "guid") ||
  pick(row, "VIOLATION_GUID_STR") ||
  row?.guid ||
  row?.VIOLATION_GUID_STR ||
  null;

// номер ТН и время начала (создания)
const tnNumber = (row) => pick(row, "number") ?? row?.number ?? null;
const startDate = (row) =>
  pick(row, "createDateTime") ?? pick(row, "F81_060_EVENTDATETIME") ?? null;
const formatDateTime = (v) =>
  v ? dayjs(v).format("DD.MM.YYYY HH:mm:ss") : "—";

/* ---------------- metric definitions ---------------- */
const metricDefs = [
  {
    icon: <ThunderboltOutlined />,
    title: "Отключено ТП",
    field: "TP_ALL",
    color: "#faad14",
  },
  {
    icon: <EnvironmentOutlined />,
    title: "Отключено ЛЭП 6-20 кВ",
    field: "LINESN_ALL",
    color: "#52c41a",
  },
  {
    icon: <HomeOutlined />,
    title: "Населённых пунктов",
    custom: (arr) =>
      new Set(arr.map((i) => districtName(i)).filter(Boolean)).size,
    color: "#1890ff",
  },
  {
    icon: <TeamOutlined />,
    title: "Население",
    field: "POPULATION_COUNT",
    color: "#722ed1",
  },
  {
    icon: <ApartmentOutlined />,
    title: "МКД",
    field: "MKD_ALL",
    color: "#fa541c",
  },
  {
    icon: <BankOutlined />,
    title: "Частные дома",
    field: "PRIVATE_HOUSE_ALL",
    color: "#fa8c16",
  },
  { icon: <ShopOutlined />, title: "СНТ", field: "SNT_ALL", color: "#52c41a" },
  {
    icon: <FireOutlined />,
    title: "Котельных",
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
    icon: <ExperimentOutlined />,
    title: "ВЗУ",
    field: "WELLS_ALL",
    color: "#722ed1",
  },
  { icon: <BuildOutlined />, title: "КНС", field: "KNS_ALL", color: "#faad14" },
  {
    icon: <MedicineBoxOutlined />,
    title: "Больниц",
    field: "HOSPITALS_ALL",
    color: "#1890ff",
  },
  {
    icon: <MedicineBoxOutlined />,
    title: "Поликлиник",
    field: "CLINICS_ALL",
    color: "#722ed1",
  },
  {
    icon: <ReadOutlined />,
    title: "Школ",
    field: "SCHOOLS_ALL",
    color: "#52c41a",
  },
  {
    icon: <SmileOutlined />,
    title: "Детских садов",
    field: "KINDERGARTENS_ALL",
    color: "#fa541c",
  },
];

const statDefs = [
  {
    icon: <TeamOutlined />,
    title: "Бригады",
    field: "BRIGADECOUNT",
    color: "#722ed1",
  },
  {
    icon: <UserOutlined />,
    title: "Люди",
    field: "EMPLOYEECOUNT",
    color: "#13c2c2",
  },
  {
    icon: <ToolOutlined />,
    title: "Техника",
    field: "SPECIALTECHNIQUECOUNT",
    color: "#eb2f96",
  },
  {
    icon: <ThunderboltOutlined />,
    title: "ПЭС",
    field: "PES_COUNT",
    color: "#faad14",
  },
];

/* ---------------- redesigned component ---------------- */
export default function Dashboard() {
  const navigate = useNavigate();
  const headerRef = useRef(null);
  const [mapHeight, setMapHeight] = useState(420);
  const MAP_SCALE = 0.6; // делаем карту чуть выше ( ~60% доступной высоты )
  const CARD_SCALE = 0.7; // уменьшаем высоту карточек ~на 30%

  // density / compact mode by window size (to always fit one screen)
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onResize = () => {
      const h = window.innerHeight;
      const w = window.innerWidth;
      setCompact(h < 900 || w < 1280);

      // вычисляем доступную высоту для карты исходя из высоты шапки
      const headerH = headerRef.current
        ? headerRef.current.getBoundingClientRect().height
        : 0;
      const paddingY = 32; // паддинги контейнера контента
      const base = Math.max(300, Math.floor(h - headerH - paddingY));
      const scaled = Math.max(200, Math.floor(base * MAP_SCALE));
      setMapHeight(scaled);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // small, modern “chip” (card height ~30% ниже)
  const Chip = ({ icon, title, value, color, tooltip }) => (
    <Tooltip
      placement="bottom"
      title={tooltip}
      overlayStyle={{ maxWidth: 560 }}
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
          <span style={{ fontSize: compact ? 18 : 22, color }}>{icon}</span>
          <div
            style={{
              lineHeight: 1.2,
              color: "#6b778c",
              fontSize: compact ? 11 : 12,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: compact ? 18 : 22, fontWeight: 800, color }}>
            {Number(value || 0).toLocaleString("ru-RU")}
          </div>
        </div>
      </Card>
    </Tooltip>
  );

  const [now, setNow] = useState(dayjs().format("DD.MM.YYYY, HH:mm:ss"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const esRef = useRef(null);

  const fiasCodes = useMemo(
    () =>
      Array.from(
        new Set(rows.flatMap((r) => extractFiasFromRow(r)).filter(Boolean))
      ),
    [rows]
  );

  const fiasCacheRef = useRef(new Map()); // fias -> {lat, lon}
  const abortRef = useRef(null);
  const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: 0 });

  // Points for the map (variant #2: clusterized markers). Fill later with real data.
  const [mapPoints, setMapPoints] = useState([]);
  // Derive FIAS codes from open TNs and resolve to coordinates via Strapi special collection
  useEffect(() => {
    // Cleanup previous run
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    // Gather unique FIAS codes from rows
    const allCodes = Array.from(
      new Set(rows.flatMap((r) => extractFiasFromRow(r)).filter(Boolean))
    );

    if (!allCodes.length) {
      setMapPoints([]);
      setLoadProgress({ loaded: 0, total: 0 });
      return;
    }

    // If too many, we will sample uniformly to keep UI responsive
    const limit = Math.max(1000, MAP_MAX_POINTS * 2); // fetch more than we render (cluster quality)
    const codes =
      allCodes.length > limit
        ? allCodes.filter(
            (_, i) => i % Math.ceil(allCodes.length / limit) === 0
          )
        : allCodes;

    const ac = new AbortController();
    abortRef.current = ac;

    // Prepare queues
    const cache = fiasCacheRef.current;
    const toResolve = codes.filter((c) => !cache.has(c));
    const resolvedFromCache = codes
      .filter((c) => cache.has(c))
      .map((c) => ({ fias: c, ...cache.get(c) }));

    // Set initial points from cache
    const initialPoints = resolvedFromCache.map(({ fias, lat, lon }) => ({
      id: fias,
      lat,
      lon,
    }));
    setMapPoints(initialPoints.slice(0, MAP_MAX_POINTS));
    setLoadProgress({ loaded: initialPoints.length, total: codes.length });

    const BASE = String(URL).replace(/\/$/, "");
    const MAX_URL_LEN = 1800;

    const buildQuery = (ids) =>
      encodeStrapiQuery({
        ...buildInParams("fiasId", ids),
        "pagination[page]": 1,
        "pagination[pageSize]": Math.min(ids.length, FIAS_BATCH_SIZE),
        fields: ["fiasId", "lat", "lon"],
      });
    const buildUrl = (ids) => `${BASE}/api/${FIAS_COLLECTION}?${buildQuery(ids)}`;

    let inner = Math.min(50, toResolve.length || 50);
    while (inner > 1 && buildUrl(toResolve.slice(0, inner)).length > MAX_URL_LEN) {
      inner = Math.max(1, Math.floor(inner * 0.7));
    }

    const batches = [];
    for (let i = 0; i < toResolve.length; i += inner) {
      batches.push(toResolve.slice(i, i + inner));
    }

    // Helper to load one batch
    const loadBatch = async (batch) => {
      if (!batch.length) return [];

      const urlStr = buildUrl(batch);
      const resp = await fetch(urlStr, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("jwt") || ""}`,
        },
        signal: ac.signal,
      });
      if (!resp.ok) throw new Error(`FIAS lookup failed: ${resp.status}`);
      const json = await resp.json();
      const arr = Array.isArray(json?.data) ? json.data : [];

      const results = [];
      for (const item of arr) {
        const a = item?.attributes ? item.attributes : item;
        const fias = a.fiasId || a.fias || a.FIAS || a.fias_code || a.FIAS_CODE;
        const ll = pickLatLon(a);
        if (fias && ll) {
          cache.set(fias, ll);
          results.push({ fias, ...ll });
        }
      }
      return results;
    };

    // Run with limited concurrency
    const batchesList = batches;
    let idx = 0;
    let active = 0;
    const collected = [...initialPoints];

    const next = () => {
      if (ac.signal.aborted) return;
      while (active < FIAS_CONCURRENCY && idx < batchesList.length) {
        const b = batchesList[idx++];
        active++;
        loadBatch(b)
          .then((res) => {
            if (ac.signal.aborted) return;
            res.forEach(({ fias, lat, lon }) =>
              collected.push({ id: fias, lat, lon })
            );
            setLoadProgress({
              loaded: Math.min(collected.length, codes.length),
              total: codes.length,
            });
            setMapPoints(collected.slice(0, MAP_MAX_POINTS));
          })
          .catch(() => {})
          .finally(() => {
            active--;
            if (idx < batchesList.length) next();
          });
      }
    };

    next();

    return () => {
      ac.abort();
    };
  }, [rows]);

  // header ticker
  useEffect(() => {
    const t = setInterval(
      () => setNow(dayjs().format("DD.MM.YYYY, HH:mm:ss")),
      60_000
    );
    return () => clearInterval(t);
  }, []);

  const loadOpen = async () => {
    try {
      setLoading(true);
      setError(null);
      const jwt = localStorage.getItem("jwt");
      if (!jwt) throw new Error("Нет JWT: авторизуйтесь");

      const qs = [
        "pagination[page]=1",
        "pagination[pageSize]=500",
        "sort[0]=createDateTime:DESC",
        "filters[isActive][$eq]=true",
      ].join("&");
      const { data } = await axios.get(`${URL}/api/teh-narusheniyas?${qs}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      const list = Array.isArray(data?.data)
        ? data.data.map((x) =>
            x?.attributes ? { id: x.id, ...x.attributes } : x
          )
        : [];
      setRows(list.filter(isOpenTN));
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

  // tooltips (details by district)
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

      if (m?.field === "POPULATION_COUNT") {
        const sums = new Map();
        rows.forEach((r) => {
          const d = districtName(r) || "—";
          const v = toNumber(pick(r, "POPULATION_COUNT"));
          if (!v) return;
          sums.set(d, (sums.get(d) || 0) + v);
        });
        const list = Array.from(sums.entries()).sort((a, b) => b[1] - a[1]);
        return (
          <div style={{ maxHeight: 260, overflow: "auto", paddingRight: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              ТОП по населению (по отключениям)
            </div>
            {list.length
              ? list.map(([d, v], i) => (
                  <div key={d}>
                    {i + 1}. {d}: {Number(v).toLocaleString("ru-RU")}
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
        const v = toNumber(pick(r, field));
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

  // aggregates
  const metrics = useMemo(() => {
    if (!rows.length) return [];
    return metricDefs.map((m) => ({
      ...m,
      value:
        typeof m.custom === "function"
          ? m.custom(rows)
          : rows.reduce((sum, it) => sum + toNumber(pick(it, m.field)), 0),
    }));
  }, [rows]);

  const stats = useMemo(() => {
    if (!rows.length) return [];
    return statDefs.map((s) => ({
      ...s,
      value: rows.reduce((sum, it) => sum + toNumber(pick(it, s.field)), 0),
    }));
  }, [rows]);

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
          {/* LEFT: cards & stats */}
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `minmax(${compact ? 260 : 300}px, ${
                      compact ? 320 : 360
                    }px) repeat(auto-fill, minmax(${
                      compact ? 190 : 220
                    }px, 1fr))`,
                    gridAutoFlow: "row dense",
                    gridAutoRows: "minmax(50px, auto)",
                    gap: compact ? 10 : 14,
                    alignItems: "stretch",
                  }}
                >
                  {/* main summary card */}
                  <Card
                    variant="filled"
                    style={{ borderRadius: 20, background: "#e9f4ff" }}
                    styles={{ body: { padding: compact ? 12 : 16 } }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "center",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <Text strong style={{ fontSize: compact ? 18 : 20 }}>
                        Всего открытых ТН:
                      </Text>
                      <span
                        style={{
                          fontSize: compact ? 40 : 50,
                          color: "#1575bc",
                          fontWeight: 900,
                          lineHeight: 1,
                        }}
                      >
                        {rows.length}
                      </span>
                    </div>
                    <Button
                      onClick={handleCopyGuids}
                      disabled={!rows?.length}
                      style={{ marginTop: 12, borderRadius: 12, width: "100%" }}
                    >
                      Скопировать GUID
                    </Button>

                    {/* <Button
                      onClick={handleCopyFias}
                      disabled={!rows?.length}
                      style={{ marginTop: 8, borderRadius: 12, width: "100%" }}
                    >
                      Скопировать все ФИАС
                    </Button> */}
                  </Card>

                  {/* metrics */}
                  {metrics.map(
                    ({ icon, title, value, color, field, custom }) => (
                      <Chip
                        key={title}
                        icon={icon}
                        title={title}
                        value={value}
                        color={color}
                        tooltip={renderMetricDetails({ title, field, custom })}
                      />
                    )
                  )}
                </div>
                {/* Задействовано сил и средств Мособлэнерго card */}
                <div style={{ marginTop: 12 }}>
                  <Card
                    style={{ borderRadius: 20 }}
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
                      {stats.map(({ icon, title, value, color }) => (
                        <Chip
                          key={title}
                          icon={icon}
                          title={title}
                          value={value}
                          color={color}
                        />
                      ))}
                    </div>
                  </Card>
                </div>
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
                  Карта отключений (подложка)
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
                />
                {loadProgress.total > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 8,
                      right: 12,
                      background: "rgba(255,255,255,0.85)",
                      padding: "4px 8px",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  >
                    Точек на карте:{" "}
                    {Math.min(
                      loadProgress.loaded,
                      MAP_MAX_POINTS
                    ).toLocaleString("ru-RU")}{" "}
                    из {loadProgress.total.toLocaleString("ru-RU")}
                    {loadProgress.loaded > MAP_MAX_POINTS && " (ограничено)"}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
