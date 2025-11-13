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

  const [overridePesCount, setOverridePesCount] = useState(null);
  const [overridePesPower, setOverridePesPower] = useState(null);
  const [overrideReqBrigades, setOverrideReqBrigades] = useState(null);
  const [overrideReqWorkers, setOverrideReqWorkers] = useState(null);
  const [overrideReqEquipment, setOverrideReqEquipment] = useState(null);
  const [overrideReqEPS, setOverrideReqEPS] = useState(null);
  useEffect(() => {
    setOverridePesCount(null);
    setOverridePesPower(null);
    setOverrideReqBrigades(null);
    setOverrideReqWorkers(null);
    setOverrideReqEquipment(null);
    setOverrideReqEPS(null);
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

  const pesCountEffective = useMemo(() => {
    if (overridePesCount != null) return String(overridePesCount);
    const top = tn?.data?.PES_COUNT ?? tn?.PES_COUNT;
    return top != null ? String(top) : "0";
  }, [overridePesCount, tn]);

  const pesPowerEffective = useMemo(() => {
    if (overridePesPower != null) return String(overridePesPower);
    const top = tn?.data?.PES_POWER ?? tn?.PES_POWER;
    return top != null ? String(top) : "0";
  }, [overridePesPower, tn]);

  const reqBrigadesEffective = useMemo(() => {
    if (overrideReqBrigades != null) return String(overrideReqBrigades);
    const top = tn?.data?.required_brigades ?? tn?.required_brigades;
    return top != null ? String(top) : "0";
  }, [overrideReqBrigades, tn]);

  const reqWorkersEffective = useMemo(() => {
    if (overrideReqWorkers != null) return String(overrideReqWorkers);
    const top = tn?.data?.required_workers ?? tn?.required_workers;
    return top != null ? String(top) : "0";
  }, [overrideReqWorkers, tn]);

  const reqEquipmentEffective = useMemo(() => {
    if (overrideReqEquipment != null) return String(overrideReqEquipment);
    const top = tn?.data?.required_equipment ?? tn?.required_equipment;
    return top != null ? String(top) : "0";
  }, [overrideReqEquipment, tn]);

  const reqEPSEffective = useMemo(() => {
    if (overrideReqEPS != null) return String(overrideReqEPS);
    const top =
      tn?.data?.required_emergency_power_supply ??
      tn?.required_emergency_power_supply;
    return top != null ? String(top) : "0";
  }, [overrideReqEPS, tn]);

  const tnEffective = useMemo(() => {
    if (!tn) return tn;
    return {
      ...tn,
      // дублируем верхние значения, чтобы SendBlock подхватил без повторного запроса
      description: descriptionEffective,
      PES_COUNT: pesCountEffective,
      PES_POWER: pesPowerEffective,
      required_brigades: reqBrigadesEffective,
      required_workers: reqWorkersEffective,
      required_equipment: reqEquipmentEffective,
      required_emergency_power_supply: reqEPSEffective,
      data: {
        ...(tn.data || {}),
        description: descriptionEffective,
        PES_COUNT: pesCountEffective,
        PES_POWER: pesPowerEffective,
        required_brigades: reqBrigadesEffective,
        required_workers: reqWorkersEffective,
        required_equipment: reqEquipmentEffective,
        required_emergency_power_supply: reqEPSEffective,
        data: mergedJsonData,
      },
    };
  }, [tn, mergedJsonData, descriptionEffective, pesCountEffective, pesPowerEffective, reqBrigadesEffective, reqWorkersEffective, reqEquipmentEffective, reqEPSEffective]);
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

  const handlerUpdatePesTop = async (field, value) => {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) {
      message.error("Нет JWT");
      return;
    }

    // нормализуем до цифр
    const safe = String(value ?? "").replace(/[^\d]/g, "");
    const payload = safe === "" ? "0" : safe;

    try {
      setSaving(true);
      if (field === "PES_COUNT") setOverridePesCount(payload);
      if (field === "PES_POWER") setOverridePesPower(payload);
      if (field === "required_brigades") setOverrideReqBrigades(payload);
      if (field === "required_workers") setOverrideReqWorkers(payload);
      if (field === "required_equipment") setOverrideReqEquipment(payload);
      if (field === "required_emergency_power_supply") setOverrideReqEPS(payload);

      await axios.put(
        `${URL}/api/teh-narusheniyas/${documentId}`,
        { data: { [field]: payload } },
        { headers: { Authorization: `Bearer ${jwt}` } }
      );

      await getTn(documentId);
      setOverridePesCount(null);
      setOverridePesPower(null);
      setOverrideReqBrigades(null);
      setOverrideReqWorkers(null);
      setOverrideReqEquipment(null);
      setOverrideReqEPS(null);
      message.success("Сохранено");
    } catch (e) {
      console.error("Ошибка сохранения ПЭС:", e);
      message.error("Не удалось сохранить");
      setOverridePesCount(null);
      setOverridePesPower(null);
      setOverrideReqBrigades(null);
      setOverrideReqWorkers(null);
      setOverrideReqEquipment(null);
      setOverrideReqEPS(null);
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
      {canEdit && (
        <SendBlock
          tn={tnEffective}
          documentId={documentId}
          refresh={() => getTn(documentId)}
        />
      )}

      {isLoadingTn ? (
        <Flex justify="center" style={{ padding: 24 }}>
          <Spin />
        </Flex>
      ) : (
        tn &&
        tn.data && (
          <>
            <>
              <Divider style={{ margin: "12px 0" }} />

              <Spin spinning={saving}>
                {/* === ПЭС: показываем только два целевых поля (верхний уровень) === */}
                <Descriptions
                  column={1}
                  labelStyle={{ width: 260 }}
                  items={[
                    {
                      key: "PES_COUNT",
                      label: "ПЭС (шт.)",
                      children: (
                        <EditableField
                          editable
                          canEdit={canEdit}
                          name="PES_COUNT"
                          value={pesCountEffective}
                          handlerUpdateTn={(_, v) => handlerUpdatePesTop("PES_COUNT", v)}
                          inputProps={{ style: { width: 160 } }}
                        />
                      ),
                    },
                    {
                      key: "PES_POWER",
                      label: "Мощность ПЭС (кВт)",
                      children: (
                        <EditableField
                          editable
                          canEdit={canEdit}
                          name="PES_POWER"
                          value={pesPowerEffective}
                          handlerUpdateTn={(_, v) => handlerUpdatePesTop("PES_POWER", v)}
                          inputProps={{ style: { width: 160 } }}
                        />
                      ),
                    },
                  ]}
                />

                <Descriptions
                  column={1}
                  labelStyle={{ width: 260 }}
                  style={{ marginTop: 12 }}
                  items={[
                    {
                      key: "required_brigades",
                      label: "Потребность: Бригады",
                      children: (
                        <EditableField
                          editable
                          canEdit={canEdit}
                          name="required_brigades"
                          value={reqBrigadesEffective}
                          handlerUpdateTn={(_, v) =>
                            handlerUpdatePesTop("required_brigades", v)
                          }
                          inputProps={{ style: { width: 160 } }}
                        />
                      ),
                    },
                    {
                      key: "required_workers",
                      label: "Потребность: Человек",
                      children: (
                        <EditableField
                          editable
                          canEdit={canEdit}
                          name="required_workers"
                          value={reqWorkersEffective}
                          handlerUpdateTn={(_, v) =>
                            handlerUpdatePesTop("required_workers", v)
                          }
                          inputProps={{ style: { width: 160 } }}
                        />
                      ),
                    },
                    {
                      key: "required_equipment",
                      label: "Потребность: Техника",
                      children: (
                        <EditableField
                          editable
                          canEdit={canEdit}
                          name="required_equipment"
                          value={reqEquipmentEffective}
                          handlerUpdateTn={(_, v) =>
                            handlerUpdatePesTop("required_equipment", v)
                          }
                          inputProps={{ style: { width: 160 } }}
                        />
                      ),
                    },
                    {
                      key: "required_emergency_power_supply",
                      label: "Потребность: Резервные источники",
                      children: (
                        <EditableField
                          editable
                          canEdit={canEdit}
                          name="required_emergency_power_supply"
                          value={reqEPSEffective}
                          handlerUpdateTn={(_, v) =>
                            handlerUpdatePesTop(
                              "required_emergency_power_supply",
                              v
                            )
                          }
                          inputProps={{ style: { width: 160 } }}
                        />
                      ),
                    },
                  ]}
                />

                {/* === Прочие поля из настроек (read-only) === */}
                {Array.isArray(fieldsSetting) && fieldsSetting.length > 0 && (
                  <Descriptions
                    column={1}
                    labelStyle={{ width: 260 }}
                    style={{ marginTop: 12 }}
                    items={fieldsSetting
                      .filter(
                        (it) =>
                          it.nameModus !== "REASON_OPER" &&
                          it.nameModus !== "PES_COUNT" &&
                          it.nameModus !== "PES_POWER" &&
                          it.nameModus !== "description" &&
                          it.nameModus !== "required_brigades" &&
                          it.nameModus !== "required_workers" &&
                          it.nameModus !== "required_equipment" &&
                          it.nameModus !== "required_emergency_power_supply"
                      )
                      .map((item) => ({
                        key: item.nameModus || item.label,
                        label: item.label,
                        children: (
                          <EditableField
                            editable={false}
                            canEdit={false}
                            name={item.nameModus}
                            value={mergedJsonData?.[item.nameModus]}
                          />
                        ),
                      }))}
                  />
                )}

                {/* === Поле "Описание" — верхнеуровневый `description` (широкое поле) === */}
                <Descriptions
                  column={1}
                  layout="vertical"
                  style={{ marginTop: 12 }}
                  items={[
                    {
                      key: "description",
                      label: "Описание",
                      labelStyle: { width: 260 },
                      contentStyle: {
                        display: "block",
                        width: "100%",
                        whiteSpace: "pre-wrap",
                      },
                      children: (
                        <EditableField
                          editable
                          canEdit={canEdit}
                          name="description"
                          value={descriptionEffective}
                          handlerUpdateTn={(_, v) => handlerUpdateDescription(v)}
                          templateBuilder={() =>
                            buildDescriptionTemplate(tn?.data?.data || {})
                          }
                          textAreaProps={{
                            autoSize: { minRows: 18, maxRows: 60 },
                            style: { width: "100%", minHeight: 320, lineHeight: 1.5 },
                          }}
                        />
                      ),
                    },
                  ]}
                />
              </Spin>

              <Divider style={{ margin: "12px 0" }} />
            </>
          </>
        )
      )}
    </Modal>
  );
}
