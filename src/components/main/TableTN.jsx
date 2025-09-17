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
  Tag,
  Tooltip,
  Space,
} from "antd";
import React, { useEffect, useState } from "react";
import useData from "../../stores/useData";
import dayjs from "dayjs";
import { ReloadOutlined } from "@ant-design/icons";
import useAuth from "../../stores/useAuth";
import TableTNActionsBar from "./TableTNActionsBar";
import TNModal from "./TNModal";
import AiAnalyticsModal from "../ai/AiAnalyticsModal";
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

// --- СЗО: извлечение по типам из raw.SocialObjects + фолбэки по *_ALL полям ---
const SZO_ORDER = [
  "mkd",
  "schools",
  "kindergartens",
  "hospitals",
  "polyclinics",
  "boiler",
  "water",
  "kns",
  "snt",
];

const SZO_META = {
  mkd: { label: "МКД", color: "default" },
  schools: { label: "Школы", color: "blue" },
  kindergartens: { label: "Детсады", color: "geekblue" },
  hospitals: { label: "Больницы", color: "red" },
  polyclinics: { label: "Поликлиники", color: "magenta" },
  boiler: { label: "Котельные", color: "orange" },
  water: { label: "ВЗУ", color: "green" },
  kns: { label: "КНС", color: "volcano" },
  snt: { label: "СНТ", color: "purple" },
};

function s(v) {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function getRawData(item) {
  // чаще всего соц-объекты лежат в item.data.data
  return item?.data?.data ?? item?.data ?? item ?? {};
}

function classifySocialTyp(t) {
  const x = s(t).toLowerCase();
  if (x.includes("мкд") || x.includes("дом")) return "mkd";
  if (x.includes("школ")) return "schools";
  if (x.includes("детс") || x.includes("сад")) return "kindergartens";
  if (x.includes("больниц")) return "hospitals";
  if (x.includes("поликлин")) return "polyclinics";
  if (x.includes("котель")) return "boiler";
  if (x.includes("взу") || x.includes("скваж")) return "water";
  if (x.includes("кнс")) return "kns";
  if (x.includes("снт")) return "snt";
  return null;
}

/** Собираем сводку СЗО: counts + короткие списки имён (для тултипов) */
function buildSzoSummaryFromItem(item) {
  const raw = getRawData(item);
  const socials = Array.isArray(raw.SocialObjects) ? raw.SocialObjects : [];

  // Заготовка
  const base = {
    mkd: { count: 0, names: [] },
    schools: { count: 0, names: [] },
    kindergartens: { count: 0, names: [] },
    hospitals: { count: 0, names: [] },
    polyclinics: { count: 0, names: [] },
    boiler: { count: 0, names: [] },
    water: { count: 0, names: [] },
    kns: { count: 0, names: [] },
    snt: { count: 0, names: [] },
  };

  const seenByKey = {
    mkd: new Set(),
    schools: new Set(),
    kindergartens: new Set(),
    hospitals: new Set(),
    polyclinics: new Set(),
    boiler: new Set(),
    water: new Set(),
    kns: new Set(),
    snt: new Set(),
  };

  if (socials.length) {
    // Классифицируем каждый объект
    socials.forEach((it) => {
      const key = classifySocialTyp(it?.SocialTyp);
      if (!key) return;
      // уникальность по FIAS или имени
      const uniq =
        s(it?.FIAS)?.toLowerCase() || s(it?.Name) || Math.random().toString(36);
      if (seenByKey[key].has(uniq)) return;
      seenByKey[key].add(uniq);

      base[key].count += 1;
      const name = s(it?.Name);
      if (name) base[key].names.push(name);
    });
  } else {
    // Фолбэк по суммарным *_ALL полям, если массива нет
    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    base.mkd.count = num(raw.MKD_ALL);
    base.schools.count = num(raw.SCHOOLS_ALL);
    base.kindergartens.count = num(raw.KINDERGARTENS_ALL);
    base.hospitals.count = num(raw.HOSPITALS_ALL);
    base.polyclinics.count = num(raw.CLINICS_ALL);
    base.boiler.count = num(raw.BOILER_ALL);
    // ВЗУ/скважины встречались как WELLS_ALL
    base.water.count = num(raw.WELLS_ALL);
    base.kns.count = num(raw.KNS_ALL);
    // СНТ обычно только в SocialObjects — оставим 0
  }

  // Сконвертируем в компактный массив для UI
  const tags = [];
  for (const key of SZO_ORDER) {
    const { count, names } = base[key];
    if (count > 0) {
      tags.push({
        key,
        label: SZO_META[key].label,
        color: SZO_META[key].color,
        count,
        names: names.slice(0, 10), // короткий список в тултип
        more: Math.max(0, names.length - 10),
      });
    }
  }
  return tags;
}

/** Ячейка таблицы с тегами СЗО */
function SzoCell({ tags }) {
  if (!Array.isArray(tags) || tags.length === 0)
    return <span style={{ color: "#999" }}>—</span>;
  return (
    <Space size={[6, 6]} wrap>
      {tags.map((t) => {
        const title = t.names.length
          ? `${t.label}: ${t.names.join(", ")}${
              t.more ? ` и ещё +${t.more}` : ""
            }`
          : `${t.label}: ${t.count} шт.`;
        return (
          <Tooltip key={t.key} title={title} mouseEnterDelay={0.15}>
            <Tag color={t.color} style={{ marginInlineEnd: 0 }}>
              {t.label}: {t.count}
            </Tag>
          </Tooltip>
        );
      })}
    </Space>
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
  const [showAi, setShowAi] = useState(false);

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
      // console.log(`#${i + 1}`, {
      //   id: tn.id,
      //   number: tn.number,
      //   energoObject: tn.energoObject,
      //   status: tn.STATUS_NAME,
      //   createDateTime: tn.createDateTime,
      //   dispCenter: tn.dispCenter,
      // });
    });
    console.log("Всего ТН:", all.length);
  }, [tns?.data, isLoadingTns]);

  // === LIVE ПОДПИСКА (SSE) ===
  useEffect(() => {
    // const base = import.meta.env.VITE_URL_BACKEND;
    const base = import.meta.env.VITE_URL_BACKEND_SERVICES;
    const url = `${base}/services/event`;
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
      // console.log("📡 Подключаюсь к SSE:", url);
      es = new EventSource(url, { withCredentials: false });

      es.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          // console.log("🔔 Live-событие:", payload);
          // На любые события от нашего бэка — обновляем список
          scheduleRefresh();
        } catch (e) {
          console.log("Ошибка срабатывания вебхука", e);
        }
      };

      es.onerror = () => {
        console.warn("⚠️ SSE ошибка/разрыв, переподключение через 3с…");
        try {
          es.close();
        } catch {}
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      clearTimeout(timer);
      try {
        es?.close();
      } catch {}
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

  // console.log(
  //   "[filters] дата =",
  //   date?.format("DD.MM.YYYY"),
  //   "; статусы =",
  //   selectedStatuses,
  //   "; всего по фильтрам =",
  //   listFiltered.length
  // );

  const startIndex = (pagination.page - 1) * pagination.pageSize;
  const pageSlice = listFiltered.slice(
    startIndex,
    startIndex + pagination.pageSize
  );

  const dataSource = pageSlice.length
    ? pageSlice.map((item) => {
        const szoTags = buildSzoSummaryFromItem(item);
        return {
          key: item.id,
          number: item.number,
          energoObject: item.energoObject,
          addressList: item.addressList,
          dispCenter: item.dispCenter,
          createDateTime: dayjs(item.createDateTime).format("DD.MM.YYYY HH:mm"),
          documentId: item.documentId,
          szoTags,
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
      width: 120,
      ellipsis: true,
    },
    {
      title: "Объект",
      dataIndex: "energoObject",
      key: "energoObject",
      width: 220,
      ellipsis: true,
    },
    {
      title: "Диспетчерская",
      dataIndex: "dispCenter",
      key: "dispCenter",
      width: 180,
      ellipsis: true,
    },
    {
      title: "Адрес",
      dataIndex: "addressList",
      key: "addressList",
      // без width — эта колонка тянет свободное место
      ellipsis: true,
    },
    {
      title: "СЗО",
      dataIndex: "szoTags",
      key: "szo",
      width: 380,
      render: (tags) => <SzoCell tags={tags} />,
      ellipsis: true,
    },
    {
      title: "Дата/время возникновения",
      dataIndex: "createDateTime",
      key: "createDateTime",
      width: 180,
      ellipsis: true,
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
        onAiAnalytics={() => setShowAi(true)}
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

      <AiAnalyticsModal
        open={showAi}
        onClose={() => setShowAi(false)}
        items={listFiltered}
        title={date ? `За ${date.format("DD.MM.YYYY")}` : "Все выбранные ТН"}
      />
    </ConfigProvider>
  );
}
