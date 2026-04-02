import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  Divider,
  Drawer,
  Flex,
  Space,
  Typography,
  message,
} from "antd";
import axios from "axios";
import { buildEddsPayload, sendToEdds, testEddsSend } from "./Edds";
import {
  buildMosEnergoSbytPayload,
  sendToMes,
  testMesAuth,
} from "./MosEnergoSbyt";
import useAuth from "../../../stores/useAuth";
import { buildAuditHeaders, logAuditEvent } from "../../../utils/auditLogger";
import { hasFeatureAccess } from "../../../config/viewRoleAccess";

const API_URL = String(import.meta.env.VITE_URL_BACKEND || "").trim().replace(/\/$/, "");
const SERVICES_URL = String(
  import.meta.env.VITE_URL_BACKEND_SERVICES || import.meta.env.VITE_URL_BACKEND || ""
)
  .trim()
  .replace(/\/$/, "");

export default function SendBlock({
  tn,
  documentId,
  refresh,
  extraChannels = [],
  extraChannelsHint = "",
  readOnly = false,
  mode = "unplanned",
}) {
  const user = useAuth((s) => s.user);
  const [sentEdds, setSentEdds] = useState(false);
  const [sentMes, setSentMes] = useState(false);
  const [eddsSelected, setEddsSelected] = useState(true);
  const [mesSelected, setMesSelected] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [extraSelected, setExtraSelected] = useState({});
  const [mesTestLoading, setMesTestLoading] = useState(false);
  const [mesTestOpen, setMesTestOpen] = useState(false);
  const [mesTestResult, setMesTestResult] = useState(null);
  const [eddsTestLoading, setEddsTestLoading] = useState(false);
  const [eddsTestOpen, setEddsTestOpen] = useState(false);
  const [eddsTestResult, setEddsTestResult] = useState(null);
  const isUnplannedMode = mode === "unplanned";
  const canUseTestButtons = hasFeatureAccess(user?.view_role, "tnTestButtons");

  const showAlert = (type, text, autoHideMs = 6000) => {
    setNotice({ type, text });
    if (autoHideMs) {
      window.clearTimeout(showAlert._t);
      showAlert._t = window.setTimeout(() => setNotice(null), autoHideMs);
    }
  };

  const stringifyAny = (v) => {
    if (v == null) return "";
    if (typeof v === "string") return v;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };

  const formatErrorDetails = (resp) => {
    const parts = [];
    const msg = resp?.message || resp?.error || resp?.err;
    if (msg) parts.push(String(msg));
    const data = resp?.data;
    if (data && typeof data === "object") {
      const kv = Object.entries(data).map(([k, v]) => {
        const val = Array.isArray(v) ? v.join("; ") : stringifyAny(v);
        return `${k}: ${val}`;
      });
      if (kv.length) parts.push(kv.join(" | "));
    }
    return parts.join(" - ");
  };

  const normalizeEddsTestResponse = (resp) => {
    if (!resp || typeof resp !== "object" || Array.isArray(resp)) return resp;

    const source = resp?.parsed && typeof resp.parsed === "object" ? resp.parsed : resp;
    const cleaned = { ...source };
    delete cleaned._via;
    delete cleaned.ok;
    delete cleaned.debug;
    delete cleaned.preview;
    return cleaned;
  };

  const buildMesTestCopyText = (payload) => {
    if (!payload) return "";

    const lines = [
      "МосЭнергоСбыт - тест авторизации",
      `ok: ${String(payload?.ok)}`,
      `message: ${payload?.message || "—"}`,
      `code: ${payload?.code || "—"}`,
      `auth_url: ${payload?.debug?.auth_url || "—"}`,
      `method: ${payload?.debug?.request?.method || "—"}`,
      `login: ${payload?.debug?.credentials?.login || "—"}`,
      `password: ${payload?.debug?.credentials?.password || "—"}`,
      `timeout_ms: ${payload?.debug?.timeout_ms ?? "—"}`,
      `duration_ms: ${payload?.debug?.duration_ms ?? "—"}`,
      `http_status: ${payload?.debug?.http_status ?? "—"}`,
      "",
      "Параметры запроса:",
      JSON.stringify(payload?.debug?.request?.query || {}, null, 2),
      "",
      "Ответ:",
      JSON.stringify(payload, null, 2),
    ];

    return lines.join("\n");
  };

  const handleCopyMesTest = async () => {
    try {
      await navigator.clipboard.writeText(buildMesTestCopyText(mesTestResult));
      message.success("Скопировал диагностику МосЭнергоСбыта в буфер");
    } catch (e) {
      message.error("Не получилось скопировать в буфер");
    }
  };

  useEffect(() => {
    const d = tn?.data;
    const eddsSent = Boolean(d?.sendedEdds);
    const mesSent = Boolean(d?.sendedMosEnergoSbit);
    setSentEdds(eddsSent);
    setSentMes(mesSent);
    setEddsSelected(eddsSent ? false : true);
    setMesSelected(mesSent ? false : true);
  }, [
    tn?.data?.sendedEdds,
    tn?.data?.sendedMosEnergoSbit,
    tn?.data,
    documentId,
  ]);

  useEffect(() => {
    const next = {};
    extraChannels.forEach((channel) => {
      next[channel.key] = Boolean(channel.checked);
    });
    setExtraSelected(next);
  }, [documentId, extraChannels]);

  const eddsPayload = useMemo(() => buildEddsPayload(tn), [tn?.data]);
  const mesPayload = useMemo(() => buildMosEnergoSbytPayload(tn), [tn?.data]);

  const patchFlags = async (flags) => {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) throw new Error("Нет JWT");
    return axios.put(
      `${API_URL}/api/teh-narusheniyas/${documentId}`,
      { data: { ...flags } },
      { headers: { Authorization: `Bearer ${jwt}` } }
    );
  };

  const handleTestMesAuth = async () => {
    try {
      setMesTestLoading(true);
      setMesTestOpen(true);
      const jwt = localStorage.getItem("jwt");
      const resp = await testMesAuth(SERVICES_URL, jwt, buildAuditHeaders(user, "/"));
      setMesTestResult(resp);
      if (resp?.ok) {
        showAlert("success", "МосЭнергоСбыт Тест: сессионный токен получен");
      } else {
        showAlert(
          "error",
          `МосЭнергоСбыт Тест: ${formatErrorDetails(resp) || "ошибка без деталей"}`
        );
      }
      logAuditEvent(
        {
          action: "mes_auth_test",
          entity: "mes",
          entity_id: String(documentId || ""),
          details: {
            ok: Boolean(resp?.ok),
            message: resp?.message || null,
            session: resp?.session || null,
          },
        },
        user
      );
    } catch (e) {
      const payload = e?.response?.data || {
        ok: false,
        message: e?.message || "Неизвестная ошибка",
        code: e?.code || null,
      };
      setMesTestResult(payload);
      setMesTestOpen(true);
      showAlert(
        "error",
        `МосЭнергоСбыт Тест: ${formatErrorDetails(payload) || "ошибка без деталей"}`
      );
      console.error("MES auth-test error:", e?.response?.data || e?.message || e);
    } finally {
      setMesTestLoading(false);
    }
  };

  const handleTestEddsNew = async () => {
    try {
      if (!eddsPayload) {
        showAlert("error", "ЕДДС new Тест: нет данных для отправки");
        return;
      }

      setEddsTestLoading(true);
      setEddsTestOpen(true);
      const jwt = localStorage.getItem("jwt");
      const resp = await testEddsSend(
        SERVICES_URL,
        eddsPayload,
        jwt,
        buildAuditHeaders(user, "/")
      );

      const payload = {
        request: {
          method: "POST",
          url: `${SERVICES_URL}/services/edds/?debug=1`,
          body: eddsPayload,
        },
        response: normalizeEddsTestResponse(resp),
      };

      setEddsTestResult(payload);
      showAlert("success", "ЕДДС new Тест: ответ от бэкенда получен");
      logAuditEvent(
        {
          action: "edds_new_test",
          entity: "edds",
          entity_id: String(documentId || ""),
          details: { ok: true, debug: true },
        },
        user
      );
    } catch (e) {
      const payload = {
        request: {
          method: "POST",
          url: `${SERVICES_URL}/services/edds/?debug=1`,
          body: eddsPayload,
        },
        response: normalizeEddsTestResponse(
          e?.response?.data || {
            ok: false,
            message: e?.message || "Неизвестная ошибка",
            code: e?.code || null,
          }
        ),
      };
      setEddsTestResult(payload);
      setEddsTestOpen(true);
      showAlert(
        "error",
        `ЕДДС new Тест: ${formatErrorDetails(payload.response) || "ошибка без деталей"}`
      );
      console.error("EDDS new test error:", e?.response?.data || e?.message || e);
    } finally {
      setEddsTestLoading(false);
    }
  };

  const handleSend = async () => {
    try {
      const toEdds = eddsSelected;
      const toMes = mesSelected;
      const activeExtraChannels = extraChannels.filter(
        (channel) => extraSelected[channel.key]
      );

      if (!toEdds && !toMes && activeExtraChannels.length === 0) {
        logAuditEvent({ action: "send_block_no_target", entity: "send_block", details: { documentId } }, user);
        showAlert("warning", "Выберите получателя перед отправкой");
        return;
      }
      if (toEdds && !eddsPayload) {
        showAlert("error", "ЕДДС: нет данных для отправки");
        return;
      }
      if (toMes && !mesPayload) {
        showAlert("error", "МосЭнергоСбыт: нет данных для отправки");
        return;
      }

      setSending(true);
      setNotice(null);

      if (toEdds) {
        const jwt = localStorage.getItem("jwt");
        const resp = await sendToEdds(
          SERVICES_URL,
          eddsPayload,
          jwt,
          buildAuditHeaders(user, "/")
        );
        const ok = resp?.success === true || resp?.ok === true;
        if (ok) {
          try {
            await patchFlags({ sendedEdds: true });
          } catch (e) {
            console.warn(
              "[flags] Не удалось обновить Strapi по sendedEdds (не критично):",
              e?.response?.data || e?.message
            );
          }

          setSentEdds(true);
          setEddsSelected(false);

          const okText =
            resp?.message ||
            (resp?.data?.claim_id ? `Данные приняты (ID: ${resp.data.claim_id})` : "отправлено");

          showAlert("success", `ЕДДС: ${okText}`);
          logAuditEvent(
            {
              action: "send_edds_ok",
              entity: "tn",
              entity_id: String(documentId || ""),
              details: { message: okText },
            },
            user
          );
        } else {
          const details = formatErrorDetails(resp) || "Ответ без сообщения";
          showAlert("error", "ЕДДС: ошибка - " + details);
          logAuditEvent(
            {
              action: "send_edds_error",
              entity: "tn",
              entity_id: String(documentId || ""),
              details: { error: details },
            },
            user
          );
        }
      }

      if (toMes) {
        const jwt = localStorage.getItem("jwt");
        const resp = await sendToMes(
          SERVICES_URL,
          mesPayload,
          jwt,
          buildAuditHeaders(user, "/")
        );
        if (resp?.ok === true) {
          await patchFlags({ sendedMosEnergoSbit: true });
          setSentMes(true);
          setMesSelected(false);
          showAlert("success", "МосЭнергоСбыт: отправлено");
          console.log("МосЭнергоСбыт ответ:", JSON.stringify(resp, null, 2));
          logAuditEvent(
            {
              action: "send_mes_ok",
              entity: "tn",
              entity_id: String(documentId || ""),
            },
            user
          );
        } else {
          const details = formatErrorDetails(resp) || "Ответ без сообщения";
          showAlert("error", "МосЭнергоСбыт: ошибка - " + details);
          logAuditEvent(
            {
              action: "send_mes_error",
              entity: "tn",
              entity_id: String(documentId || ""),
              details: { error: details },
            },
            user
          );
        }
      }

      const unsupportedExtraChannels = activeExtraChannels;

      if (unsupportedExtraChannels.length > 0) {
        const extraLabels = unsupportedExtraChannels
          .map((channel) => channel.label)
          .join(", ");
        showAlert(
          "info",
          `Каналы ${extraLabels} выбраны. Боевая логика для них будет подключена следующим этапом.`,
          8000
        );
      }

      await refresh?.();
    } catch (e) {
      console.error("Ошибка при отправке:", e);
      logAuditEvent(
        {
          action: "send_error",
          entity: "tn",
          entity_id: String(documentId || ""),
          details: { message: e?.message || "unknown" },
        },
        user
      );
      showAlert(
        "error",
        "Ошибка при отправке: " + (e?.message || "неизвестно")
      );
    } finally {
      setSending(false);
    }
  };

  const hasExtraSelected = extraChannels.some((channel) => extraSelected[channel.key]);
  const canSend = !sending && (eddsSelected || mesSelected || hasExtraSelected);

  return (
    <div>
      <Typography.Text type="secondary">Отправка</Typography.Text>

      {notice && (
        <Alert
          style={{ margin: "8px 0" }}
          showIcon
          closable
          type={notice.type}
          message={notice.text}
          onClose={() => setNotice(null)}
        />
      )}

      <Flex
        justify="space-between"
        align="flex-start"
        gap={16}
        style={{ marginTop: 8 }}
        wrap
      >
        <Flex
          vertical
          gap={10}
          align="flex-start"
          style={{ flex: 1, minWidth: 220 }}
        >
          <Checkbox
            checked={eddsSelected}
            disabled={readOnly}
            onChange={(e) => setEddsSelected(e.target.checked)}
          >
            ЕДДС
          </Checkbox>

          <Checkbox
            checked={mesSelected}
            disabled={readOnly}
            onChange={(e) => setMesSelected(e.target.checked)}
          >
            МосЭнергоСбыт
          </Checkbox>

          {extraChannels.map((channel) => (
            <Checkbox
              key={channel.key}
              checked={Boolean(extraSelected[channel.key])}
              disabled={readOnly || Boolean(channel.disabled)}
              onChange={(e) =>
                setExtraSelected((prev) => ({
                  ...prev,
                  [channel.key]: e.target.checked,
                }))
              }
            >
              {channel.label}
            </Checkbox>
          ))}
        </Flex>

        <Flex
          vertical
          gap={10}
          align="stretch"
          style={{ minWidth: 200 }}
        >
          {!readOnly && isUnplannedMode && canUseTestButtons && (
            <Button
              onClick={handleTestEddsNew}
              loading={eddsTestLoading}
              block
            >
              ЕДДС new Тест
            </Button>
          )}

          {!readOnly && isUnplannedMode && canUseTestButtons && (
            <Button
              onClick={handleTestMesAuth}
              loading={mesTestLoading}
              block
            >
              МосЭнергоСбыт Тест
            </Button>
          )}

          {!readOnly && (
            <Button
              type="primary"
              onClick={handleSend}
              disabled={!canSend}
              loading={sending}
              block
            >
              Отправить
            </Button>
          )}
        </Flex>
      </Flex>

      <Typography.Paragraph type="secondary" style={{ marginTop: 6 }}>
        {readOnly
          ? "Для плановых отключений ручная отправка временно скрыта. Каналы показаны как уже отмеченные для демонстрации."
          : "После успешной отправки чекбокс блокируется. Проверяйте данные перед отправкой."}
      </Typography.Paragraph>

      {extraChannelsHint ? (
        <Typography.Paragraph type="secondary" style={{ marginTop: -8, marginBottom: 0 }}>
          {extraChannelsHint}
        </Typography.Paragraph>
      ) : null}

      <Divider style={{ margin: "8px 0 0" }} />

      <Drawer
        title="ЕДДС new Тест"
        placement="right"
        width={640}
        open={eddsTestOpen}
        onClose={() => setEddsTestOpen(false)}
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          Тестируем текущий payload ЕДДС через backend `/services/edds?debug=1`.
        </Typography.Paragraph>

        {eddsTestResult ? (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <div
              style={{
                background: "#fafafa",
                border: "1px solid #f0f0f0",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <Typography.Text strong>Ответ от ЕДДС</Typography.Text>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: 12,
                  lineHeight: 1.5,
                  margin: "8px 0 0",
                }}
              >
                {JSON.stringify(eddsTestResult?.response || {}, null, 2)}
              </pre>
            </div>

            <Divider style={{ margin: 0 }}>Что отправляем</Divider>

            <Collapse
              items={[
                {
                  key: "edds-request-body",
                  label: "Показать / скрыть JSON, который отправляем",
                  children: (
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontSize: 12,
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      {JSON.stringify(eddsTestResult?.request?.body || {}, null, 2)}
                    </pre>
                  ),
                },
              ]}
            />
          </Space>
        ) : (
          <Typography.Text type="secondary">
            Нажми кнопку теста, и здесь появятся payload и ответ бэкенда.
          </Typography.Text>
        )}
      </Drawer>

      <Drawer
        title="МосЭнергоСбыт Тест"
        placement="right"
        width={640}
        open={mesTestOpen}
        onClose={() => setMesTestOpen(false)}
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          Тестируем только получение session из СУВК через backend `/services/mes/auth-test`.
        </Typography.Paragraph>

        {mesTestResult ? (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Flex justify="space-between" align="center" gap={12} wrap>
              <Typography.Text strong>
                Диагностика для отправки подрядчику
              </Typography.Text>
              <Button onClick={handleCopyMesTest}>
                Скопировать в буфер
              </Button>
            </Flex>

            <div
              style={{
                background: "#fafafa",
                border: "1px solid #f0f0f0",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <Typography.Paragraph style={{ marginBottom: 8 }}>
                <strong>Результат:</strong> {String(mesTestResult?.ok)}
              </Typography.Paragraph>
              <Typography.Paragraph style={{ marginBottom: 8 }}>
                <strong>Сообщение:</strong> {mesTestResult?.message || "—"}
              </Typography.Paragraph>
              <Typography.Paragraph style={{ marginBottom: 8 }}>
                <strong>Код ошибки:</strong> {mesTestResult?.code || "—"}
              </Typography.Paragraph>
              <Typography.Paragraph style={{ marginBottom: 8 }}>
                <strong>URL:</strong> {mesTestResult?.debug?.auth_url || "—"}
              </Typography.Paragraph>
              <Typography.Paragraph style={{ marginBottom: 8 }}>
                <strong>Метод:</strong> {mesTestResult?.debug?.request?.method || "—"}
              </Typography.Paragraph>
              <Typography.Paragraph style={{ marginBottom: 8 }}>
                <strong>Логин:</strong> {mesTestResult?.debug?.credentials?.login || "—"}
              </Typography.Paragraph>
              <Typography.Paragraph style={{ marginBottom: 8 }}>
                <strong>Пароль:</strong> {mesTestResult?.debug?.credentials?.password || "—"}
              </Typography.Paragraph>
              <Typography.Paragraph style={{ marginBottom: 8 }}>
                <strong>Ждали:</strong> {mesTestResult?.debug?.duration_ms ?? "—"} мс
              </Typography.Paragraph>
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                <strong>HTTP статус:</strong> {mesTestResult?.debug?.http_status ?? "—"}
              </Typography.Paragraph>
            </div>

            <div
              style={{
                background: "#fafafa",
                border: "1px solid #f0f0f0",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <Typography.Text strong>Параметры запроса</Typography.Text>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: 12,
                  lineHeight: 1.5,
                  margin: "8px 0 0",
                }}
              >
                {JSON.stringify(mesTestResult?.debug?.request?.query || {}, null, 2)}
              </pre>
            </div>

            <div
              style={{
                background: "#fafafa",
                border: "1px solid #f0f0f0",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <Typography.Text strong>Полный ответ бэкенда</Typography.Text>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: 12,
                  lineHeight: 1.5,
                  margin: "8px 0 0",
                }}
              >
                {JSON.stringify(mesTestResult, null, 2)}
              </pre>
            </div>
          </Space>
        ) : (
          <Typography.Text type="secondary">
            Нажми кнопку теста, и здесь появится ответ бэкенда.
          </Typography.Text>
        )}
      </Drawer>

    </div>
  );
}
