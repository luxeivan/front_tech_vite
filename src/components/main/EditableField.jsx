import { EditOutlined } from "@ant-design/icons";
import { Flex, Typography, Input, Button } from "antd";
import React, { useEffect, useState } from "react";
import styles from "./EditableField.module.css";

export default function EditableField({
  handlerUpdateTn,
  name,
  value,
  editable,
  canEdit = true,
  showTemplate = false,
}) {
  const safeValue = value ?? "";
  const [isEdit, setIsEdit] = useState(false);
  const [newValue, setNewValue] = useState(safeValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) setNewValue(value ?? "");
  }, [value, isEdit]);

  useEffect(() => {
    if (!canEdit && isEdit) setIsEdit(false);
  }, [canEdit, isEdit]);

  // Простая демо-заготовка (позже подменим на реальный генератор)
  const buildTemplateText = () =>
    [
      "Причина: ____________________.",
      "Место/оборудование: ____________________.",
      "Принятые меры: ____________________.",
      "Ориентировочное восстановление: ____________________.",
    ].join("\n");

  return (
    <Flex gap={10}>
      {isEdit ? (
        <Flex vertical gap={10}>
          <Input.TextArea
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            autoSize={{ minRows: 3, maxRows: 8 }}
          />

          <Flex gap={8} wrap>
            <Button
              type="primary"
              loading={saving}
              onClick={async () => {
                try {
                  setSaving(true);
                  await handlerUpdateTn?.(name, (newValue ?? "").toString());
                  setIsEdit(false);
                } finally {
                  setSaving(false);
                }
              }}
            >
              Изменить
            </Button>

            {showTemplate && (
              <Button
                disabled={saving}
                onClick={() => {
                  // Подставляем шаблон в поле (без автосейва)
                  setNewValue(buildTemplateText());
                }}
              >
                Шаблон
              </Button>
            )}

            <Button
              disabled={saving}
              onClick={() => {
                setIsEdit(false);
                setNewValue(value ?? "");
              }}
            >
              Отмена
            </Button>
          </Flex>
        </Flex>
      ) : editable && canEdit ? (
        <>
          <Typography.Text>{safeValue}</Typography.Text>
          <EditOutlined
            className={styles.editIcon}
            onClick={() => {
              if (!canEdit) return;
              setNewValue(value ?? "");
              setIsEdit(true);
            }}
          />
        </>
      ) : (
        <Typography.Text>{safeValue}</Typography.Text>
      )}
    </Flex>
  );
}

// import { EditOutlined } from "@ant-design/icons";
// import { Flex, Typography, Input, Button } from "antd";
// import React, { useEffect, useState } from "react";
// import styles from "./EditableField.module.css";

// export default function EditableField({
//   handlerUpdateTn,
//   name,
//   value,
//   editable,
//   canEdit = true,
// }) {
//   const safeValue = value ?? "";
//   const [isEdit, setIsEdit] = useState(false);
//   const [newValue, setNewValue] = useState(safeValue);
//   const [saving, setSaving] = useState(false);

//   useEffect(() => {
//     // если пришли новые данные — синхронизируем инпут
//     if (!isEdit) setNewValue(value ?? "");
//   }, [value, isEdit]);

//   // если вдруг роль поменялась на лету — закрываем режим редактирования
//   useEffect(() => {
//     if (!canEdit && isEdit) setIsEdit(false);
//   }, [canEdit, isEdit]);

//   return (
//     <Flex gap={10}>
//       {isEdit ? (
//         <Flex vertical gap={10}>
//           <Input.TextArea
//             value={newValue}
//             onChange={(e) => setNewValue(e.target.value)}
//           />
//           <Button
//             type="primary"
//             loading={saving}
//             onClick={async () => {
//               try {
//                 setSaving(true);
//                 await handlerUpdateTn?.(name, (newValue ?? "").toString());
//                 setIsEdit(false);
//               } finally {
//                 setSaving(false);
//               }
//             }}
//           >
//             Изменить
//           </Button>
//           <Button
//             disabled={saving}
//             onClick={() => {
//               setIsEdit(false);
//               setNewValue(value ?? "");
//             }}
//           >
//             Отмена
//           </Button>
//         </Flex>
//       // ) : editable ? (
//       ) : editable && canEdit ? (
//         <>
//           <Typography.Text>{safeValue}</Typography.Text>
//           <EditOutlined
//             className={styles.editIcon}
//             onClick={() => {
//               if (!canEdit) return;
//               setNewValue(value ?? "");
//               setIsEdit(true);
//             }}
//           />
//         </>
//       ) : (
//         <Typography.Text>{safeValue}</Typography.Text>
//       )}
//     </Flex>
//   );
// }
