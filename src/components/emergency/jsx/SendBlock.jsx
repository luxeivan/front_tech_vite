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
import { buildEddsPayload, sendToEdds } from "../js/Edds";
import { buildEddsNewPayload, fetchEddsNewMappings, resolveAccidentLocation, sendToEddsNew } from "../js/EddsNew";
import {
  buildMosEnergoSbytPayload,
  sendToMes,
  testMesAuth,
} from "../js/MosEnergoSbyt";
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
  const [siteTgMaxNewSelected, setSiteTgMaxNewSelected] = useState(false);
  const [eddsNewMappings, setEddsNewMappings] = useState(null);
  const [sendResultsOpen, setSendResultsOpen] = useState(false);
  const [sendResults, setSendResults] = useState([]);
  const isUnplannedMode = mode === "unplanned";
  const canUseTestButtons = hasFeatureAccess(user?.view_role, "tnTestButtons");

  useEffect(() => {
    setEddsNewSelected(false);
    setMesTestSelected(false);
    setSiteTgMaxNewSelected(false);
  }, [documentId]);

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

  const makeResultEntry = ({ channel, action, request, response, ok, summary, tone, accidentLocation, equipmentType, district }) => ({
    key: `${channel}-${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    channel,
    action,
    request,
    response,
    ok: Boolean(ok),
    summary: summary || (ok ? "Операция выполнена" : "Получена ошибка"),
    tone: tone || (ok ? "success" : "error"),
    accidentLocation: accidentLocation || null,
    equipmentType: equipmentType || null,
    district: district || null,
  });

  const getResultTag = (item) => {
    if (item.tone === "info") return { color: "processing", text: "В работе" };
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
    setSiteTgMaxNewSelected(false);
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

  const runMesNewUpload = async () => {
    const request = {
      method: "POST",
      url: `${SERVICES_URL}/services/mes/upload`,
      body: mesPayload,
    };

    try {
      setMesTestLoading(true);
      const jwt = localStorage.getItem("jwt");
      console.groupCollapsed?.("[МосЭнергоСбыт new] отправка из аварийки");
      console.log("[МосЭнергоСбыт new] request:", request);
      const resp = await sendToMes(
        SERVICES_URL,
        mesPayload,
        jwt,
        buildAuditHeaders(user, "/")
      );
      console.log("[МосЭнергоСбыт new] response:", resp);
      const ok = Boolean(resp?.ok);

      logAuditEvent(
        {
          action: ok ? "send_mes_new_ok" : "send_mes_new_error",
          entity: "tn",
          entity_id: String(documentId || ""),
          details: {
            id_registry: resp?.id_registry || null,
            id_registry_ext: resp?.id_registry_ext || null,
            message: resp?.message || null,
            ok,
          },
        },
        user
      );

      showAlert(
        ok ? "success" : "error",
        ok
          ? "МосЭнергоСбыт new: отправлено"
          : `МосЭнергоСбыт new: ошибка - ${formatErrorDetails(resp) || "Ответ без сообщения"}`,
        ok ? 6000 : 12000
      );

      return makeResultEntry({
        channel: "МосЭнергоСбыт new",
        action: "send",
        request,
        response: resp,
        ok,
        summary: ok
          ? `Данные отправлены${resp?.id_registry ? `, id_registry=${resp.id_registry}` : ""}`
          : formatErrorDetails(resp) || "Ответ без сообщения",
      });
    } catch (e) {
      const response = e?.response?.data || {
        ok: false,
        message: e?.message || "Неизвестная ошибка",
        code: e?.code || null,
      };
      console.error("[МосЭнергоСбыт new] error:", response);
      logAuditEvent(
        {
          action: "send_mes_new_error",
          entity: "tn",
          entity_id: String(documentId || ""),
          details: {
            error: response?.message || e?.message || "unknown",
            code: response?.code || e?.code || null,
          },
        },
        user
      );
      showAlert(
        "error",
        `МосЭнергоСбыт new: ошибка - ${formatErrorDetails(response) || response?.message || "Ответ без сообщения"}`,
        12000
      );
      return makeResultEntry({
        channel: "МосЭнергоСбыт new",
        action: "send",
        request,
        response,
        ok: false,
        summary: formatErrorDetails(response) || response?.message || "Ответ без сообщения",
      });
    } finally {
      console.groupEnd?.();
      setMesTestLoading(false);
    }
  };

  const resolveEddsNewMappings = async (force = false) => {
    if (!force && eddsNewMappings) return eddsNewMappings;
    const jwt = localStorage.getItem("jwt");
    const mappings = await fetchEddsNewMappings(
      SERVICES_URL,
      jwt,
      buildAuditHeaders(user, "/")
    );
    setEddsNewMappings(mappings || null);
    return mappings || null;
  };

  const runEddsNewTest = async () => {
    try {
      setEddsTestLoading(true);
      const mappings = await resolveEddsNewMappings(true);
      if (!mappings) {
        showAlert(
          "error",
          "ЕДДС new: не удалось получить маппинги из Strapi",
          10000
        );
        return makeResultEntry({
          channel: "ЕДДС new",
          action: "send",
          request: {},
          response: {
            message: "ЕДДС new: не удалось получить маппинги из Strapi",
            errors: ["Пустой ответ /services/integration-mappings/edds-new"],
            meta: {},
          },
          ok: false,
          summary: "Не удалось получить маппинги из Strapi",
        });
      }

      const jwt = localStorage.getItem("jwt");
      const obj = tn?.data || tn;
      const raw = obj?.data || {};
      const fiasIds = (raw.FIAS_LIST || "").split(/[;,]+/).map(s => s.trim()).filter(Boolean);
      const districtRules = Array.isArray(mappings?.district_fias) ? mappings.district_fias : [];
      const districtSource = raw.DISTRICT || raw.SCNAME || obj.district || obj.dispCenter || "";
      let districtFiasId = "";
      for (const rule of districtRules) {
        const src = districtSource.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        const rv = (rule.sourceValue || "").toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        if (src && rv && (rule.matchType === "contains" ? src.includes(rv) : src === rv)) {
          districtFiasId = rule.targetValue;
          break;
        }
      }
      const accidentLocation = await resolveAccidentLocation(fiasIds, districtFiasId, API_URL, jwt);

      const built = buildEddsNewPayload(tn, mappings, accidentLocation);
      const payload = built?.payload || null;
      const errors = Array.isArray(built?.errors) ? built.errors : [];
      const meta = built?.meta || {};

      if (!payload) {
        const summary = `ЕДДС new: не удалось сформировать JSON${
          errors.length ? ` — ${errors.join(" | ")}` : ""
        }`;
        showAlert("error", summary, 10000);
        logAuditEvent(
          {
            action: "edds_new_build_error",
            entity: "edds",
            entity_id: String(documentId || ""),
            details: { errors },
          },
          user
        );
        return makeResultEntry({
          channel: "ЕДДС new",
          action: "send",
          request: {},
          response: {
            message: "ЕДДС new: не удалось сформировать JSON",
            errors,
            meta,
          },
          ok: false,
          summary: errors[0] || "Ошибка валидации данных",
        });
      }

      const resp = await sendToEddsNew(SERVICES_URL, payload, jwt);
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
          (resp?.data?.claim_id
            ? `Данные приняты (ID: ${resp.data.claim_id})`
            : "Данные отправлены");

        showAlert("success", `ЕДДС new: ${okText}`);
        logAuditEvent(
          {
            action: "send_edds_ok",
            entity: "tn",
            entity_id: String(documentId || ""),
            details: { message: okText, version: "new" },
          },
          user
        );
      } else {
        const details =
          resp?.error || resp?.message || "Ответ без сообщения";
        showAlert("error", "ЕДДС new: ошибка - " + details);
        logAuditEvent(
          {
            action: "send_edds_error",
            entity: "tn",
            entity_id: String(documentId || ""),
            details: { error: details, version: "new" },
          },
          user
        );
      }

      return makeResultEntry({
        channel: "ЕДДС new",
        action: "send",
        request: payload,
        response: resp,
        ok,
        summary: ok
          ? resp?.message ||
            (resp?.data?.claim_id
              ? `Данные приняты (ID: ${resp.data.claim_id})`
              : "Данные отправлены")
          : resp?.error || "Ответ без сообщения",
        accidentLocation: accidentLocation || null,
        equipmentType: payload?.equipmentType || null,
        district: payload?.districtFiasIds?.[0] || null,
      });
    } catch (e) {
      const errors = [
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          e?.message ||
          "Неизвестная ошибка",
      ];
      showAlert("error", `ЕДДС new: ошибка — ${errors[0]}`, 10000);
      return makeResultEntry({
        channel: "ЕДДС new",
        action: "send",
        request: {},
        response: { ok: false, message: "ЕДДС new: ошибка отправки", errors },
        ok: false,
        summary: errors[0] || "Ошибка без деталей",
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
      const toSiteTgMaxNew = canUseTestButtons && isUnplannedMode && siteTgMaxNewSelected;
      const activeExtraChannels = extraChannels.filter(
        (channel) => extraSelected[channel.key]
      );

      if (
        !toEdds &&
        !toEddsNewTest &&
        !toMes &&
        !toMesTest &&
        !toSiteTgMaxNew &&
        activeExtraChannels.length === 0
      ) {
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
      if (toMesTest && !mesPayload) {
        showAlert("error", "МосЭнергоСбыт new: нет данных для отправки");
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
        results.push(await runMesNewUpload());
      }

      if (toSiteTgMaxNew) {
        const response = {
          message:
            "Канал Сайт/TG/MAX new подготовлен на интерфейсе. Маршруты отправки будут подключены следующим этапом.",
        };
        logAuditEvent(
          {
            action: "site_tg_max_new_prepare",
            entity: "send_block",
            entity_id: String(documentId || ""),
          },
          user
        );
        results.push(
          makeResultEntry({
            channel: "Сайт/TG/MAX new",
            action: "prepare",
            request: {
              method: "—",
              url: "—",
              body: null,
            },
            response,
            ok: false,
            tone: "info",
            summary: "Канал подготовлен, маршруты отправки будут подключены позже",
          })
        );
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
      (canUseTestButtons &&
        isUnplannedMode &&
        (eddsNewSelected || mesTestSelected || siteTgMaxNewSelected)));

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

          {isUnplannedMode && canUseTestButtons && (
            <Checkbox
              checked={siteTgMaxNewSelected}
              disabled={readOnly}
              onChange={(e) => setSiteTgMaxNewSelected(e.target.checked)}
            >
              Сайт/TG/MAX new
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
                        type={
                          item.tone === "info"
                            ? "info"
                            : item.ok
                              ? "success"
                              : "error"
                        }
                        showIcon
                        message={
                          item.tone === "info"
                            ? "Канал подготовлен"
                            : item.ok
                              ? "Отправка прошла успешно"
                              : "Есть ошибка при отправке"
                        }
                        description={item.summary}
                      />

                      {item.ok && item.accidentLocation && (
                        <div style={{ marginTop: 8 }}>
                          <Typography.Text strong>Координаты:</Typography.Text>
                          <div style={{ marginTop: 4 }}>
                            <Typography.Text>
                              {item.accidentLocation.latitude}, {item.accidentLocation.longitude}
                            </Typography.Text>
                          </div>
                          <a
                            href={`https://yandex.ru/maps/?ll=${item.accidentLocation.longitude},${item.accidentLocation.latitude}&z=16&pt=${item.accidentLocation.longitude},${item.accidentLocation.latitude},pm2rdm`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ marginTop: 4, display: "inline-block" }}
                          >
                            Открыть на Яндекс картах
                          </a>
                        </div>
                      )}

                      <div
                        style={{
                          background:
                            item.tone === "info"
                              ? "#f0f5ff"
                              : item.ok
                                ? "#f6ffed"
                                : "#fff2f0",
                          border:
                            item.tone === "info"
                              ? "1px solid #adc6ff"
                              : item.ok
                                ? "1px solid #b7eb8f"
                                : "1px solid #ffccc7",
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
