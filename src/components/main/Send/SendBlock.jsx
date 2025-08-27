import React, { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Divider, Flex, Typography, message } from "antd";
import dayjs from "dayjs";
import axios from "axios";

const URL = import.meta.env.VITE_URL_BACKEND;

export default function SendBlock({ tn, documentId, refresh }) {
  // Флаги уже отправленных каналов из Strapi
  const [sentEdds, setSentEdds] = useState(false);
  const [sentMes, setSentMes] = useState(false);

  // Локальный выбор пользователя (что отправлять в этот раз)
  const [eddsSelected, setEddsSelected] = useState(false);
  const [mesSelected, setMesSelected] = useState(false);

  const [sending, setSending] = useState(false);

  // Синхронизируемся с записью, когда она обновилась
  useEffect(() => {
    const d = tn?.data;
    setSentEdds(Boolean(d?.sendedEdds));
    setSentMes(Boolean(d?.sendedMosEnergoSbit));
    // если пришло из бэка что уже отправлено — снимаем локальные выборы
    if (d?.sendedEdds) setEddsSelected(false);
    if (d?.sendedMosEnergoSbit) setMesSelected(false);
  }, [tn?.data?.sendedEdds, tn?.data?.sendedMosEnergoSbit, tn?.data]);

  // Готовим полезную нагрузку (только нужные поля)
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

  // Обновление только булевых флагов в Strapi (не трогаем большой JSON "data")
  const patchFlags = async (flags) => {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) throw new Error("Нет JWT");
    await axios.put(
      `${URL}/api/teh-narusheniyas/${documentId}`,
      { data: { ...flags } },
      { headers: { Authorization: `Bearer ${jwt}` } }
    );
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
        message.warning("Выберите получателя(ей) перед отправкой");
        return;
      }

      setSending(true);

      if (toEdds) {
        // Демонстрационная печать JSON
        console.log("JSON для ЕДДС:\n" + JSON.stringify(payload, null, 2));
      }
      if (toMes) {
        console.log(
          "JSON для МосЭнергоСбыта:\n" + JSON.stringify(payload, null, 2)
        );
      }

      // Пишем только нужные флаги. Большой JSON 'data' не трогаем.
      const flags = {};
      if (toEdds) flags.sendedEdds = true;
      if (toMes) flags.sendedMosEnergoSbit = true;

      await patchFlags(flags);

      // Мгновенно блокируем чекбоксы локально (без визуального дёрганья)
      if (toEdds) {
        setSentEdds(true);
        setEddsSelected(false);
        message.success("ЕДДС: отправлено");
      }
      if (toMes) {
        setSentMes(true);
        setMesSelected(false);
        message.success("МосЭнергоСбыт: отправлено");
      }

      // Обновляем запись в модалке из бэка (для консистентности)
      await refresh?.();
    } catch (e) {
      console.error(e);
      message.error("Ошибка при отправке");
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
      </Flex>

      <Typography.Paragraph type="secondary" style={{ marginTop: 6 }}>
        Чекбокс по каналу блокируется после успешной отправки. Внимательно
        проверяйте данные перед отправкой.
      </Typography.Paragraph>

      <Divider style={{ margin: "8px 0 0" }} />
    </div>
  );
}
