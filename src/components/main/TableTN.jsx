import {
  Button,
  ConfigProvider,
  DatePicker,
  Flex,
  Modal,
  Pagination,
  Select,
  Spin,
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

// helper: normalize статус из разных мест объекта
const getStatusName = (item) => {
  const raw =
    item?.data?.data?.STATUS_NAME ??
    item?.data?.STATUS_NAME ??
    item?.STATUS_NAME ??
    item?.data?.data?.status_name ??
    item?.status_name ??
    null;
  return typeof raw === "string" ? raw.trim().toLowerCase() : null;
};

const STATUS_OPTIONS = [
  { label: "Открыта", value: "открыта" },
  { label: "Запитана", value: "запитана" },
  { label: "Удалена", value: "удалена" },
];

function WelcomeHeader({ totalOpened, loadingOpened }) {
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
        Всего открытых ТН:{" "}
        {loadingOpened ? (
          <Spin size="small" />
        ) : (
          totalOpened
        )}
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

function FiltersBar({
  dateValue,
  onDateChange,
  selectedStatuses,
  onStatusChange,
  rightExtra,
}) {
  return (
    <Flex
      justify="space-between"
      align="center"
      style={{ marginBottom: 10, flexWrap: "wrap", gap: 8 }}
    >
      <Flex gap={8} wrap style={{ rowGap: 8 }}>
        <DatePicker
          value={dateValue}
          format={"DD.MM.YYYY"}
          onChange={onDateChange}
        />
        <Typography.Text style={{ whiteSpace: "nowrap" }}>Статус ТН:</Typography.Text>
        <Select
          mode="multiple"
          allowClear
          style={{ minWidth: 300 }}
          placeholder="Выберите статус(ы)"
          value={selectedStatuses}
          onChange={onStatusChange}
          options={STATUS_OPTIONS}
          dropdownMatchSelectWidth={false}
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
  const [selectedStatuses, setSelectedStatuses] = useState(["открыта"]);

  // клиентская фильтрация активна, когда выбрано что-то кроме "Все"
  const isAllStatuses = selectedStatuses.length === 0;

  const handleStatusChange = (vals) => {
    setSelectedStatuses(vals || []);
    setPagination((p) => ({ ...p, page: 1 }));
    console.log("[filters] режим: Статусы =", vals || []);
  };

  const openedCount = React.useMemo(() => {
    const list = Array.isArray(tns?.data) ? tns.data : [];
    return list.filter((i) => getStatusName(i) === "открыта").length;
  }, [tns?.data]);
  const loadingOpened = isLoadingTns || !Array.isArray(tns?.data);

  useEffect(() => {
    // Серверная пагинация для "Все"
    // Клиентская фильтрация — тянем побольше записей единожды
    const fetchPage = isAllStatuses ? pagination.page : 1;
    const fetchSize = isAllStatuses ? pagination.pageSize : 500; // хватит на сутки
    getTns(fetchPage, fetchSize);
  }, [pagination.page, pagination.pageSize, isAllStatuses, getTns]);

  useEffect(() => {
    if (isLoadingTns) return;
    const all = Array.isArray(tns?.data) ? tns.data : [];
    if (all.length === 0) return;
    const opened = all.filter((i) => getStatusName(i) === "открыта");
    console.log(`[filters] открытых ТН: ${opened.length}`);
    opened.forEach((i) => {
      const id = i?.documentId || i?.id;
      console.log(`ТН ${id}: статус = "открыта"`);
    });
  }, [tns?.data, isLoadingTns]);

  const listRaw = Array.isArray(tns?.data) ? tns.data : [];

  // Если выбрано "Все" — показываем как есть (страница уже с сервера)
  // Иначе фильтруем на клиенте и режем вручную для пагинации
  const listFiltered = isAllStatuses
    ? listRaw
    : listRaw.filter((item) => {
        const s = getStatusName(item);
        return s ? selectedStatuses.includes(s) : false;
      });

  const startIndex = (pagination.page - 1) * pagination.pageSize;
  const pageSlice = isAllStatuses
    ? listFiltered
    : listFiltered.slice(startIndex, startIndex + pagination.pageSize);

  const dataSource = pageSlice.length
    ? pageSlice.map((item) => {
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
      <WelcomeHeader totalOpened={openedCount} loadingOpened={loadingOpened} />
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
        onDateChange={(v) => {
          setDate(v);
          setPagination((p) => ({ ...p, page: 1 }));
        }}
        selectedStatuses={selectedStatuses}
        onStatusChange={handleStatusChange}
        rightExtra={
          <Button
            disabled={isLoadingTns}
            onClick={() => {
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
          total={
            isAllStatuses
              ? (tns?.meta?.pagination?.total ?? listFiltered.length)
              : listFiltered.length
          }
          current={pagination.page}
          pageSize={pagination.pageSize}
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
