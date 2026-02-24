import React, { useEffect, useMemo, useRef, useState } from "react";
import { Typography, Row, Col, Card, Space, Spin, Skeleton, Button } from "antd";
import { HomeOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import axios from "axios";

import MapPanel from "../../components/dashboard/jsx/MapPanel"; // Карта отключений и ПЭС.
import InfoTN from "../../components/dashboard/jsx/InfoTN"; // Блок «Информация о ТН».
import PotrebiteliSZO from "../../components/dashboard/jsx/PotrebiteliSZO"; // Блок потребителей и СЗО.
import PowerMosOblEnergo from "../../components/dashboard/jsx/PowerMosOblEnergo"; // Блок сил и средств.
import Dinamica7Days from "../../components/dashboard/jsx/Dinamica"; // График динамики за 7 дней.
import RegionSZO from "../../components/dashboard/jsx/RegionSZO"; // СЗО по округам.
import {
  extractFiasFromRow,
  FIAS_COLLECTION,
  fetchDashboardRows,
  MAP_SCALE,
  tnNumber,
  URL,
} from "../../components/dashboard/js/dashboardPage.utils"; // Хелперы страницы дашборда.
import "../../components/dashboard/css/DashboardPage.css";

const { Title, Text } = Typography;

export default function DashboardPage() {
  const navigate = useNavigate();
  const headerRef = useRef(null);
  const [mapHeight, setMapHeight] = useState(420);

  // compact mode по размеру окна.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onResize = () => {
      const h = window.innerHeight;
      const w = window.innerWidth;
      setCompact(h < 900 || w < 1280);
      const headerH = headerRef.current ? headerRef.current.getBoundingClientRect().height : 0;
      const paddingY = 32;
      const base = Math.max(300, Math.floor(h - headerH - paddingY));
      const scaled = Math.max(200, Math.floor(base * MAP_SCALE));
      setMapHeight(scaled);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [now, setNow] = useState(dayjs().format("DD.MM.YYYY, HH:mm:ss"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [rows7d, setRows7d] = useState([]);
  const esRef = useRef(null);

  const fiasCodes = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => extractFiasFromRow(r)).filter(Boolean))),
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

  // Header ticker.
  useEffect(() => {
    const t = setInterval(() => setNow(dayjs().format("DD.MM.YYYY, HH:mm:ss")), 60_000);
    return () => clearInterval(t);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const jwt = localStorage.getItem("jwt");
      const data = await fetchDashboardRows({ axios, jwt });
      setRows(data.rows);
      setRows7d(data.rows7d);
    } catch (e) {
      setError(e?.message || "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // SSE автообновление.
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
    } catch {
      return undefined;
    }
  }, []);

  return (
    <div className="dashboard-page">
      <div ref={headerRef} className="dashboard-page__hero">
        <div className="dashboard-page__container">
          <Row align="middle" justify="start">
            <Col>
              <Button onClick={() => navigate("/")} icon={<HomeOutlined />}>
                На главную
              </Button>
            </Col>
          </Row>

          <div className="dashboard-page__title-wrap">
            <Title level={2} className="dashboard-page__title">
              ТЕХНОЛОГИЧЕСКИЕ НАРУШЕНИЯ В ЭЛЕКТРИЧЕСКИХ СЕТЯХ АО «МОСОБЛЭНЕРГО»
            </Title>
            <Text className="dashboard-page__now">По состоянию на {now}</Text>
          </div>
        </div>
      </div>

      <div className="dashboard-page__content">
        <div
          className="dashboard-page__grid"
          style={{
            gridTemplateColumns: compact
              ? "1fr"
              : "minmax(700px, 1.4fr) minmax(560px, 1.6fr)",
            gap: compact ? 10 : 14,
          }}
        >
          <div>
            {loading && !error && (
              <Space className="dashboard-page__loading">
                <Spin size="large" />
              </Space>
            )}
            {error && (
              <Title level={4} type="danger" className="dashboard-page__error">
                {error}
              </Title>
            )}

            {!loading && !error && (
              <>
                <InfoTN rows={rows} rows7d={rows7d} />
                <PotrebiteliSZO />
                <PowerMosOblEnergo />
                <RegionSZO />
              </>
            )}

            {rows.length === 0 && loading && (
              <Skeleton active paragraph={{ rows: 4 }} style={{ marginTop: 24 }} />
            )}
          </div>

          <div>
            <Card
              className="dashboard-page__map-card"
              styles={{ body: { padding: 0 } }}
              title={<div className="dashboard-page__map-title">Карта отключённых потребителей</div>}
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
            <div className="dashboard-page__dynamics">
              <Dinamica7Days />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
