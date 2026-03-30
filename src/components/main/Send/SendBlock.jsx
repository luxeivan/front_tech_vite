import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Checkbox, Divider, Drawer, Flex, Typography } from "antd";
import axios from "axios";
import { buildEddsPayload, sendToEdds } from "./Edds";
import {
  buildMosEnergoSbytPayload,
  sendToMes,
  testMesAuth,
} from "./MosEnergoSbyt";
import useAuth from "../../../stores/useAuth";
import { buildAuditHeaders, logAuditEvent } from "../../../utils/auditLogger";

const URL = import.meta.env.VITE_URL_BACKEND;

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

  const isUnplannedMode = mode === "unplanned";

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
      `${URL}/api/teh-narusheniyas/${documentId}`,
      { data: { ...flags } },
      { headers: { Authorization: `Bearer ${jwt}` } }
    );
  };

  const handleTestMesAuth = async () => {
    try {
      setMesTestLoading(true);
      setMesTestOpen(true);
      const jwt = localStorage.getItem("jwt");
      const resp = await testMesAuth(URL, jwt, buildAuditHeaders(user, "/"));
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
          URL,
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
          URL,
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

      if (activeExtraChannels.length > 0) {
        const extraLabels = activeExtraChannels.map((channel) => channel.label).join(", ");
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

      <Flex gap={16} align="center" style={{ marginTop: 8 }} wrap>
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

        {!readOnly && (
          <Button
            type="primary"
            onClick={handleSend}
            disabled={!canSend}
            loading={sending}
          >
            Отправить
          </Button>
        )}

        {!readOnly && isUnplannedMode && (
          <Button
            onClick={handleTestMesAuth}
            loading={mesTestLoading}
          >
            МосЭнергоСбыт Тест
          </Button>
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
        title="МосЭнергоСбыт Тест"
        placement="right"
        width={560}
        open={mesTestOpen}
        onClose={() => setMesTestOpen(false)}
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          Тестируем только получение session из СУВК через backend `/services/mes/auth-test`.
        </Typography.Paragraph>

        {mesTestResult ? (
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "#fafafa",
              border: "1px solid #f0f0f0",
              borderRadius: 8,
              padding: 12,
              fontSize: 12,
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {JSON.stringify(mesTestResult, null, 2)}
          </pre>
        ) : (
          <Typography.Text type="secondary">
            Нажми кнопку теста, и здесь появится ответ бэкенда.
          </Typography.Text>
        )}
      </Drawer>
    </div>
  );
}
