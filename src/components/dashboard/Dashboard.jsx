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
import dayjs from "dayjs";
import axios from "axios";

const { Title, Text } = Typography;
const URL = import.meta.env.VITE_URL_BACKEND;

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
  pick(row, "documentId") ||
  pick(row, "VIOLATION_GUID_STR") ||
  row?.documentId ||
  row?.VIOLATION_GUID_STR ||
  null;

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

/* ---------------- component ---------------- */
export default function Dashboard() {
  const [now, setNow] = useState(dayjs().format("DD.MM.YYYY, HH:mm:ss"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [hovered, setHovered] = useState(null);
  const esRef = useRef(null);
  const navigate = useNavigate();

  // time ticker (раз в минуту)
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

      // Берём только открытые ТН. Серверная фильтрация по isActive=true.
      const qs = [
        "pagination[page]=1",
        "pagination[pageSize]=500",
        "sort[0]=createDateTime:DESC",
      ].join("&");
      const { data } = await axios.get(`${URL}/api/teh-narusheniyas?${qs}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      const list = Array.isArray(data?.data)
        ? data.data.map((x) => (x?.attributes ? { id: x.id, ...x.attributes } : x))
        : [];

      const openOnly = list.filter(isOpenTN);
      setRows(openOnly);
    } catch (e) {
      console.error("Дашборд: ошибка загрузки:", e);
      setError(e?.message || "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  // первичная загрузка
  useEffect(() => {
    loadOpen();
  }, []);

  // SSE автообновление как в TableTN: слушаем /services/event
  useEffect(() => {
    try {
      if (!URL) return;
      const es = new EventSource(`${URL}/services/event`);
      esRef.current = es;
      es.onmessage = () => {
        // короткая задержка — даём Strapi успеть записать событие
        setTimeout(loadOpen, 350);
      };
      es.onerror = (e) => {
        console.warn(
          "SSE /services/event: ошибка, переподключение через 5с",
          e
        );
        es.close();
        esRef.current = null;
        setTimeout(() => loadOpen(), 5000);
      };
      return () => {
        es.close();
        esRef.current = null;
      };
    } catch (e) {
      console.warn("SSE init error:", e);
    }
  }, []);

  // скопировать нумерованный список GUID'ов открытых ТН
  const handleCopyGuids = async () => {
    try {
      const guids = rows.map(guidOf).filter(Boolean);
      if (!guids.length) {
        message.warning("GUID не найдены");
        return;
      }
      const numbered = guids.map((g, i) => `${i + 1}. ${g}`).join("\n");
      await navigator.clipboard.writeText(numbered);
      message.success(`Скопировано GUID: ${guids.length}`);
    } catch (e) {
      console.error("Копирование GUID: ошибка:", e);
      message.error("Не удалось скопировать GUID");
    }
  };

  // подробности для карточек показателей
  // 1) "Населённых пунктов" — просто список уникальных названий
  // 2) "Население" (POPULATION_COUNT) — ТОП по убыванию
  // 3) Остальные метрики (ТП, ЛЭП, МКД и т.п.) — полный список по районам (не TOP)
  const renderMetricDetails = (m) => {
    try {
      if (!rows?.length) return "Нет данных";

      // Населённые пункты — только список
      if (String(m?.title || "").toLowerCase().includes("населён")) {
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

      // Население — ТОП по убыванию
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

      // Остальные метрики — полный список (не TOP)
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
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Список по районам</div>
          {list.map(([d, v], i) => (
            <div key={d}>
              {i + 1}. {d}: {Number(v).toLocaleString("ru-RU")}
            </div>
          ))}
        </div>
      );
    } catch (e) {
      return "Нет данных";
    }
  };

  // агрегаты
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
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <Row justify="end" style={{ marginBottom: 8 }}>
        <Col>
          <Button onClick={() => navigate("/")} icon={<HomeOutlined />}>
            На главную
          </Button>
        </Col>
      </Row>
      <Title
        level={2}
        style={{ textAlign: "center", color: "#1575bc", fontWeight: 700 }}
      >
        ТЕХНОЛОГИЧЕСКИЕ НАРУШЕНИЯ В ЭЛЕКТРИЧЕСКИХ СЕТЯХ АО «МОСОБЛЭНЕРГО»
      </Title>
      <Text
        style={{
          display: "block",
          textAlign: "center",
          fontWeight: 600,
          fontSize: 20,
          color: "#1575bc",
          marginBottom: 32,
        }}
      >
        По состоянию на {now}
      </Text>

      {loading && !error && (
        <Space
          style={{ width: "100%", justifyContent: "center", marginTop: 40 }}
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
          {/* big summary card */}
          <Row gutter={[24, 24]} justify="center">
            <Col xs={24} sm={24} md={12} lg={10} xl={8}>
              <Card
                variant="filled"
                style={{
                  borderRadius: 20,
                  background: "#e9f4ff",
                  textAlign: "center",
                }}
                styles={{ body: { padding: 36 } }}
              >
                <Statistic
                  title={
                    <Text strong style={{ fontSize: 20 }}>
                      Всего открытых ТН
                    </Text>
                  }
                  value={rows.length}
                  valueStyle={{
                    fontSize: 72,
                    color: "#1575bc",
                    fontWeight: 700,
                  }}
                />
                <Button
                  onClick={handleCopyGuids}
                  disabled={!rows?.length}
                  style={{ marginTop: 16, borderRadius: 12 }}
                >
                  Скопировать GUID
                </Button>
              </Card>
            </Col>
          </Row>

          {/* metrics grid */}
          <Row gutter={[24, 24]} justify="center" style={{ marginTop: 24 }}>
            {metrics.map(({ icon, title, value, color, field, custom }) => (
              <Col key={title} xs={24} sm={12} md={8} lg={6} xl={6}>
                <Tooltip
                  placement="bottom"
                  title={renderMetricDetails({ title, field, custom })}
                  overlayStyle={{ maxWidth: 460 }}
                >
                  <Card
                    hoverable
                    variant="outlined"
                    onMouseEnter={() => setHovered(title)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      borderRadius: 18,
                      height: "100%",
                      boxShadow: hovered === title ? "0 14px 24px rgba(0,0,0,0.12)" : "0 8px 18px rgba(0,0,0,0.06)",
                      transform: hovered === title ? "scale(1.03)" : "scale(1)",
                      transition: "transform .15s ease, box-shadow .15s ease",
                    }}
                    styles={{ body: { padding: 24 } }}
                  >
                    <Space
                      direction="vertical"
                      align="center"
                      style={{ width: "100%", textAlign: "center" }}
                    >
                      <span style={{ fontSize: 38, color }}>{icon}</span>
                      <Text style={{ fontSize: 14, color: "#8c8c8c" }}>{title}</Text>
                      <Text style={{ fontSize: 36, fontWeight: 600, color }}>
                        {Number(value || 0).toLocaleString("ru-RU")}
                      </Text>
                    </Space>
                  </Card>
                </Tooltip>
              </Col>
            ))}
          </Row>

          {/* resources */}
          <Card
            variant="outlined"
            style={{
              marginTop: 48,
              borderRadius: 20,
              boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
            }}
            styles={{ body: { padding: 36 } }}
          >
            <Title level={4} style={{ textAlign: "center", marginBottom: 24 }}>
              Задействовано сил и средств Мособлэнерго
            </Title>
            <Row gutter={[24, 24]} justify="center">
              {stats.map(({ icon, title, value, color }) => (
                <Col key={title} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    hoverable
                    variant="outlined"
                    style={{
                      borderRadius: 18,
                      height: "100%",
                      boxShadow: "0 8px 18px rgba(0,0,0,0.06)",
                    }}
                    styles={{ body: { padding: 24 } }}
                  >
                    <Space
                      direction="vertical"
                      align="center"
                      style={{ width: "100%", textAlign: "center" }}
                    >
                      <span style={{ fontSize: 38, color }}>{icon}</span>
                      <Text style={{ fontSize: 14, color: "#8c8c8c" }}>
                        {title}
                      </Text>
                      <Text style={{ fontSize: 36, fontWeight: 600, color }}>
                        {Number(value || 0).toLocaleString("ru-RU")}
                      </Text>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </>
      )}

      {/* initial skeleton */}
      {rows.length === 0 && loading && (
        <Skeleton active paragraph={{ rows: 4 }} style={{ marginTop: 24 }} />
      )}
    </div>
  );
}
