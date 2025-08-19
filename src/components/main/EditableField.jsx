import { EditOutlined } from '@ant-design/icons'
import { Flex, Typography, Input, Button } from 'antd'
import React, { useEffect, useState } from 'react'
import styles from './EditableField.module.css'

export default function EditableField({ handlerUpdateTn, name, value, editable }) {
    const [isEdit, setIsEdit] = useState(false)
    const [newValue, setNewValue] = useState(false)
    useEffect(() => {
        setNewValue(value)
    }, [isEdit])

    return (
        <Flex gap={10}>
            {isEdit &&
                <Flex vertical gap={10}>
                    <Input.TextArea
                        value={newValue}
                        onChange={(event) => {
                            // console.log(event);                            
                            setNewValue(event.target.value)
                        }}
                    />
                    <Button
                        type='primary'
                        onClick={() => {
                            setIsEdit(false)
                            handlerUpdateTn(name, newValue)
                        }}
                    >Изменить</Button>
                    <Button
                        onClick={() => {
                            setIsEdit(false)
                        }}
                    >Отмена</Button>
                </Flex>
            }
            {!isEdit && editable &&
                <>
                    <Typography.Text>{value}</Typography.Text>
                    <EditOutlined
                        style={{ }}
                        className={styles.editIcon}
                        onClick={() => {
                            setIsEdit(true)
                        }}
                    />
                </>
            }
            {!isEdit && !editable &&
                <Typography.Text>{value}</Typography.Text>
            }
        </Flex>
    )
}
