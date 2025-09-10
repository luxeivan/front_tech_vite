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
  message,
  Spin,
} from "antd";
import useAuth from "../../stores/useAuth";
import { computeMetrics, formatSummary } from "../../ai/metrics";

export default function AiAnalyticsModal({ open, onClose, items = [], title }) {
  const { getJwt } = useAuth((s) => s);
  const [metrics, setMetrics] = React.useState(null);
  const [aiText, setAiText] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const [aiPhase, setAiPhase] = React.useState(null); // "contact" | "wait" | null
  const [phaseText, setPhaseText] = React.useState("Обращаемся к ИИ…");
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const minDelay = async (p, ms) => {
    const [result] = await Promise.all([p, delay(ms)]);
    return result;
  };

  React.useEffect(() => {
    if (!open) return;
    const m = computeMetrics(items, { title: title || "Текущая выборка" });
    setMetrics(m);
    setAiText(""); // сбрасываем
  }, [open, items, title]);

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
      const base = import.meta.env.VITE_URL_BACKEND; // как в SSE
      const url = `${base}/services/ai/analysis`;
      const jwt = getJwt?.();
      const forSend = {
        ...metrics,
        outliers: (metrics.outliers || []).map(
          ({ guid, energoObject, duration_min, dispCenter, status }) => ({
            guid,
            energoObject,
            duration_min,
            dispCenter,
            status,
          })
        ),
      };

      const req = fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({ metrics: forSend, mode }),
      }).then(async (r) => {
        const data = await r.json().catch(() => ({}));
        return { ok: r.ok, data };
      });

      // гарантируем красивый лоадер минимум 2.2с
      const { ok, data } = await minDelay(req, 2200);

      if (ok && data?.text) {
        setAiText(data.text);
      } else {
        setAiText(formatSummary(metrics));
        message.warning("LLM недоступен: показано локальное резюме.");
      }
    } catch (e) {
      setAiText(formatSummary(metrics));
      message.warning("Ошибка AI-сервиса: показано локальное резюме.");
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
      title: "Минуты",
      dataIndex: "duration_min",
      key: "duration_min",
      width: 100,
    },
  ];

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={900} centered>
      <div style={{ position: "relative" }}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message="AI-Аналитика (beta)"
            description="Локальные метрики считаются в браузере. Текст-резюме и рекомендации может сгенерировать LLM на сервере (безопасно, ключи не торчат в фронте)."
          />

          {metrics && (
            <>
              <Row gutter={12}>
                <Col span={6}>
                  <Statistic
                    title="Всего ТН (уник. GUID)"
                    value={metrics.unique_guids ?? metrics.total}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Средняя, мин"
                    value={metrics.durations.avg_min ?? 0}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="p90, мин"
                    value={metrics.durations.p90_min ?? 0}
                  />
                </Col>
                <Col span={6}>
                  <Statistic title="Аномалий" value={metrics.outliers.length} />
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
                <Descriptions.Item label="Пики по часам">
                  {metrics.peaksByHour
                    .map((x) => `${x.hour}:00 (${x.count})`)
                    .join(", ") || "—"}
                </Descriptions.Item>
              </Descriptions>

              {metrics.outliers.length > 0 && (
                <div style={{ marginTop: 8 }}>
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

              <Space style={{ marginTop: 12 }}>
                <Button
                  loading={loading}
                  onClick={() => setAiText(formatSummary(metrics))}
                >
                  Быстрое локальное резюме
                </Button>
                <Button
                  type="primary"
                  loading={loading}
                  onClick={() => callLLM("summary")}
                >
                  Запросить LLM-резюме
                </Button>
                <Button loading={loading} onClick={() => callLLM("recs")}>
                  Рекомендации
                </Button>
                <Button loading={loading} onClick={() => callLLM("anomalies")}>
                  Аномалии (текст)
                </Button>
              </Space>

              {aiText && (
                <Alert
                  type="success"
                  showIcon
                  message="AI-текст"
                  description={
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                      {aiText}
                    </div>
                  }
                  style={{ marginTop: 12 }}
                />
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
              <Spin size="large" />
              <div style={{ marginTop: 12, fontWeight: 600 }}>{phaseText}</div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
