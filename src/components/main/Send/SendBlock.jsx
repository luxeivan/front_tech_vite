import React, { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Divider, Flex, Typography, message } from "antd";
import dayjs from "dayjs";
import axios from "axios";

const URL = import.meta.env.VITE_URL_BACKEND;

export default function SendBlock({ tn, documentId, refresh }) {
  const [sentEdds, setSentEdds] = useState(false);
  const [sentMes, setSentMes] = useState(false);
  const [eddsSelected, setEddsSelected] = useState(false);
  const [mesSelected, setMesSelected] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const d = tn?.data;
    setSentEdds(Boolean(d?.sendedEdds));
    setSentMes(Boolean(d?.sendedMosEnergoSbit));
    if (d?.sendedEdds) setEddsSelected(false);
    if (d?.sendedMosEnergoSbit) setMesSelected(false);
  }, [tn?.data?.sendedEdds, tn?.data?.sendedMosEnergoSbit, tn?.data]);

  const payload = useMemo(() => {
    const obj = tn?.data;
    if (!obj) return null;
    const population =
      obj?.data?.POPULATION_COUNT ?? obj?.data?.population_count ?? null;
    return {
      Объект: obj.energoObject || null,
      "Дата/время возникновения": obj.createDateTime
        ? dayjs(obj.createDateTime).format("YYYY-MM-DD HH:mm")
        : null,
      "Количество отключенных потребителей": population,
    };
  }, [tn?.data]);

  const patchFlags = async (flags) => {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) throw new Error("Нет JWT");
    return axios.put(
      `${URL}/api/teh-narusheniyas/${documentId}`,
      { data: { ...flags } },
      { headers: { Authorization: `Bearer ${jwt}` } }
    );
  };

  const sendToEdds = async (data) => {
    const jwt = localStorage.getItem("jwt");
    const headers = jwt ? { Authorization: `Bearer ${jwt}` } : {};
    try {
      const res = await axios.post(`${URL}/services/edds/`, data, {
        headers,
        timeout: 30000,
      });
      return res?.data;
    } catch (e) {
      const apiMsg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Неизвестная ошибка";
      throw new Error(apiMsg);
    }
  };

  const handleSend = async () => {
    try {
      if (!payload) {
        message.error("Нет данных для отправки");
        return;
      }

      const toEdds = eddsSelected && !sentEdds;
      const toMes = mesSelected && !sentMes;

      if (!toEdds && !toMes) {
        message.warning("Выберите получателя перед отправкой");
        return;
      }

      setSending(true);

      if (toEdds) {
        const resp = await sendToEdds(payload);
        if (
          resp?.success === true ||
          resp?.ok === true ||
          resp?.raw ||
          resp?.data
        ) {
          await patchFlags({ sendedEdds: true });
          setSentEdds(true);
          setEddsSelected(false);
          message.success("ЕДДС: отправлено");
        } else {
          const details =
            resp?.message ||
            (resp?.data ? JSON.stringify(resp.data) : "Ответ без сообщения");
          message.error("ЕДДС: ошибка — " + details);
        }
      }

      if (toMes) {
        console.log(
          "Отправка в МосЭнергоСбыт:\n" + JSON.stringify(payload, null, 2)
        );
        await patchFlags({ sendedMosEnergoSbit: true });
        setSentMes(true);
        setMesSelected(false);
        message.success("МосЭнергоСбыт: помечено как отправлено");
      }

      await refresh?.();
    } catch (e) {
      console.error("Ошибка при отправке:", e);
      message.error("Ошибка при отправке: " + (e?.message || "неизвестно"));
    } finally {
      setSending(false);
    }
  };

  const canSend =
    !sending && ((eddsSelected && !sentEdds) || (mesSelected && !sentMes));

  return (
    <div>
      <Typography.Text type="secondary">Отправка</Typography.Text>

      <Flex gap={16} align="center" style={{ marginTop: 8 }} wrap>
        <Checkbox
          checked={sentEdds || eddsSelected}
          disabled={sentEdds || sending}
          onChange={(e) => {
            if (sentEdds) return;
            setEddsSelected(e.target.checked);
          }}
        >
          ЕДДС
        </Checkbox>

        <Checkbox
          checked={sentMes || mesSelected}
          disabled={sentMes || sending}
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

        {/* <Button onClick={handleTest} disabled={sending}>
          Тест JSON
        </Button> */}
      </Flex>

      <Typography.Paragraph type="secondary" style={{ marginTop: 6 }}>
        После успешной отправки чекбокс блокируется. Проверяйте данные перед
        отправкой.
      </Typography.Paragraph>

      <Divider style={{ margin: "8px 0 0" }} />
    </div>
  );
}
