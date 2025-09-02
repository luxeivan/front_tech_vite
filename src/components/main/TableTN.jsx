import {
  Button,
  ConfigProvider,
  DatePicker,
  Flex,
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
import useAuth from "../../stores/useAuth";
import TableTNActionsBar from "./TableTNActionsBar";
import TNModal from "./TNModal";
import ruRU from "antd/locale/ru_RU";
import "dayjs/locale/ru";
dayjs.locale("ru");

const getStatusName = (item) => {
  const rawTop = item?.STATUS_NAME;
  if (typeof rawTop === "string" && rawTop.trim()) {
    return rawTop.trim().toLowerCase();
  }

  const rawLegacy =
    item?.data?.STATUS_NAME ??
    item?.data?.data?.STATUS_NAME ??
    item?.status_name ??
    item?.data?.data?.status_name ??
    null;

  return typeof rawLegacy === "string" ? rawLegacy.trim().toLowerCase() : null;
};

const getCreateDate = (item) =>
  item?.createDateTime ??
  item?.data?.createDateTime ??
  item?.data?.data?.createDateTime ??
  item?.data?.data?.F81_060_EVENTDATETIME ??
  null;

// 4 варианта статусов ТН
const STATUS_OPTIONS = [
  { label: "Открыта", value: "открыта" },
  { label: "Запитана", value: "запитана" },
  { label: "Удалена", value: "удалена" },
  { label: "Закрыта", value: "закрыта" },
];

function WelcomeHeader({ totalOpened, loadingOpened }) {
  const { user, getJwt, getUserMe } = useAuth((s) => s);
  React.useEffect(() => {
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
        Всего открытых ТН: {loadingOpened ? <Spin size="small" /> : totalOpened}
      </Typography.Title>
    </div>
  );
}

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
          placeholder="Выберите дату"
          allowClear
        />
        <Typography.Text style={{ whiteSpace: "nowrap" }}>
          Статус ТН:
        </Typography.Text>
        <Select
          mode="multiple"
          allowClear
          style={{ minWidth: 300 }}
          placeholder="Выберите статус(ы)"
          value={selectedStatuses}
          onChange={onStatusChange}
          options={STATUS_OPTIONS}
          dropdownMatchSelectWidth={false}
          maxTagCount={false}
        />
      </Flex>
      {rightExtra}
    </Flex>
  );
}

const defaultPageSize = 10;
const defaultPage = 1;

export default function TableTN() {
  const { tns, getTns, isLoadingTns } = useData((store) => store);
  const [pagination, setPagination] = useState({
    page: defaultPage,
    pageSize: defaultPageSize,
  });
  const [isOpenModalTN, setIsOpenModalTN] = useState(false);
  const [date, setDate] = useState(null);
  const [sound, setSound] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState(["открыта"]);

  const handleStatusChange = (vals) => {
    setSelectedStatuses(vals || []);
    setPagination((p) => ({ ...p, page: 1 }));
    console.log("[filters] режим: Статусы =", vals || []);
  };

  const openedCount = React.useMemo(() => {
    const list = Array.isArray(tns?.data) ? tns.data : [];
    const byDate = list.filter((i) => {
      const d = getCreateDate(i);
      return date ? dayjs(d).isSame(date, "day") : true;
    });
    return byDate.filter((i) => getStatusName(i) === "открыта").length;
  }, [tns?.data, date]);
  const loadingOpened = isLoadingTns || !Array.isArray(tns?.data);

  // Сколько всего ТН попадает под текущие фильтры (дата + статусы)
  const totalByDate = React.useMemo(() => {
    const list = Array.isArray(tns?.data) ? tns.data : [];
    return list.filter((i) => {
      const d = getCreateDate(i);
      return date ? dayjs(d).isSame(date, "day") : true;
    }).length;
  }, [tns?.data, date]);

  const headerTotal = React.useMemo(() => {
    if (selectedStatuses.length === 0) return totalByDate;
    if (selectedStatuses.length === 1 && selectedStatuses[0] === "открыта")
      return openedCount;
    // считаем по активным фильтрам
    const list = Array.isArray(tns?.data) ? tns.data : [];
    return list.filter((i) => {
      const d = getCreateDate(i);
      if (date && !dayjs(d).isSame(date, "day")) return false;
      const s = getStatusName(i);
      return s ? selectedStatuses.includes(s) : false;
    }).length;
  }, [tns?.data, date, selectedStatuses, openedCount, totalByDate]);

  useEffect(() => {
    getTns(1, 500);
  }, [date, selectedStatuses, getTns]);

  // useEffect(() => {
  //   if (isLoadingTns) return;
  //   const all = Array.isArray(tns?.data) ? tns.data : [];
  //   if (all.length === 0) return;
  //   const opened = all.filter((i) => getStatusName(i) === "открыта");
  //   console.log(`[filters] открытых ТН: ${opened.length}`);
  //   opened.forEach((i) => {
  //     const id = i?.documentId || i?.id;
  //     console.log(`ТН ${id}: статус = "открыта"`);
  //   });
  // }, [tns?.data, isLoadingTns]);

  useEffect(() => {
    if (isLoadingTns) return;
    const all = Array.isArray(tns?.data) ? tns.data : [];
    if (all.length === 0) return;

    // --- СТАРЫЙ ЛОГ ---
    const opened = all.filter((i) => getStatusName(i) === "открыта");
    console.log(`[filters] открытых ТН: ${opened.length}`);
    opened.forEach((i) => {
      const id = i?.documentId || i?.id;
      console.log(`ТН ${id}: статус = "открыта"`);
    });

    // --- НОВЫЙ ЛОГ ДЛЯ АНАЛИТИКИ ---
    console.log("=== ВСЕ ТН (для будущей AI-Аналитики) ===");
    all.forEach((tn, i) => {
      console.log(`#${i + 1}`, {
        id: tn.id,
        number: tn.number,
        energoObject: tn.energoObject,
        status: tn.STATUS_NAME,
        createDateTime: tn.createDateTime,
        dispCenter: tn.dispCenter,
      });
    });
    console.log("Всего ТН:", all.length);
  }, [tns?.data, isLoadingTns]);

  // === LIVE ПОДПИСКА (SSE) ===
  useEffect(() => {
    const base = import.meta.env.VITE_URL_BACKEND;
    const url = `${base}/api/event`;

    let es;
    let timer = null;

    const scheduleRefresh = (delay = 800) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // тянем «пачку» под клиентскую фильтрацию
        getTns(1, 500);
      }, delay);
    };

    const connect = () => {
      console.log("📡 Подключаюсь к SSE:", url);
      es = new EventSource(url, { withCredentials: false });

      es.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          console.log("🔔 Live-событие:", payload);
          // На любые события от нашего бэка — обновляем список
          scheduleRefresh();
        } catch (e) {
          // игнорим некорректные сообщения
        }
      };

      es.onerror = () => {
        console.warn("⚠️ SSE ошибка/разрыв, переподключение через 3с…");
        try { es.close(); } catch {}
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      clearTimeout(timer);
      try { es?.close(); } catch {}
    };
  }, [getTns]);
  // === /LIVE ПОДПИСКА ===

  const listRaw = Array.isArray(tns?.data) ? tns.data : [];
  const listByDate = listRaw.filter((item) => {
    const d = getCreateDate(item);
    return date ? dayjs(d).isSame(date, "day") : true;
  });
  const listFiltered =
    selectedStatuses.length === 0
      ? listByDate
      : listByDate.filter((item) => {
          const s = getStatusName(item);
          return s ? selectedStatuses.includes(s) : false;
        });

  console.log(
    "[filters] дата =",
    date?.format("DD.MM.YYYY"),
    "; статусы =",
    selectedStatuses,
    "; всего по фильтрам =",
    listFiltered.length
  );

  const startIndex = (pagination.page - 1) * pagination.pageSize;
  const pageSlice = listFiltered.slice(
    startIndex,
    startIndex + pagination.pageSize
  );

  const dataSource = pageSlice.length
    ? pageSlice.map((item) => {
        return {
          key: item.id,
          number: item.number,
          energoObject: item.energoObject,
          addressList: item.addressList,
          dispCenter: item.dispCenter,
          createDateTime: dayjs(item.createDateTime).format("DD.MM.YYYY HH:mm"),
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
  ];

  const paginationChange = (page, pageSize) => {
    setPagination({ page, pageSize });
  };

  return (
    <ConfigProvider
      locale={ruRU}
      theme={{
        components: {
          Table: {
            rowHoverBg: "#ffb458ff",
          },
        },
      }}
    >
      {/* Показываем всегда количество ОТКРЫТЫХ ТН (независимо от выбранных статусов), учитывая только фильтр по дате */}
      <WelcomeHeader totalOpened={openedCount} loadingOpened={loadingOpened} />

      <TableTNActionsBar
        onDashboard={() => {
          console.log("[actions] dashboard");
        }}
        onReset={() => {
          setDate(null);
          setSelectedStatuses(["открыта"]);
          setPagination({ page: 1, pageSize: defaultPageSize });
        }}
        onAiAnalytics={() => {
          console.log("[actions] ai analytics");
        }}
        onToggleSound={() => {
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
              getTns(1, 500);
            }}
          >
            <ReloadOutlined />
          </Button>
        }
      />

      {/* ТАБЛИЦА */}
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

      {/* ПАГИНАЦИЯ */}
      <div style={{ marginTop: 10 }}>
        <Pagination
          align="center"
          total={listFiltered.length}
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
    </ConfigProvider>
  );
}
