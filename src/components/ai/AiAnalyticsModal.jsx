import React from "react";
import {
  Modal,
  Button,
  Alert,
  Space,
  Descriptions,
  Table,
  Statistic,
  Row,
  Col,
  Card,
  message,
} from "antd";
import useAuth from "../../stores/useAuth";
import FancyLoader from "../ui/FancyLoader";
import CountUp from "../ui/CountUp";
import PeaksBars from "../ui/PeaksBars";
import ConfettiBurst from "../ui/ConfettiBurst";
import { animateRowsByGuids } from "../ui/highlightAnomalyRows";
import { computeMetrics, formatSummary, buildAiPrompt } from "../../ai/metrics";

export default function AiAnalyticsModal({ open, onClose, items = [], title }) {
  const { getJwt } = useAuth((s) => s);
  const [metrics, setMetrics] = React.useState(null);
  const [aiText, setAiText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [aiPhase, setAiPhase] = React.useState(null);
  const [phaseText, setPhaseText] = React.useState("Обращаемся к ИИ…");
  const [burstKey, setBurstKey] = React.useState(0);

  const tblWrapRef = React.useRef(null);

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const minDelay = async (p, ms) => {
    const [result] = await Promise.all([p, delay(ms)]);
    return result;
  };

  const nf2 = React.useMemo(
    () =>
      new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );
  const fmtH = (v) => (v == null ? "—" : `${nf2.format(v)} ч`);

  React.useEffect(() => {
    if (!open) return;
    const m = computeMetrics(items, { title: title || "Текущая выборка" });
    setMetrics(m);
    setAiText("");
  }, [open, items, title]);

  React.useEffect(() => {
    if (!aiText || !metrics?.outliers?.length) return;
    const guids = metrics.outliers.map((o) => o.guid);
    animateRowsByGuids(tblWrapRef.current, guids);
  }, [aiText, metrics]);

  React.useEffect(() => {
    console.log("[aiModal] открыли =", open);
  }, [open]);

  const callLLM = async (mode) => {
    if (!metrics) return;
    setLoading(true);
    setAiPhase("contact");
    setPhaseText("Обращаемся к ИИ…");
    const phaseTimer = setTimeout(
      () => setPhaseText("Ждём ответ от ИИ…"),
      1200
    );

    try {
      const base = import.meta.env.VITE_URL_BACKEND; // важно
      const url = `${base}/services/ai/analysis`;
      const jwt = getJwt?.();

      const forSend = {
        ...metrics,
        outliers: (metrics.outliers || []).map(
          ({
            guid,
            energoObject,
            duration_min,
            duration_h,
            dispCenter,
            status,
          }) => ({
            guid,
            energoObject,
            duration_min,
            duration_h,
            dispCenter,
            status,
          })
        ),
      };
      const hints = buildAiPrompt(mode, forSend);

      const req = fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({ metrics: forSend, mode, hints }),
      }).then(async (r) => {
        const data = await r.json().catch(() => ({}));
        return { ok: r.ok, data };
      });

      // красивый лоадер минимум 2.2с
      const { ok, data } = await minDelay(req, 2200);

      if (ok && data?.text) {
        setAiText(data.text);
        setBurstKey((k) => k + 1); // конфетти при успехе
      } else {
        setAiText(formatSummary(metrics));
        message.warning("ИИ недоступен — показано краткое локальное резюме.");
      }
    } catch {
      setAiText(formatSummary(metrics));
      message.warning("Ошибка AI-сервиса — показано локальное резюме.");
    } finally {
      clearTimeout(phaseTimer);
      setAiPhase(null);
      setLoading(false);
    }
  };

  const colsOutliers = [
    { title: "№", render: (_, __, i) => i + 1, width: 60 },
    { title: "GUID", dataIndex: "guid", key: "guid", ellipsis: true },
    { title: "Объект", dataIndex: "energoObject", key: "energoObject" },
    {
      title: "Дисп.",
      dataIndex: "dispCenter",
      key: "dispCenter",
      width: 160,
      ellipsis: true,
    },
    {
      title: "Длительность, ч",
      dataIndex: "duration_h",
      key: "duration_h",
      align: "right",
      width: 130,
      render: (v) => (v == null ? "—" : nf2.format(v)),
    },
  ];

  return (
    // <Modal open={open} onCancel={onClose} footer={null} width={900} centered>
    // AiAnalyticsModal.jsx
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      centered
      maskClosable={false}
      keyboard={false}
      destroyOnHidden={false}
      // closable
      afterOpenChange={(v) => console.log("[aiModal] afterOpenChange =", v)}
    >
      <div style={{ position: "relative" }}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message="AI-аналитика"
            description="Краткий обзор и рекомендации по данным на основе ИИ(deepseek/deepseek-chat)"
          />

          {metrics && (
            <>
              <Row gutter={12}>
                <Col span={6}>
                  <Statistic
                    title="Всего ТН (уник. GUID)"
                    value={metrics.unique_guids ?? metrics.total ?? 0}
                    valueRender={() => (
                      <CountUp
                        value={metrics.unique_guids ?? metrics.total ?? 0}
                      />
                    )}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Средняя длительность, ч"
                    value={metrics.durations.avg_h ?? 0}
                    valueRender={() => (
                      <CountUp
                        value={metrics.durations.avg_h ?? 0}
                        format={(n) => `${nf2.format(n)} ч`}
                      />
                    )}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Медиана, ч"
                    value={metrics.durations.median_h ?? 0}
                    valueRender={() => (
                      <CountUp
                        value={metrics.durations.median_h ?? 0}
                        format={(n) => `${nf2.format(n)} ч`}
                      />
                    )}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Аномалий, шт"
                    value={metrics.outliers.length}
                    valueRender={() => (
                      <CountUp value={metrics.outliers.length} />
                    )}
                  />
                </Col>
              </Row>

              <Descriptions
                bordered
                size="small"
                column={1}
                style={{ marginTop: 8 }}
              >
                <Descriptions.Item label="Топ-3 диспетчерских">
                  {metrics.topDispCenters
                    .map((x) => `${x.name} (${x.count})`)
                    .join(", ") || "—"}
                </Descriptions.Item>

                <Descriptions.Item label="Пиковые часы">
                  <PeaksBars data={metrics.peaksByHour} />
                </Descriptions.Item>

                <Descriptions.Item label="«Долгие 10%» (порог)">
                  {fmtH(metrics.durations.long10_h)}
                </Descriptions.Item>
                <Descriptions.Item label="Порог аномалий">
                  {fmtH(metrics.durations.threshold_anomaly_h)}
                </Descriptions.Item>
              </Descriptions>

              {metrics.outliers.length > 0 && (
                <div style={{ marginTop: 8 }} ref={tblWrapRef}>
                  <b>Аномально долгие ТН (топ-10)</b>
                  <Table
                    size="small"
                    rowKey={(r) => r.guid}
                    columns={colsOutliers}
                    dataSource={metrics.outliers}
                    pagination={false}
                    style={{ marginTop: 6 }}
                  />
                </div>
              )}

              <Row gutter={12} style={{ marginTop: 12 }}>
                <Col xs={24} md={10}>
                  <Card size="small" title="Без ИИ" bordered>
                    <Button
                      block
                      loading={loading}
                      onClick={() => setAiText(formatSummary(metrics))}
                    >
                      Короткое резюме
                    </Button>
                  </Card>
                </Col>

                <Col xs={24} md={14}>
                  <Card size="small" title="Анализ ИИ" bordered>
                    <Space wrap>
                      <Button
                        type="primary"
                        loading={loading}
                        onClick={() => callLLM("summary")}
                      >
                        Резюме
                      </Button>
                      <Button loading={loading} onClick={() => callLLM("recs")}>
                        Рекомендации
                      </Button>
                      <Button
                        loading={loading}
                        onClick={() => callLLM("anomalies")}
                      >
                        Аномалии
                      </Button>
                    </Space>
                  </Card>
                </Col>
              </Row>

              {aiText && (
                <>
                  {/* <ConfettiBurst key={burstKey} /> */}
                  <Alert
                    type="success"
                    showIcon
                    // message="Готовый текст"
                    description={
                      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                        {aiText}
                      </div>
                    }
                    style={{ marginTop: 12 }}
                  />
                </>
              )}
            </>
          )}
        </Space>

        {aiPhase && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,255,255,0.65)",
              backdropFilter: "blur(2px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <FancyLoader variant="orbit" color="#e37021" size={140} />
              <div style={{ marginTop: 12, fontWeight: 600 }}>{phaseText}</div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
