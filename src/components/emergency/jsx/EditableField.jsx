import { EditOutlined } from "@ant-design/icons";
import { Flex, Typography, Input, Button } from "antd";
import React, { useEffect, useState } from "react";
import styles from "../css/EditableField.module.css";

// Ключевые слова, которые выделяются жирным при отображении шаблона
const BOLD_KEYWORDS = [
  "Без напряжения:",
  "ТП, РП полностью:",
  "ТП, РП по одной секции:",
  "МКД:",
  "Чел:",
  "Абонентов:",
  "СЗО полностью:",
  "СЗО по одной секции:",
  "Адреса отключенных объектов:",
  "Направлено ПЭС:",
  "Задействовано:",
];

export function renderWithBold(text) {
  if (!text) return text;
  const raw = String(text);
  const lines = raw.split("\n");

  return lines.map((line, i) => {
    // Ищем ключевое слово в начале строки (новый формат) или после "АО «Мособлэнерго»..." (старый формат)
    const matched = BOLD_KEYWORDS.find((kw) => {
      const trimmed = line.trimStart();
      return trimmed.startsWith(kw) || line.includes(kw);
    });
    if (matched) {
      const idx = line.indexOf(matched);
      if (idx >= 0) {
        const before = line.slice(0, idx);
        const after = line.slice(idx + matched.length);
        return (
          <React.Fragment key={i}>
            {i > 0 && "\n"}
            {before}
            <strong>{matched}</strong>
            {after}
          </React.Fragment>
        );
      }
    }
    return (
      <React.Fragment key={i}>
        {i > 0 && "\n"}
        {line}
      </React.Fragment>
    );
  });
}

export default function EditableField({
  handlerUpdateTn,
  name,
  value,
  editable,
  canEdit = true,
  templateBuilder, // функция, которая возвращает текст шаблона
  textAreaProps, // 👈 новое: можно прокинуть настройки TextArea
  onBeforeSave,
  placeholder = "—",
  displayFormatter, // (value: string) => React.ReactNode — рендер для display-режима
}) {
  const safeValue = value ?? "";
  const [isEdit, setIsEdit] = useState(false);
  const [newValue, setNewValue] = useState(safeValue);
  const [saving, setSaving] = useState(false);

  const isNoop = (a, b) => String(a ?? "") === String(b ?? "");

  useEffect(() => {
    if (!isEdit) setNewValue(value ?? "");
  }, [value, isEdit]);

  useEffect(() => {
    if (!canEdit && isEdit) setIsEdit(false);
  }, [canEdit, isEdit]);

  return (
    <Flex gap={10}>
      {isEdit ? (
        <Flex vertical gap={10} style={{ width: "100%" }}>
          <Input.TextArea
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            autoSize={{ minRows: 3, maxRows: 10 }} // дефолт
            style={{ width: "100%" }}
            {...(textAreaProps || {})} // 👈 переопределяем тут
            onKeyDown={async (e) => {
              if (saving) return;
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                const outgoing = typeof onBeforeSave === "function" ? onBeforeSave(newValue) : (newValue ?? "").toString();
                if (isNoop(outgoing, value)) {
                  setIsEdit(false);
                  return;
                }
                try {
                  setSaving(true);
                  await handlerUpdateTn?.(name, outgoing);
                  setIsEdit(false);
                } finally {
                  setSaving(false);
                }
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setIsEdit(false);
                setNewValue(value ?? "");
              }
            }}
          />

          <Flex gap={8} wrap>
            <Button
              type="primary"
              loading={saving}
              onClick={async () => {
                try {
                  setSaving(true);
                  const outgoing = typeof onBeforeSave === "function" ? onBeforeSave(newValue) : (newValue ?? "").toString();
                  if (isNoop(outgoing, value)) {
                    setIsEdit(false);
                    return;
                  }
                  await handlerUpdateTn?.(name, outgoing);
                  setIsEdit(false);
                } finally {
                  setSaving(false);
                }
              }}
            >
              Изменить
            </Button>

            {typeof templateBuilder === "function" && (
              <Button
                disabled={saving}
                onClick={() => {
                  try {
                    const t = templateBuilder();
                    if (t) setNewValue(String(t));
                  } catch {}
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
          <Typography.Text>
            {safeValue !== ""
              ? displayFormatter
                ? displayFormatter(safeValue)
                : safeValue
              : placeholder}
          </Typography.Text>
          <EditOutlined
            className={styles.editIcon}
            title="Редактировать"
            onClick={() => {
              if (!canEdit) return;
              setNewValue(value ?? "");
              setIsEdit(true);
            }}
          />
        </>
      ) : (
        <Typography.Text>
          {safeValue !== ""
            ? displayFormatter
              ? displayFormatter(safeValue)
              : safeValue
            : placeholder}
        </Typography.Text>
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
