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

const { Title, Text } = Typography;
const URL = import.meta.env.VITE_URL_BACKEND;
const FIAS_COLLECTION = import.meta.env.VITE_STRAPI_FIAS_COLLECTION || "adress";

const MAP_SCALE = 0.42;

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

const districtName = (row) =>
  pick(row, "DISTRICT") || row?.dispCenter || row?.district || null;

const tnNumber = (row) => pick(row, "number") ?? row?.number ?? null;
const startDate = (row) =>
  pick(row, "createDateTime") ?? pick(row, "F81_060_EVENTDATETIME") ?? null;

const recoveryDate = (row) =>
  pick(row, "F81_290_RECOVERYDATETIME") ??
  pick(row, "F81_070_RESTOR_SUPPLAYDATETIME") ??
  null;

// ==== Рабочие "сутки" 08:00→08:00 (ключ дня на базе смещения -8 часов)
const dayKey0808 = (v) =>
  v ? dayjs(v).subtract(8, "hour").format("YYYY-MM-DD") : null;

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

  const ruDow = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

  // Опорные сутки 08→08: берём 7 последних ключей дней (сегодня включительно)
  const todayKey = dayKey0808(dayjs());
  const days7 = Array.from({ length: 7 }, (_, i) =>
    dayjs(todayKey).subtract(6 - i, "day")
  );

  // посуточные счётчики (по ключу 08→08)
  const daily = days7.map((d) => {
    const key = d.format("YYYY-MM-DD");
    const sameWorkday = (dt) => (dt ? dayKey0808(dt) === key : false);

    const createdDay = rows7d.filter((r) => sameWorkday(startDate(r)));

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

    const opened = createdDay.filter(
      (r) => isOpenTN(r) && !isDeletedRow(r)
    ).length;
    const closed = createdDay.filter((r) => isClosedRow(r)).length;
    const deleted = createdDay.filter((r) => isDeletedRow(r)).length;
    const total = opened + closed + deleted;

    return { label: ruDow[d.day()], opened, closed, deleted, total };
  });

  // мини-линейный график с подписями дней и подсказками
  const Sparkline7 = ({ points }) => {
    const w = 900,
      h = 120,
      padX = 24,
      padY = 22;
    const max = Math.max(1, ...points.map((p) => p.total));
    const step = points.length > 1 ? (w - 2 * padX) / (points.length - 1) : 0;

    const xy = points.map((p, i) => [
      padX + i * step,
      h - padY - (h - 2 * padY) * (p.total / max),
    ]);

    const poly = xy.map((p) => p.join(",")).join(" ");

    return (
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 140 }}>
        {/* линия */}
        <polyline points={poly} fill="none" stroke="#ff4d4f" strokeWidth="2" />
        {/* точки + значения + подписи дней */}
        {xy.map(([x, y], i) => {
          const p = points[i];
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="4" fill="#ff4d4f">
                <title>
                  {`${p.label.toUpperCase()}: всего ${p.total}
— открыто: ${p.opened}
— закрыто: ${p.closed}
— удалено: ${p.deleted}`}
                </title>
              </circle>
              <text
                x={x}
                y={y - 8}
                fontSize="12"
                textAnchor="middle"
                fill="#595959"
              >
                {p.total}
              </text>
              <text
                x={x}
                y={h - 8}
                fontSize="12"
                textAnchor="middle"
                fill="#8c8c8c"
              >
                {p.label}
              </text>
            </g>
          );
        })}
        {/* осевая линия снизу (визуально приятней) */}
        <line
          x1={padX}
          y1={h - padY}
          x2={w - padX}
          y2={h - padY}
          stroke="#f0f0f0"
        />
      </svg>
    );
  };

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

  // загрузка открытых ТН и всех ТН за 7 дней
  const loadOpen = async () => {
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

      const listOpen = Array.isArray(respOpen?.data?.data)
        ? respOpen.data.data.map((x) =>
            x?.attributes ? { id: x.id, ...x.attributes } : x
          )
        : [];

      const listAll7d = Array.isArray(respAll?.data?.data)
        ? respAll.data.data.map((x) =>
            x?.attributes ? { id: x.id, ...x.attributes } : x
          )
        : [];

      setRows(listOpen.filter(isOpenTN)); // текущие открытые (для СЗО и сил/средств)
      setRows7d(listAll7d); // все ТН за последние 7 дней (для графиков/доната)
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

  const s = (v) =>
    typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
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
          s(it?.FIAS).toLowerCase() ||
          s(it?.Name) ||
          Math.random().toString(36);
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

  // ===== Блок 5: Таблица СЗО по городским округам =====
  const SzoByDistrictTable = () => {
    if (!rows?.length) return null;

    const acc = new Map(); // district -> sums
    rows.forEach((r) => {
      const d = districtName(r) || "—";
      const z = getRowSzoCounts(r);
      if (!acc.has(d))
        acc.set(d, {
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
          telecom: 0, // заглушка, если появится
        });
      const dst = acc.get(d);
      Object.keys(dst).forEach((k) => {
        if (k === "telecom") return;
        dst[k] += Number(z[k] || 0);
      });
    });

    const rowsView = Array.from(acc.entries()).sort((a, b) =>
      String(a[0]).localeCompare(String(b[0]), "ru")
    );

    const th = {
      padding: "6px 8px",
      fontWeight: 700,
      fontSize: 12,
      background: "#fafafa",
      borderBottom: "1px solid #eee",
      whiteSpace: "nowrap",
      textAlign: "center",
    };
    const td = {
      padding: "6px 8px",
      fontSize: 12,
      textAlign: "center",
      borderBottom: "1px solid #f0f0f0",
    };

    return (
      <Card
        style={{ borderRadius: 20, marginTop: 8 }}
        title={
          <div style={{ fontWeight: 700, color: "#1575bc" }}>
            Информация об отключениях СЗО в разрезе городских округов
          </div>
        }
        styles={{ body: { padding: compact ? 6 : 10 } }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Городской округ</th>
                <th style={th}>Котельные</th>
                <th style={th}>ЦТП</th>
                <th style={th}>Больницы</th>
                <th style={th}>Поликлиники</th>
                <th style={th}>Школы</th>
                <th style={th}>Детские сады</th>
                <th style={th}>ВЗУ</th>
                <th style={th}>ВНС</th>
                <th style={th}>МКД</th>
                <th style={th}>ИЖС</th>
                <th style={th}>СНТ</th>
                <th style={th}>Объекты связи</th>
              </tr>
            </thead>
            <tbody>
              {rowsView.map(([d, v], i) => (
                <tr key={d} style={{ background: i % 2 ? "#fff" : "#fcfcfc" }}>
                  <td style={{ ...td, textAlign: "left" }}>{d}</td>
                  <td style={td}>{v.boilers || 0}</td>
                  <td style={td}>{v.ctp || 0}</td>
                  <td style={td}>{v.hosp || 0}</td>
                  <td style={td}>{v.clinics || 0}</td>
                  <td style={td}>{v.schools || 0}</td>
                  <td style={td}>{v.kindergartens || 0}</td>
                  <td style={td}>{v.vzu || 0}</td>
                  <td style={td}>{v.vns || 0}</td>
                  <td style={td}>{v.mkd || 0}</td>
                  <td style={td}>{v.izhs || 0}</td>
                  <td style={td}>{v.snt || 0}</td>
                  <td style={td}>{v.telecom || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };
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
                <InfoTN />
                {/* ===== Блок 2: Потребители и СЗО ===== */}
                <PotrebiteliSZO />
                {/* ===== Блок 3: Задействовано сил и средств Мособлэнерго ===== */}
                <PowerMosOblEnergo />
                /* ===== Блок 4: Динамика ТН за 7 дней ===== */
                <Card
                  style={{ borderRadius: 20, marginBottom: 8 }}
                  title={
                    <div style={{ fontWeight: 700, color: "#1575bc" }}>
                      Динамика ТН за 7 дней (все события)
                    </div>
                  }
                  styles={{ body: { padding: compact ? 6 : 10 } }}
                >
                  <Sparkline7 points={daily} />
                </Card>
                {/* ===== Блок 5: СЗО по округам ===== */}
                <SzoByDistrictTable />
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
            /* ===== Блок 6: Карта отключённых потребителей ===== */
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
          </div>
        </div>
      </div>
    </div>
  );
}
