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

  const mergedJsonData = useMemo(() => {
    const base = tn?.data?.data ?? {};
    return { ...base, ...(overrideData || {}) };
  }, [tn?.data?.data, overrideData]);

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
            {/* {fieldsSetting?.length > 0 && (
              <>
                <Divider style={{ margin: "12px 0" }} />
                <Spin spinning={saving}>


                  <Descriptions
                    column={1}
                    labelStyle={{ width: 260 }}
                    items={fieldsSetting.map((item) => {
                      const isDescription = item.nameModus === "REASON_OPER";

                      return {
                        key: item.nameModus || item.label,
                        label: item.label,
                        children: (
                          <EditableField
                            editable={item.editable}
                            canEdit={canEdit}
                            name={item.nameModus}
                            value={mergedJsonData?.[item.nameModus]}
                            handlerUpdateTn={handlerUpdateTn}
                            templateBuilder={
                              isDescription
                                ? () =>
                                    buildDescriptionTemplate(
                                      tn?.data?.data || {}
                                    )
                                : undefined
                            }
                            textAreaProps={
                              isDescription
                                ? {
                                    autoSize: { minRows: 10, maxRows: 30 }, // 👈 выше и удобнее
                                    style: { width: "100%", lineHeight: 1.5 },
                                    showCount: false,
                                  }
                                : undefined
                            }
                          />
                        ),
                      };
                    })}
                  />
                </Spin>
              </>
            )}
            <Divider style={{ margin: "12px 0" }} /> */}

            {/* ...выше без изменений... */}

            {fieldsSetting?.length > 0 && (
              <>
                <Divider style={{ margin: "12px 0" }} />

                <Spin spinning={saving}>
                  {/*
        1) Обычные поля (всё, кроме REASON_OPER) — как раньше
      */}
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

                  {/*
        2) Поле "Описание" (REASON_OPER) — отдельным вертикальным блоком,
           лейбл сверху, textarea на всю ширину
      */}
                  {fieldsSetting.some(
                    (it) => it.nameModus === "REASON_OPER"
                  ) && (
                    <Descriptions
                      column={1}
                      layout="vertical"
                      style={{ marginTop: 12 }}
                      items={[
                        {
                          key: "REASON_OPER",
                          label:
                            fieldsSetting.find(
                              (it) => it.nameModus === "REASON_OPER"
                            )?.label || "Описание",
                          // ← вот это главное: ломаем inline-flex только тут
                          contentStyle: { display: "block", width: "100%" },
                          children: (
                            <EditableField
                              editable
                              canEdit={canEdit}
                              name="REASON_OPER"
                              value={mergedJsonData?.REASON_OPER}
                              handlerUpdateTn={handlerUpdateTn}
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
                  )}
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
