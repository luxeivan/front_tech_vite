import React, { useEffect } from "react";
import { Descriptions, Divider, Flex, Modal, Spin, Typography } from "antd";
import dayjs from "dayjs";

import useData from "../../stores/useData";
import useAuth from "../../stores/useAuth";
import EditableField from "./EditableField";
import SendBlock from "./Send/SendBlock";

export default function TNModal({ open, documentId, onClose }) {
  const { tn, getTn, isLoadingTn, updateTn } = useData((s) => s);
  const { fieldsSetting } = useAuth((s) => s);

  // Подтягиваем карточку при открытии/смене id
  useEffect(() => {
    if (open && documentId) getTn(documentId);
  }, [open, documentId, getTn]);

  // Обновление одного поля из EditableField (редактируем только JSON "data")
  const handlerUpdateTn = async (name, value) => {
    const current = tn?.data?.data ?? {};
    const nextData = { ...current, [name]: value };
    await updateTn(documentId, { data: nextData }); // важно передать в корне data, чтобы не трогать другие поля
    await getTn(documentId);
  };

  return (
    <Modal
      title={"Технологическое нарушение"}
      open={open}
      onCancel={onClose}
      footer={false}
      destroyOnClose
    >
      {isLoadingTn && (
        <Flex justify="center" style={{ padding: 24 }}>
          <Spin />
        </Flex>
      )}

      {!isLoadingTn && tn && tn.data && (
        <>
          <Descriptions
            column={1}
            labelStyle={{ width: 260 }}
            title={
              <Typography.Title level={4} style={{ margin: 0 }}>
                Номер {tn.data.number}
              </Typography.Title>
            }
            items={[
              {
                key: "energo",
                label: "Объект",
                children: tn.data.energoObject || "—",
              },
              {
                key: "dt",
                label: "Дата/время возникновения",
                children: tn.data.createDateTime
                  ? dayjs(tn.data.createDateTime).format("DD.MM.YYYY HH:mm")
                  : "—",
              },
            ]}
          />

          {fieldsSetting && fieldsSetting.length > 0 && (
            <>
              <Divider style={{ margin: "12px 0" }} />
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
                      value={tn?.data?.data?.[item.nameModus]}
                      handlerUpdateTn={handlerUpdateTn}
                    />
                  ),
                }))}
              />
            </>
          )}

          <Divider style={{ margin: "12px 0" }} />

          {/* Блок отправки вынесен в отдельный компонент */}
          <SendBlock
            tn={tn}
            documentId={documentId}
            updateTn={updateTn} // на случай, если захочешь переиспользовать
            refresh={() => getTn(documentId)}
          />
        </>
      )}
    </Modal>
  );
}
