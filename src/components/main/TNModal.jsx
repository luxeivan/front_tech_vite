import React, { useEffect, useMemo, useState } from "react";
import { Descriptions, Divider, Flex, Modal, Spin, message } from "antd";
import axios from "axios";

import useData from "../../stores/useData";
import useAuth from "../../stores/useAuth";
import EditableField from "./EditableField";
import SendBlock from "./Send/SendBlock";
import { buildDescriptionTemplate } from "../../utils/descriptionTemplate";

const URL = import.meta.env.VITE_URL_BACKEND;

export default function TNModal({ open, documentId, onClose }) {
  const { tn, getTn, isLoadingTn } = useData((s) => s);
  // const { fieldsSetting } = useAuth((s) => s);
  const fieldsSetting = useAuth((s) => s.fieldsSetting);
  const user = useAuth((s) => s.user);
  const canEdit = user?.view_role === "standart";

  useEffect(() => {
    if (open && documentId) getTn(documentId);
  }, [open, documentId, getTn]);

  const [overrideData, setOverrideData] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setOverrideData(null);
  }, [documentId]);

  const [overrideDescription, setOverrideDescription] = useState(null);
  useEffect(() => {
    setOverrideDescription(null);
  }, [documentId]);

  const mergedJsonData = useMemo(() => {
    const base = tn?.data?.data ?? {};
    return { ...base, ...(overrideData || {}) };
  }, [tn?.data?.data, overrideData]);

  const descriptionEffective = useMemo(() => {
    if (overrideDescription != null) return overrideDescription;
    const fromApi = tn?.data?.description ?? null;
    return typeof fromApi === "string" ? fromApi : "";
  }, [overrideDescription, tn]);

  const tnEffective = useMemo(() => {
    if (!tn) return tn;
    return {
      ...tn,
      description: descriptionEffective,
      data: {
        ...(tn.data || {}),
        data: mergedJsonData,
      },
    };
  }, [tn, mergedJsonData, descriptionEffective]);
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
      await getTn(documentId);
      setOverrideData(null);

      message.success("Сохранено");
    } catch (e) {
      console.error("Ошибка сохранения поля:", e);
      message.error("Не удалось сохранить");
      setOverrideData(null);
      await getTn(documentId);
    } finally {
      setSaving(false);
    }
  };

  const handlerUpdateDescription = async (value) => {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) {
      message.error("Нет JWT");
      return;
    }

    try {
      setSaving(true);
      // мгновенно отражаем новое значение
      setOverrideDescription(value);

      const res = await axios.put(
        `${URL}/api/teh-narusheniyas/${documentId}`,
        { data: { description: value } },
        { headers: { Authorization: `Bearer ${jwt}` } }
      );

      const saved =
        res?.data?.data?.attributes?.description ??
        res?.data?.data?.description;
      if (typeof saved === "string") {
        setOverrideDescription(saved);
      }

      await getTn(documentId);
      setOverrideDescription(null);
      message.success("Описание сохранено");
    } catch (e) {
      console.error("Ошибка сохранения описания:", e);
      message.error("Не удалось сохранить описание");
      setOverrideDescription(null);
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
                    items={fieldsSetting
                      .filter((it) => it.nameModus !== "REASON_OPER")
                      .map((item) => ({
                        key: item.nameModus || item.label,
                        label: item.label,
                        children: (
                          <EditableField
                            editable={item.editable}
                            canEdit={canEdit}
                            name={item.nameModus}
                            value={mergedJsonData?.[item.nameModus]}
                            handlerUpdateTn={handlerUpdateTn}
                          />
                        ),
                      }))}
                  />

                  {/* 2) Поле "Описание" — теперь редактируем верхнеуровневый `description`, а не REASON_OPER */}
                  <Descriptions
                    column={1}
                    layout="vertical"
                    style={{ marginTop: 12 }}
                    items={[
                      {
                        key: "description",
                        label: "Описание",
                        contentStyle: { display: "block", width: "100%" },
                        children: (
                          <EditableField
                            editable
                            canEdit={canEdit}
                            name="description"
                            value={descriptionEffective}
                            handlerUpdateTn={(_, v) =>
                              handlerUpdateDescription(v)
                            }
                            templateBuilder={() =>
                              buildDescriptionTemplate(tn?.data?.data || {})
                            }
                            textAreaProps={{
                              autoSize: { minRows: 14, maxRows: 40 },
                              style: { width: "100%", lineHeight: 1.5 },
                            }}
                          />
                        ),
                      },
                    ]}
                  />
                </Spin>

                <Divider style={{ margin: "12px 0" }} />
              </>
            )}
          </>
        )
      )}
    </Modal>
  );
}
