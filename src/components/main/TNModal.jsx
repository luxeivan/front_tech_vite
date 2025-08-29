// /src/components/main/TNModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Descriptions, Divider, Flex, Modal, Spin, message } from "antd";
import dayjs from "dayjs";
import axios from "axios";

import useData from "../../stores/useData";
import useAuth from "../../stores/useAuth";
import EditableField from "./EditableField";
import SendBlock from "./Send/SendBlock";

const URL = import.meta.env.VITE_URL_BACKEND;

export default function TNModal({ open, documentId, onClose }) {
  const { tn, getTn, isLoadingTn } = useData((s) => s);
  const { fieldsSetting } = useAuth((s) => s);

  useEffect(() => {
    if (open && documentId) getTn(documentId);
  }, [open, documentId, getTn]);

  // локальный слепок JSON-поля data (несохранённые правки)
  const [overrideData, setOverrideData] = useState(null);
  // флаг «идёт сохранение поля»
  const [saving, setSaving] = useState(false);

  // сбрасываем локальные правки при смене записи
  useEffect(() => {
    setOverrideData(null);
  }, [documentId]);

  // объединяем «что вернул сервер» + «локальные правки»
  const mergedJsonData = useMemo(() => {
    const base = tn?.data?.data ?? {};
    return { ...base, ...(overrideData || {}) };
  }, [tn?.data?.data, overrideData]);

  // «эффективная» карточка — её и отдадим в SendBlock,
  // чтобы payload всегда строился по актуальным данным
  const tnEffective = useMemo(() => {
    if (!tn) return tn;
    return {
      ...tn,
      data: {
        ...(tn.data || {}),
        data: mergedJsonData,
      },
    };
  }, [tn, mergedJsonData]);

  // Сохраняем строго JSON-поле data и мягко перезагружаем только карточку
  const handlerUpdateTn = async (name, value) => {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) {
      message.error("Нет JWT");
      return;
    }

    try {
      setSaving(true);

      const current = tn?.data?.data ?? {};
      const nextData = { ...current, [name]: value };

      // мгновенно отражаем новое значение, чтобы UI не моргал
      setOverrideData(nextData);

      // обновляем только json-поле `data`
      const res = await axios.put(
        `${URL}/api/teh-narusheniyas/${documentId}`,
        { data: { data: nextData } },
        { headers: { Authorization: `Bearer ${jwt}` } }
      );

      // подстраховка: берём то, что реально сохранил сервер
      const savedData = res?.data?.data?.attributes?.data;
      if (savedData && typeof savedData === "object") {
        setOverrideData(savedData);
      }

      // точечно обновляем карточку из БД (без закрытия модалки/перерисовки страницы)
      await getTn(documentId);

      // после прихода сервера локальный слепок уже не нужен
      setOverrideData(null);

      message.success("Сохранено");
    } catch (e) {
      console.error("Ошибка сохранения поля:", e);
      message.error("Не удалось сохранить");
      // откатим локальный снепшот и подтянем актуал
      setOverrideData(null);
      await getTn(documentId);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={"Технологическое нарушение"}
      open={open}
      onCancel={onClose}
      footer={false}
      destroyOnClose
    >
      {/* ВАЖНО: передаём tnEffective, чтобы JSON для ЕДДС был по текущим значениям */}
      <SendBlock
        tn={tnEffective}
        documentId={documentId}
        refresh={() => getTn(documentId)}
      />

      {isLoadingTn ? (
        <Flex justify="center" style={{ padding: 24 }}>
          <Spin />
        </Flex>
      ) : (
        tn &&
        tn.data && (
          <>
            {fieldsSetting?.length > 0 && (
              <>
                <Divider style={{ margin: "12px 0" }} />
                <Spin spinning={saving}>
                  <Descriptions
                    column={1}
                    labelStyle={{ width: 260 }}
                    items={fieldsSetting.map((item) => ({
                      key: item.nameModus || item.label,
                      label: item.label,
                      children: (
                        <EditableField
                          editable={item.editable}
                          name={item.nameModus}
                          value={mergedJsonData?.[item.nameModus]}
                          handlerUpdateTn={handlerUpdateTn}
                        />
                      ),
                    }))}
                  />
                </Spin>
              </>
            )}
            <Divider style={{ margin: "12px 0" }} />
          </>
        )
      )}
    </Modal>
  );
}
