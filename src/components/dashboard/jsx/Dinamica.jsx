import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, Skeleton, Typography } from "antd";
import axios from "axios";

import Sparkline7 from "./Sparkline7"; // SVG-график 7-дневной динамики.
import { URL, isDashboardBaseType } from "../js/dashboardCommon"; // Базовый URL backend.
import {
  buildDailyStats,
  buildDays7,
  buildSince7dIso,
  mapStrapiRows,
} from "../js/dinamica.utils"; 

const { Text } = Typography;

export default function Dinamica7Days() {
  const [rows7d, setRows7d] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const esRef = useRef(null);

  const days7 = useMemo(() => buildDays7(), []);
  const daily = useMemo(() => buildDailyStats(rows7d, days7), [rows7d, days7]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const jwt = localStorage.getItem("jwt");
      if (!jwt) throw new Error("Нет JWT: авторизуйтесь");

      const since7d = buildSince7dIso();
      const headers = { Authorization: `Bearer ${jwt}` };

      let page = 1;
      const pageSize = 100;
      let all = [];

      while (true) {
        const qs = [
          `pagination[page]=${page}`,
          `pagination[pageSize]=${pageSize}`,
          "sort[0]=createDateTime:DESC",
          `filters[createDateTime][$gte]=${encodeURIComponent(since7d)}`,
          "filters[BASE_TYPE][$eq]=0",
        ].join("&");

        const resp = await axios.get(`${URL}/api/teh-narusheniyas?${qs}`, { headers });
        const chunk = mapStrapiRows(resp?.data);
        all.push(...chunk);

        if (chunk.length < pageSize) break;
        page += 1;
      }

      setRows7d(all.filter(isDashboardBaseType));
    } catch (e) {
      setError(e?.message || "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!URL) return;
    try {
      const es = new EventSource(`${URL}/services/event`);
      esRef.current = es;
      es.onmessage = () => setTimeout(load, 350);
      es.onerror = () => {
        es.close();
        esRef.current = null;
        setTimeout(load, 5000);
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
    <Card
      style={{ borderRadius: 20, marginBottom: 8 }}
      title={<div style={{ fontWeight: 700, color: "#1575bc" }}>Динамика ТН за 7 дней (все события)</div>}
      styles={{ body: { padding: 10 } }}
    >
      {loading && <Skeleton active paragraph={{ rows: 3 }} />}
      {!loading && !error && <Sparkline7 points={daily} />}
      {error && (
        <Text type="danger" style={{ display: "block" }}>
          {error}
        </Text>
      )}
    </Card>
  );
}
