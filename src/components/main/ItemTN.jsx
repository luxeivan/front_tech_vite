import React, { useEffect, useState } from 'react'
import useData from '../../stores/useData'
import { Descriptions, Flex, Modal, Spin, Typography } from 'antd'
import dayjs from 'dayjs'
import useAuth from '../../stores/useAuth'
import { CopyOutlined, EditOutlined } from '@ant-design/icons'
import EditableField from './EditableField'

export default function ItemTN({ documentId }) {
    const { tn, getTn, isLoadingTn, updateTn, isUpdatingTn } = useData(store => store)
    const [openModalEdit, setOpenModalEdit] = useState(false)
    const [data, setData] = useState(false)
    const { fieldsSetting } = useAuth(store => store)
    useEffect(() => {
        getTn(documentId)
    }, [documentId])
    useEffect(() => {
        console.log("tn", tn);
    }, [tn])
    const handlerUpdateTn = async (name, value) => {
        console.log("handlerUpdateTn", name, value);
        let newData = tn?.data?.data
        Object.assign(newData, tn?.data?.data);
        newData[name] = value
        console.log("newData", newData);

        updateTn(tn?.data?.documentId, newData)
        getTn(documentId)
    }
    return (
        <>
            {isLoadingTn && <Spin />}
            {!isLoadingTn && tn && tn.data &&
                <>
                    <Flex vertical gap={20}>
                        <Descriptions
                            column={1}
                            title={`Номер ${tn.data.number}`}
                            items={[
                                {
                                    key: '1',
                                    label: 'Объект',
                                    children: tn.data.energoObject,
                                },
                                {
                                    key: '1',
                                    label: 'Дата/время возникновения',
                                    children: dayjs(tn.data.createDateTime).format("DD.MM.YYYY hh:mm"),
                                },
                            ]}
                        />
                        <Descriptions
                            column={1}
                            items={fieldsSetting.map(item => {
                                return {
                                    key: '1',
                                    label: item.label,
                                    children: <EditableField editable={item.editable} name={item.nameModus} value={tn?.data?.data[item.nameModus]} handlerUpdateTn={handlerUpdateTn} />,
                                }
                            })}

                        />
                    </Flex>
                </>
            }

        </>
    )
}
