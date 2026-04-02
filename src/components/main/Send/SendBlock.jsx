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
  Tag,
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
  const [eddsTestLoading, setEddsTestLoading] = useState(false);
  const [eddsNewSelected, setEddsNewSelected] = useState(false);
  const [mesTestSelected, setMesTestSelected] = useState(false);
  const [sendResultsOpen, setSendResultsOpen] = useState(false);
  const [sendResults, setSendResults] = useState([]);
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

  const makeResultEntry = ({ channel, action, request, response, ok, summary }) => ({
    key: `${channel}-${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    channel,
    action,
    request,
    response,
    ok: Boolean(ok),
    summary: summary || (ok ? "Операция выполнена" : "Получена ошибка"),
  });

  const getResultTag = (item) => {
    if (item.ok) return { color: "success", text: "Успешно" };
    return { color: "error", text: "Ошибка" };
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

  useEffect(() => {
    setEddsNewSelected(false);
    setMesTestSelected(false);
  }, [documentId]);

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

  const runMesAuthTest = async () => {
    try {
      setMesTestLoading(true);
      const jwt = localStorage.getItem("jwt");
      const resp = await testMesAuth(SERVICES_URL, jwt, buildAuditHeaders(user, "/"));
      const ok = Boolean(resp?.ok);
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
      return makeResultEntry({
        channel: "МосЭнергоСбыт new",
        action: "test",
        request: {
          method: "GET",
          url: `${SERVICES_URL}/services/mes/auth-test`,
          body: null,
        },
        response: resp,
        ok,
        summary: ok
          ? "Сессионный токен получен"
          : formatErrorDetails(resp) || "Ошибка без деталей",
      });
    } catch (e) {
      const response = e?.response?.data || {
        ok: false,
        message: e?.message || "Неизвестная ошибка",
        code: e?.code || null,
      };
      return makeResultEntry({
        channel: "МосЭнергоСбыт new",
        action: "test",
        request: {
          method: "GET",
          url: `${SERVICES_URL}/services/mes/auth-test`,
          body: null,
        },
        response,
        ok: false,
        summary: formatErrorDetails(response) || "Ошибка без деталей",
      });
    } finally {
      setMesTestLoading(false);
    }
  };

  const runEddsNewTest = async () => {
    try {
      if (!eddsPayload) {
        return makeResultEntry({
          channel: "ЕДДС new",
          action: "test",
          request: {
            method: "POST",
            url: `${SERVICES_URL}/services/edds/?debug=1`,
            body: null,
          },
          response: { message: "ЕДДС new Тест: нет данных для отправки" },
          ok: false,
          summary: "Нет данных для отправки",
        });
      }

      setEddsTestLoading(true);
      const jwt = localStorage.getItem("jwt");
      const resp = await testEddsSend(
        SERVICES_URL,
        eddsPayload,
        jwt,
        buildAuditHeaders(user, "/")
      );

      const request = {
        method: "POST",
        url: `${SERVICES_URL}/services/edds/?debug=1`,
        body: eddsPayload,
      };
      const response = normalizeEddsTestResponse(resp);
      logAuditEvent(
        {
          action: "edds_new_test",
          entity: "edds",
          entity_id: String(documentId || ""),
          details: { ok: true, debug: true },
        },
        user
      );
      return makeResultEntry({
        channel: "ЕДДС new",
        action: "test",
        request,
        response,
        ok:
          response?.success === true ||
          response?.ok === true ||
          Boolean(response?.data?.claim_id),
        summary:
          response?.message ||
          (response?.data?.claim_id
            ? `Данные приняты (ID: ${response.data.claim_id})`
            : "Ответ получен"),
      });
    } catch (e) {
      const request = {
        request: {
          method: "POST",
          url: `${SERVICES_URL}/services/edds/?debug=1`,
          body: eddsPayload,
        },
      };
      const response = normalizeEddsTestResponse(
        e?.response?.data || {
          ok: false,
          message: e?.message || "Неизвестная ошибка",
          code: e?.code || null,
        }
      );
      return makeResultEntry({
        channel: "ЕДДС new",
        action: "test",
        request: request.request,
        response,
        ok: false,
        summary: formatErrorDetails(response) || "Ошибка без деталей",
      });
    } finally {
      setEddsTestLoading(false);
    }
  };

  const handleSend = async () => {
    try {
      const toEdds = eddsSelected;
      const toEddsNewTest = canUseTestButtons && isUnplannedMode && eddsNewSelected;
      const toMes = mesSelected;
      const toMesTest = canUseTestButtons && isUnplannedMode && mesTestSelected;
      const activeExtraChannels = extraChannels.filter(
        (channel) => extraSelected[channel.key]
      );

      if (!toEdds && !toEddsNewTest && !toMes && !toMesTest && activeExtraChannels.length === 0) {
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
      if (toEddsNewTest && !eddsPayload) {
        showAlert("error", "ЕДДС new Тест: нет данных для отправки");
        return;
      }

      setSending(true);
      setNotice(null);
      const results = [];

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

        results.push(
          makeResultEntry({
            channel: "ЕДДС",
            action: "send",
            request: {
              method: "POST",
              url: `${SERVICES_URL}/services/edds/`,
              body: eddsPayload,
            },
            response: normalizeEddsTestResponse(resp),
            ok,
            summary: ok
              ? resp?.message ||
                (resp?.data?.claim_id
                  ? `Данные приняты (ID: ${resp.data.claim_id})`
                  : "Данные отправлены")
              : formatErrorDetails(resp) || "Ответ без сообщения",
          })
        );
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

        results.push(
          makeResultEntry({
            channel: "МосЭнергоСбыт",
            action: "send",
            request: {
              method: "POST",
              url: `${SERVICES_URL}/services/mes/upload`,
              body: mesPayload,
            },
            response: resp,
            ok: Boolean(resp?.ok),
            summary: resp?.ok
              ? resp?.message || "Данные отправлены"
              : formatErrorDetails(resp) || "Ответ без сообщения",
          })
        );
      }

      if (toEddsNewTest) {
        results.push(await runEddsNewTest());
      }

      if (toMesTest) {
        results.push(await runMesAuthTest());
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

        results.push(
          makeResultEntry({
            channel: extraLabels,
            action: "send",
            request: {
              method: "—",
              url: "—",
              body: null,
            },
            response: {
              message: "Боевая логика для этих каналов будет подключена следующим этапом.",
            },
            ok: false,
            summary: "Канал пока не подключён",
          })
        );
      }

      if (results.length > 0) {
        setSendResults(results);
        setSendResultsOpen(true);
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
  const canSend =
    !sending &&
    (eddsSelected ||
      mesSelected ||
      hasExtraSelected ||
      (canUseTestButtons && isUnplannedMode && (eddsNewSelected || mesTestSelected)));

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

          {isUnplannedMode && canUseTestButtons && (
            <Checkbox
              checked={eddsNewSelected}
              disabled={readOnly}
              onChange={(e) => setEddsNewSelected(e.target.checked)}
            >
              ЕДДС new
            </Checkbox>
          )}

          <Checkbox
            checked={mesSelected}
            disabled={readOnly}
            onChange={(e) => setMesSelected(e.target.checked)}
          >
            МосЭнергоСбыт
          </Checkbox>

          {isUnplannedMode && canUseTestButtons && (
            <Checkbox
              checked={mesTestSelected}
              disabled={readOnly}
              onChange={(e) => setMesTestSelected(e.target.checked)}
            >
              МосЭнергоСбыт new
            </Checkbox>
          )}

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

        {!readOnly && (
          <Flex
            vertical
            align="stretch"
            style={{ minWidth: 180, paddingTop: 4 }}
          >
            <Button
              type="primary"
              onClick={handleSend}
              disabled={!canSend}
              loading={sending || eddsTestLoading || mesTestLoading}
              block
            >
              Отправить
            </Button>
          </Flex>
        )}
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
        title="Результат отправки"
        placement="right"
        width={720}
        open={sendResultsOpen}
        onClose={() => setSendResultsOpen(false)}
      >
        {sendResults.length > 0 ? (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Flex gap={8} wrap>
              <Tag color="success">
                Успешно: {sendResults.filter((item) => item.ok).length}
              </Tag>
              <Tag color="error">
                Ошибок: {sendResults.filter((item) => !item.ok).length}
              </Tag>
              <Tag>
                Всего: {sendResults.length}
              </Tag>
            </Flex>

            <Collapse
              items={sendResults.map((item) => {
                const tag = getResultTag(item);
                return {
                  key: item.key,
                  label: (
                    <Flex align="center" gap={8} wrap>
                      <Tag color={tag.color}>{tag.text}</Tag>
                      <Typography.Text strong>{item.channel}</Typography.Text>
                      <Typography.Text type="secondary">
                        {item.summary}
                      </Typography.Text>
                    </Flex>
                  ),
                  children: (
                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                      <Alert
                        type={item.ok ? "success" : "error"}
                        showIcon
                        message={item.ok ? "Отправка прошла успешно" : "Есть ошибка при отправке"}
                        description={item.summary}
                      />

                      <div
                        style={{
                          background: item.ok ? "#f6ffed" : "#fff2f0",
                          border: item.ok ? "1px solid #b7eb8f" : "1px solid #ffccc7",
                          borderRadius: 8,
                          padding: 12,
                        }}
                      >
                        <Typography.Text strong>Ответ внешней системы</Typography.Text>
                        <pre
                          style={{
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            fontSize: 12,
                            lineHeight: 1.5,
                            margin: "8px 0 0",
                          }}
                        >
                          {JSON.stringify(item.response || {}, null, 2)}
                        </pre>
                      </div>

                      <Collapse
                        items={[
                          {
                            key: `${item.key}-request`,
                            label: "Показать / скрыть, что отправили",
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
                                {JSON.stringify(item.request || {}, null, 2)}
                              </pre>
                            ),
                          },
                        ]}
                      />
                    </Space>
                  ),
                };
              })}
            />
          </Space>
        ) : (
          <Typography.Text type="secondary">
            После отправки здесь появятся результаты по выбранным каналам.
          </Typography.Text>
        )}
      </Drawer>

    </div>
  );
}
