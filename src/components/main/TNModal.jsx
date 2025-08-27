import React, { useEffect } from "react";
import useData from "../../stores/useData";
import {
  Descriptions,
  Flex,
  Spin,
  Typography,
  Checkbox,
  Divider,
  message,
  Modal,
} from "antd";
import dayjs from "dayjs";
import useAuth from "../../stores/useAuth";
import EditableField from "./EditableField";

export default function TNModal({ open, onClose, documentId }) {
  const { tn, getTn, isLoadingTn, updateTn } = useData((store) => store);
  const { fieldsSetting } = useAuth((store) => store);

  useEffect(() => {
    if (documentId) getTn(documentId);
  }, [documentId]);

  // локальный помощник: берём актуальные значения из карточки и собираем JSON
  const buildEddsPayload = () => {
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
  };

  // единоразовая отметка отправки (обновляем только конкретное поле в Strapi)
  const markSent = async (fieldName) => {
    try {
      await updateTn(tn?.data?.documentId, { [fieldName]: true });
      // перезагрузим карточку, чтобы чекбокс стал disabled
      getTn(documentId);
    } catch (e) {
      message.error("Не удалось обновить карточку в Strapi");
      // eslint-disable-next-line no-console
      console.error(e);
    }
  };

  const handleSendEdds = async () => {
    if (tn?.data?.sendedEdds) return;
    const payload = buildEddsPayload();
    // eslint-disable-next-line no-console
    console.log("JSON для ЕДДС:\n" + JSON.stringify(payload, null, 2));
    message.success("ЕДДС: данные подготовлены (демо), смотри консоль.");
    await markSent("sendedEdds");
  };

  const handleSendMosEnergoSbit = async () => {
    if (tn?.data?.sendedMosEnergoSbit) return;
    // здесь можете собрать свой особый payload; пока — тот же, что и для ЕДДС
    const payload = buildEddsPayload();
    // eslint-disable-next-line no-console
    console.log(
      "JSON для МосЭнергоСбыта:\n" + JSON.stringify(payload, null, 2)
    );
    message.success(
      "МосЭнергоСбыт: данные подготовлены (демо), смотри консоль."
    );
    await markSent("sendedMosEnergoSbit");
  };

  return (
    <Modal
      title={"Технологическое нарушение"}
      open={open}
      onCancel={onClose}
      footer={false}
      destroyOnClose
    >
      {isLoadingTn && <Spin />}

      {!isLoadingTn && tn && tn.data && (
        <>
          <Flex vertical gap={20}>
            <Descriptions
              column={1}
              title={`Номер ${tn.data.number}`}
              items={[
                {
                  key: "obj",
                  label: "Объект",
                  children: tn.data.energoObject,
                },
                {
                  key: "dt",
                  label: "Дата/время возникновения",
                  children: dayjs(tn.data.createDateTime).format(
                    "DD.MM.YYYY HH:mm"
                  ),
                },
              ]}
            />

            {fieldsSetting && fieldsSetting.length > 0 && (
              <Descriptions
                column={1}
                items={fieldsSetting.map((item) => ({
                  key: item?.nameModus || item?.label,
                  label: item.label,
                  children: (
                    <EditableField
                      editable={item.editable}
                      name={item.nameModus}
                      value={tn?.data?.data?.[item.nameModus]}
                      handlerUpdateTn={(name, value) => {
                        // const newData = { ...(tn?.data?.data || {}) };
                        // newData[name] = value;
                        // updateTn(tn?.data?.documentId, { data: newData });
                        // getTn(documentId);

                        const newData = { ...(tn?.data?.data || {}) };
                        newData[name] = value;
                        updateTn(tn?.data?.documentId, newData).then(() => {
                          getTn(documentId);
                        });
                      }}
                    />
                  ),
                }))}
              />
            )}

            <Divider style={{ margin: "8px 0" }} />

            <div>
              <Typography.Text type="secondary">Отправка</Typography.Text>

              <Flex gap={16} align="center" style={{ marginTop: 8 }}>
                <Checkbox
                  checked={Boolean(tn?.data?.sendedEdds)}
                  disabled={Boolean(tn?.data?.sendedEdds)}
                  onChange={handleSendEdds}
                >
                  ЕДДС
                </Checkbox>

                <Checkbox
                  checked={Boolean(tn?.data?.sendedMosEnergoSbit)}
                  disabled={Boolean(tn?.data?.sendedMosEnergoSbit)}
                  onChange={handleSendMosEnergoSbit}
                >
                  МосЭнергоСбыт
                </Checkbox>
              </Flex>

              <Typography.Paragraph type="secondary" style={{ marginTop: 6 }}>
                Чекбокс можно нажать только один раз: после отправки он
                блокируется. Внимательно проверяйте данные перед отправкой
              </Typography.Paragraph>
            </div>
          </Flex>
        </>
      )}
    </Modal>
  );
}
