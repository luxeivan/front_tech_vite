// /src/components/main/EditableField.jsx
import { EditOutlined } from "@ant-design/icons";
import { Flex, Typography, Input, Button } from "antd";
import React, { useEffect, useState } from "react";
import styles from "./EditableField.module.css";

export default function EditableField({
  handlerUpdateTn,
  name,
  value,
  editable,
}) {
  const safeValue = value ?? "";
  const [isEdit, setIsEdit] = useState(false);
  const [newValue, setNewValue] = useState(safeValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // если пришли новые данные — синхронизируем инпут
    if (!isEdit) setNewValue(value ?? "");
  }, [value, isEdit]);

  return (
    <Flex gap={10}>
      {isEdit ? (
        <Flex vertical gap={10}>
          <Input.TextArea
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
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
      ) : editable ? (
        <>
          <Typography.Text>{safeValue}</Typography.Text>
          <EditOutlined
            className={styles.editIcon}
            onClick={() => {
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
// import { EditOutlined } from '@ant-design/icons'
// import { Flex, Typography, Input, Button } from 'antd'
// import React, { useEffect, useState } from 'react'
// import styles from './EditableField.module.css'

// export default function EditableField({ handlerUpdateTn, name, value, editable }) {
//     const [isEdit, setIsEdit] = useState(false)
//     const [newValue, setNewValue] = useState(false)
//     useEffect(() => {
//         setNewValue(value)
//     }, [isEdit])

//     return (
//         <Flex gap={10}>
//             {isEdit &&
//                 <Flex vertical gap={10}>
//                     <Input.TextArea
//                         value={newValue}
//                         onChange={(event) => {
//                             // console.log(event);
//                             setNewValue(event.target.value)
//                         }}
//                     />
//                     <Button
//                         type='primary'
//                         onClick={() => {
//                             setIsEdit(false)
//                             handlerUpdateTn(name, newValue)
//                         }}
//                     >Изменить</Button>
//                     <Button
//                         onClick={() => {
//                             setIsEdit(false)
//                         }}
//                     >Отмена</Button>
//                 </Flex>
//             }
//             {!isEdit && editable &&
//                 <>
//                     <Typography.Text>{value}</Typography.Text>
//                     <EditOutlined
//                         style={{ }}
//                         className={styles.editIcon}
//                         onClick={() => {
//                             setIsEdit(true)
//                         }}
//                     />
//                 </>
//             }
//             {!isEdit && !editable &&
//                 <Typography.Text>{value}</Typography.Text>
//             }
//         </Flex>
//     )
// }
