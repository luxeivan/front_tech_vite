import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Checkbox, Divider, Flex, Typography } from "antd";
import axios from "axios";
import { buildEddsPayload, sendToEdds } from "./Edds";
import { buildMosEnergoSbytPayload, sendToMes } from "./MosEnergoSbyt";

const URL = import.meta.env.VITE_URL_BACKEND;

export default function SendBlock({ tn, documentId, refresh }) {
  const [sentEdds, setSentEdds] = useState(false);
  const [sentMes, setSentMes] = useState(false);
  const [eddsSelected, setEddsSelected] = useState(true);
  const [mesSelected, setMesSelected] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null); 

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
    return parts.join(" — ");
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

  const handleTestEdds = () => {
    try {
      if (!eddsPayload) {
        showAlert("warning", "Нет данных для теста ЕДДС");
        return;
      }
      console.log(
        "ЕДДС: тестовый JSON без отправки →\n" +
          JSON.stringify(eddsPayload, null, 2)
      );
      showAlert("success", "Тест ЕДДС: JSON выведен в консоль");
    } catch (e) {
      console.error("Тест ЕДДС: ошибка подготовки JSON:", e);
      showAlert("error", "Тест ЕДДС: ошибка подготовки JSON");
    }
  };

  const handleTestMes = () => {
    try {
      if (!mesPayload) {
        showAlert("warning", "Нет данных для теста МосЭнергоСбыта");
        return;
      }
      console.log(
        "МосЭнергоСбыт: тестовый JSON без отправки →\n" +
          JSON.stringify(mesPayload, null, 2)
      );
      showAlert("success", "Тест МосЭнергоСбыт: JSON выведен в консоль");
    } catch (e) {
      console.error("Тест МосЭнергоСбыт: ошибка подготовки JSON:", e);
      showAlert("error", "Тест МосЭнергоСбыт: ошибка подготовки JSON");
    }
  };

  const handleSend = async () => {
    try {
      const toEdds = eddsSelected && !sentEdds;
      const toMes = mesSelected && !sentMes;

      if (!toEdds && !toMes) {
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

      // === ЕДДС (без изменений глобальной логики) ===
      if (toEdds) {
        const jwt = localStorage.getItem("jwt");
        const resp = await sendToEdds(URL, eddsPayload, jwt);
        const ok = resp?.success === true || resp?.ok === true;
        if (ok) {
          await patchFlags({ sendedEdds: true });
          setSentEdds(true);
          setEddsSelected(false);
          showAlert("success", "ЕДДС: отправлено");
        } else {
          const details = formatErrorDetails(resp) || "Ответ без сообщения";
          showAlert("error", "ЕДДС: ошибка — " + details);
        }
      }

      if (toMes) {
        const jwt = localStorage.getItem("jwt"); // не обязателен
        const resp = await sendToMes(URL, mesPayload, jwt);
        if (resp?.ok === true) {
          await patchFlags({ sendedMosEnergoSbit: true });
          setSentMes(true);
          setMesSelected(false);
          showAlert("success", "МосЭнергоСбыт: отправлено");
          console.log("МосЭнергоСбыт ответ:", JSON.stringify(resp, null, 2));
        } else {
          const details = formatErrorDetails(resp) || "Ответ без сообщения";
          showAlert("error", "МосЭнергоСбыт: ошибка — " + details);
        }
      }

      await refresh?.();
    } catch (e) {
      console.error("Ошибка при отправке:", e);
      showAlert("error", "Ошибка при отправке: " + (e?.message || "неизвестно"));
    } finally {
      setSending(false);
    }
  };

  const canSend =
    !sending && ((eddsSelected && !sentEdds) || (mesSelected && !sentMes));

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
          checked={sentEdds || eddsSelected}
          // disabled={sentEdds || sending}
          onChange={(e) => {
            if (sentEdds) return;
            setEddsSelected(e.target.checked);
          }}
        >
          ЕДДС
        </Checkbox>

        <Checkbox
          checked={sentMes || mesSelected}
          // disabled={sentMes || sending}
          onChange={(e) => {
            if (sentMes) return;
            setMesSelected(e.target.checked);
          }}
        >
          МосЭнергоСбыт
        </Checkbox>

        <Button
          type="primary"
          onClick={handleSend}
          disabled={!canSend}
          loading={sending}
        >
          Отправить
        </Button>

        <Button onClick={handleTestEdds} disabled={sending || !eddsPayload}>
          Тест ЕДДС
        </Button>
        <Button onClick={handleTestMes} disabled={sending || !mesPayload}>
          Тест МосЭнергоСбыт
        </Button>
      </Flex>

      <Typography.Paragraph type="secondary" style={{ marginTop: 6 }}>
        После успешной отправки чекбокс блокируется. Проверяйте данные перед
        отправкой.
      </Typography.Paragraph>

      <Divider style={{ margin: "8px 0 0" }} />
    </div>
  );
}
