import { Button, ConfigProvider, DatePicker, Flex, Modal, Pagination, Switch, Table, Typography } from 'antd'
import React, { useEffect, useState } from 'react'
import useData from '../../stores/useData';
import dayjs from 'dayjs';
import { ReloadOutlined } from '@ant-design/icons';
import ItemTN from './ItemTN';

const defaultPageSize = 10
const defaultPage = 1

export default function TableTN() {
    const { tns, getTns, isLoadingTns } = useData(store => store)
    const [pagination, setPagination] = useState({ page: defaultPage, pageSize: defaultPageSize })
    const [isOpenModalTN, setIsOpenModalTN] = useState(false)
    useEffect(() => {
        getTns(pagination.page, pagination.pageSize)
    }, [pagination])
    useEffect(() => {
        console.log("tns", tns);
    }, [tns])
    const dataSource = tns && tns.data ? tns.data.map(item => {
        return {
            key: item.id,
            number: item.number,
            energoObject: item.energoObject,
            addressList: item.addressList,
            dispCenter: item.dispCenter,
            createDateTime: dayjs(item.createDateTime).format("DD.MM.YYYY hh:mm"),
            documentId: item.documentId,
            sendedEdds: <Button
                disabled={item.sendedEdds}
                type='primary'
                onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation();
                    console.log(item.documentId)
                }}
            >
                {item.sendedEdds ? 'Отправлено' : 'Отправить'}
            </Button>,

        }
    }) : []

    const columns = [
        {
            title: 'Номер',
            dataIndex: 'number',
            key: 'number',
        },
        {
            title: 'Объект',
            dataIndex: 'energoObject',
            key: 'energoObject',
        },
        {
            title: 'Адрес',
            dataIndex: 'addressList',
            key: 'addressList',
        },
        {
            title: 'Диспетчерская',
            dataIndex: 'dispCenter',
            key: 'dispCenter',
        },
        {
            title: 'Дата/время возникновения',
            dataIndex: 'createDateTime',
            key: 'createDateTime',
        },
        {
            title: 'ЕДДС',
            dataIndex: 'sendedEdds',
            key: 'sendedEdds',
        },
    ];
    const paginationChange = (page, pageSize) => {
        setPagination({ page, pageSize })
    }
    return (
        <>
            <Typography.Title>Технологические нарушения</Typography.Title>
            <Flex justify="space-between" style={{ marginBottom: 10 }}>
                <Flex>

                    <DatePicker defaultValue={dayjs()} format={"DD.MM.YYYY"} />
                </Flex>
                <Button disabled={isLoadingTns} onClick={() => { getTns(pagination.page, pagination.pageSize) }}><ReloadOutlined /></Button>
            </Flex>
            <ConfigProvider
                theme={{
                    components: {
                        Table: {
                            rowHoverBg:"#ffb458ff"
                        },
                    },
                }}
            >

                <Table
                    dataSource={dataSource}
                    columns={columns}
                    pagination={false}
                    onRow={(record, rowIndex) => {
                        return {
                            style: {
                                cursor: "pointer",
                            },

                            onClick: (event) => {
                                setIsOpenModalTN(record.documentId)
                                // console.log(event);
                                // console.log(record);
                            }, // click row
                            // onDoubleClick: (event) => { }, // double click row
                            // onContextMenu: (event) => { }, // right button click row
                            // onMouseEnter: (event) => { }, // mouse enter row
                            // onMouseLeave: (event) => { }, // mouse leave row
                        };
                    }}
                />

            </ConfigProvider>
            <div style={{ marginTop: 10 }}>
                <Pagination
                    align="center"
                    total={tns?.meta?.pagination?.total}
                    onChange={paginationChange}
                    showTotal={(total, range) => `${range[0]}-${range[1]} из ${total} ТН`}
                />
            </div>
            <Modal
                title={'Технологическое нарушение'}
                open={isOpenModalTN}
                destroyOnHidden={true}
                onCancel={() => { setIsOpenModalTN(false) }}
                footer={false}
            >
                <ItemTN documentId={isOpenModalTN} />
            </Modal>
        </>
    )
}
