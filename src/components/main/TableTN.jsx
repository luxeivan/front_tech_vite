import {
  Button,
  ConfigProvider,
  DatePicker,
  Flex,
  Modal,
  Pagination,
  Table,
  Typography,
} from "antd";
import React, { useEffect, useState } from "react";
import useData from "../../stores/useData";
import dayjs from "dayjs";
import { ReloadOutlined } from "@ant-design/icons";
import ItemTN from "./ItemTN";
import useAuth from "../../stores/useAuth";
import TableTNActionsBar from "./TableTNActionsBar";
import TNModal from "./TNModal";

function WelcomeHeader() {
  const { user, getJwt, getUserMe } = useAuth((s) => s);
  React.useEffect(() => {
    // дергаем локальный jwt и пробуем подтянуть профиль
    const jwt = getJwt();
    if (jwt) {
      getUserMe?.();
    }
  }, [getJwt, getUserMe]);

  const name =
    user?.fullName ||
    user?.username ||
    (user?.email ? user.email.split("@")[0] : null) ||
    "Пользователь";

  return (
    <div style={{ textAlign: "center", margin: "12px 0 16px" }}>
      <Typography.Title level={2} style={{ marginBottom: 4 }}>
        Добро пожаловать, {name}
      </Typography.Title>
      <Typography.Title level={4} style={{ marginTop: 0, fontWeight: 500 }}>
        Всего открытых ТН: —
      </Typography.Title>
    </div>
  );
}

// function ActionsBar({ onReset }) {
//   return (
//     <Flex
//       justify="center"
//       gap={8}
//       style={{ marginBottom: 12, flexWrap: "wrap" }}
//     >
//       <Button>Дашборд</Button>
//       <Button onClick={onReset}>Сбросить фильтры</Button>
//       <Button>AI-Аналитика</Button>
//       <Button>🔔 Звук: Выкл</Button>
//     </Flex>
//   );
// }

function FiltersBar({ dateValue, onDateChange, rightExtra }) {
  return (
    <Flex
      justify="space-between"
      align="center"
      style={{ marginBottom: 10, flexWrap: "wrap", gap: 8 }}
    >
      <Flex gap={8} wrap>
        <DatePicker
          value={dateValue}
          format={"DD.MM.YYYY"}
          onChange={onDateChange}
        />
      </Flex>
      {rightExtra}
    </Flex>
  );
}

/** =========================
 *  ОСНОВНОЙ КОМПОНЕНТ
 *  ========================= */

const defaultPageSize = 10;
const defaultPage = 1;

export default function TableTN() {
  const { tns, getTns, isLoadingTns } = useData((store) => store);
  const [pagination, setPagination] = useState({
    page: defaultPage,
    pageSize: defaultPageSize,
  });
  const [isOpenModalTN, setIsOpenModalTN] = useState(false);
  const [date, setDate] = useState(dayjs());
  const [sound, setSound] = useState(false);

  useEffect(() => {
    getTns(pagination.page, pagination.pageSize);
  }, [pagination, getTns]);

  useEffect(() => {
    // отладка
    // console.log("tns", tns);
  }, [tns]);

  const dataSource =
    tns && tns.data
      ? tns.data.map((item) => {
          return {
            key: item.id,
            number: item.number,
            energoObject: item.energoObject,
            addressList: item.addressList,
            dispCenter: item.dispCenter,
            createDateTime: dayjs(item.createDateTime).format(
              "DD.MM.YYYY HH:mm"
            ),
            documentId: item.documentId,
            sendedEdds: (
              <Button
                disabled={item.sendedEdds}
                type="primary"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  // console.log(item.documentId);
                }}
              >
                {item.sendedEdds ? "Отправлено" : "Отправить"}
              </Button>
            ),
          };
        })
      : [];

  const columns = [
    {
      title: "Номер",
      dataIndex: "number",
      key: "number",
    },
    {
      title: "Объект",
      dataIndex: "energoObject",
      key: "energoObject",
    },
    {
      title: "Адрес",
      dataIndex: "addressList",
      key: "addressList",
    },
    {
      title: "Диспетчерская",
      dataIndex: "dispCenter",
      key: "dispCenter",
    },
    {
      title: "Дата/время возникновения",
      dataIndex: "createDateTime",
      key: "createDateTime",
    },
    // {
    //   title: "ЕДДС",
    //   dataIndex: "sendedEdds",
    //   key: "sendedEdds",
    // },
  ];

  const paginationChange = (page, pageSize) => {
    setPagination({ page, pageSize });
  };

  return (
    <>
      {/* ВЕРХНЯЯ ЧАСТЬ — приветствие и кнопки */}
      <WelcomeHeader />
      {/* <ActionsBar
        onReset={() => {
          setDate(null);
        }} */}
      <TableTNActionsBar
        onDashboard={() => {
          // TODO: роут на дашборд/модалка/что угодно
          console.log("[actions] dashboard");
        }}
        onReset={() => {
          setDate(null);
          // TODO: сброс остальных фильтров
          console.log("[actions] reset filters");
        }}
        onAiAnalytics={() => {
          // TODO: открыть AI-аналитику
          console.log("[actions] ai analytics");
        }}
        onToggleSound={() => {
          // TODO: инвертировать флаг в сторе/локальном стейте
          setSound((v) => !v);
        }}
        soundEnabled={sound}
      />

      {/* БЛОК ФИЛЬТРОВ */}
      <FiltersBar
        dateValue={date}
        onDateChange={setDate}
        rightExtra={
          <Button
            disabled={isLoadingTns}
            onClick={() => {
              // перезагрузка текущей страницы с текущим размером
              getTns(pagination.page, pagination.pageSize);
            }}
          >
            <ReloadOutlined />
          </Button>
        }
      />

      {/* ТАБЛИЦА */}
      <ConfigProvider
        theme={{
          components: {
            Table: {
              rowHoverBg: "#ffb458ff",
            },
          },
        }}
      >
        <Table
          dataSource={dataSource}
          columns={columns}
          pagination={false}
          onRow={(record) => {
            return {
              style: { cursor: "pointer" },
              onClick: () => {
                setIsOpenModalTN(record.documentId);
              },
            };
          }}
        />
      </ConfigProvider>

      {/* ПАГИНАЦИЯ */}
      <div style={{ marginTop: 10 }}>
        <Pagination
          align="center"
          total={tns?.meta?.pagination?.total}
          onChange={paginationChange}
          showTotal={(total, range) => `${range[0]}-${range[1]} из ${total} ТН`}
        />
      </div>

      {/* МОДАЛКА С ТН */}
      <TNModal
        open={isOpenModalTN}
        onClose={() => {
          setIsOpenModalTN(false);
        }}
        documentId={isOpenModalTN}
      />
    </>
  );
}
