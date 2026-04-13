import {
  Alert,
  Button,
  ConfigProvider,
  Col,
  DatePicker,
  Input,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import ruRU from "antd/locale/ru_RU";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAuditEvents, fetchAuditUsers } from "../js/fetchAuditLogs";
import styles from "../css/LoggingPanel.module.css";

const { RangePicker } = DatePicker;
dayjs.locale("ru");

const DEFAULT_LIMIT = 1000;

const STATUS_OPTIONS = [
  { label: "Все статусы", value: "" },
  { label: "Успех", value: "success" },
  { label: "Ошибка", value: "error" },
  { label: "Инфо", value: "info" },
  { label: "Предупреждение", value: "warning" },
];

const TN_TYPE_OPTIONS = [
  { label: "GUID ТН", value: "guid" },
  { label: "Номер ТН", value: "number" },
];

const PAGE_OPTIONS = [
  { label: "Все разделы", value: "" },
  { label: "Аварийные отключения", value: "/" },
  { label: "Плановые отключения", value: "/planned" },
  { label: "Дашборд", value: "/dashboard" },
  { label: "Модуль ПЭС", value: "/pes" },
  { label: "Журнал действий", value: "/logging" },
];

const PAGE_LABEL_MAP = {
  "/": "Аварийные отключения",
  "/planned": "Плановые отключения",
  "/dashboard": "Дашборд",
  "/pes": "Модуль ПЭС",
  "/logging": "Журнал действий",
};

function prettyPage(pathValue) {
  const value = String(pathValue || "").trim();
  if (!value) return "—";
  return PAGE_LABEL_MAP[value] || value;
}

function detailsAsText(row) {
  const source =
    row?.details_json !== undefined && row?.details_json !== null
      ? row.details_json
      : row?.details;
  if (source == null) return "—";
  if (typeof source === "string") return source || "—";
  try {
    return JSON.stringify(source);
  } catch {
    return String(source);
  }
}

function clipText(s, limit = 320) {
  if (!s || s.length <= limit) return s;
  return `${s.slice(0, limit)}…`;
}

function toReadableTime(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString("ru-RU", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return String(v);
  }
}

function formatPeriodText(period) {
  const [from, to] = Array.isArray(period) ? period : [];
  if (!from && !to) return "Показаны записи за последние 24 часа.";
  if (from && to) {
    return `Период: ${dayjs(from).format("DD.MM.YYYY HH:mm")} - ${dayjs(to).format("DD.MM.YYYY HH:mm")} (МСК).`;
  }
  if (from) return `Период: с ${dayjs(from).format("DD.MM.YYYY HH:mm")} (МСК).`;
  return `Период: до ${dayjs(to).format("DD.MM.YYYY HH:mm")} (МСК).`;
}

function statusTag(value) {
  const v = String(value || "").toLowerCase();
  if (v === "success") return <Tag color="success">Успех</Tag>;
  if (v === "error") return <Tag color="error">Ошибка</Tag>;
  if (v === "warning") return <Tag color="warning">Предупреждение</Tag>;
  if (v === "info") return <Tag color="processing">Инфо</Tag>;
  return <Tag>—</Tag>;
}

function createDefaultFilters() {
  return {
    username: "",
    page: "",
    period: [dayjs().subtract(24, "hour"), dayjs()],
    statusEvent: "",
    tnType: "guid",
    tnValue: "",
  };
}

function buildRequestFilters(filters) {
  const [from, to] = Array.isArray(filters.period) ? filters.period : [];
  return {
    limit: DEFAULT_LIMIT,
    username: String(filters.username || "").trim(),
    page: String(filters.page || "").trim(),
    from: from && dayjs.isDayjs(from) ? from.toISOString() : "",
    to: to && dayjs.isDayjs(to) ? to.toISOString() : "",
    statusEvent: String(filters.statusEvent || "").trim(),
    tnType: String(filters.tnType || "").trim(),
    tnValue: String(filters.tnValue || "").trim(),
  };
}

function normalizeUserOptions(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const seen = new Set();
  const options = [];

  for (const item of list) {
    const username =
      typeof item === "string"
        ? item.trim()
        : String(item?.username || item?.name || "").trim();
    if (!username) continue;
    const key = username.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const email =
      typeof item === "string" ? "" : String(item?.email || "").trim();

    options.push({
      value: username,
      search: `${username} ${email}`.toLowerCase(),
      label: (
        <div className={styles.userOption}>
          <div>{username}</div>
          {email ? <div className={styles.userEmail}>{email}</div> : null}
        </div>
      ),
    });
  }

  return options;
}

export default function LoggingPanel() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [errorText, setErrorText] = useState("");
  const [filters, setFilters] = useState(createDefaultFilters);
  const [userOptions, setUserOptions] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [tableScrollY, setTableScrollY] = useState(() => {
    if (typeof window === "undefined") return 420;
    return Math.max(320, window.innerHeight - 420);
  });
  const [viewportWidth, setViewportWidth] = useState(() => {
    if (typeof window === "undefined") return 1440;
    return window.innerWidth;
  });
  const isFirstAutoApplyRef = useRef(true);

  const loadUsers = useCallback(
    async (query = "") => {
      const jwt = localStorage.getItem("jwt") || "";
      const params = {
        query,
        limit: 50,
      };
      setUserLoading(true);
      try {
        const resp = await fetchAuditUsers(params, jwt);
        const list = Array.isArray(resp?.data) ? resp.data : [];
        setUserOptions(normalizeUserOptions(list));
      } catch {
        setUserOptions([]);
      } finally {
        setUserLoading(false);
      }
    },
    []
  );

  const load = useCallback(
    async (nextFilters, { silent = false } = {}) => {
      const jwt = localStorage.getItem("jwt") || "";
      const requestFilters = buildRequestFilters(nextFilters);
      if (!silent) setLoading(true);
      setErrorText("");

      try {
        const eventsResp = await fetchAuditEvents(requestFilters, jwt);

        const data = Array.isArray(eventsResp?.data) ? eventsResp.data : [];
        setRows(data);
        if (eventsResp?.ok === false) {
          setErrorText(String(eventsResp?.message || "Не удалось получить данные журнала"));
        }
      } catch (e) {
        const netCode = e?.code || e?.cause?.code || "";
        const isNetworkDown =
          netCode === "ERR_NETWORK" ||
          netCode === "ECONNREFUSED" ||
          String(e?.message || "").toLowerCase().includes("network error");
        const msg = isNetworkDown
          ? "Нет соединения с backend (/services). Проверь, что back_tech запущен."
          : e?.response?.data?.message ||
            e?.response?.data?.error ||
            e?.message ||
            "Не удалось загрузить журнал";
        setErrorText(String(msg));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(filters);
    loadUsers("");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const update = () => {
      setTableScrollY(Math.max(320, window.innerHeight - 420));
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const isLaptop15 = viewportWidth <= 1512;
  const isWideDesktop = viewportWidth >= 1850;

  const columnSizes = useMemo(() => {
    if (isLaptop15) {
      return {
        time: 145,
        user: 180,
        role: 90,
        status: 100,
        page: 170,
        entity: 200,
        detailsLimit: 700,
      };
    }
    if (isWideDesktop) {
      return {
        time: 180,
        user: 220,
        role: 95,
        status: 110,
        page: 230,
        entity: 260,
        detailsLimit: 1200,
      };
    }
    return {
      time: 160,
      user: 200,
      role: 95,
      status: 105,
      page: 200,
      entity: 230,
      detailsLimit: 900,
    };
  }, [isLaptop15, isWideDesktop]);

  useEffect(() => {
    if (isFirstAutoApplyRef.current) {
      isFirstAutoApplyRef.current = false;
      return;
    }
    const timer = setTimeout(() => {
      load(filters);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters, load]);

  const resetFilters = async () => {
    const next = createDefaultFilters();
    setFilters(next);
    await loadUsers("");
  };

  const columns = useMemo(
    () => [
      {
        title: "Время",
        dataIndex: "created_at",
        key: "created_at",
        width: columnSizes.time,
        render: (v) => toReadableTime(v),
      },
      {
        title: "Пользователь",
        dataIndex: "username",
        key: "username",
        width: columnSizes.user,
        render: (_, row) => (
          <div className={styles.userOption}>
            <div>{row?.username || "—"}</div>
            {row?.email ? <div className={styles.userEmail}>{row.email}</div> : null}
          </div>
        ),
      },
      {
        title: "Роль",
        dataIndex: "role",
        key: "role",
        width: columnSizes.role,
        render: (v) => <Tag>{v || "—"}</Tag>,
      },
      {
        title: "Статус",
        dataIndex: "status_event",
        key: "status_event",
        width: columnSizes.status,
        render: (v) => statusTag(v),
      },
      {
        title: "Раздел",
        dataIndex: "page",
        key: "page",
        width: columnSizes.page,
        render: (v) => prettyPage(v),
      },
      {
        title: "ID / ТН",
        dataIndex: "entity_id",
        key: "entity_id",
        width: columnSizes.entity,
        render: (v) => v || "—",
      },
      {
        title: "Детали",
        dataIndex: "details",
        key: "details",
        render: (_, row) => (
          <Typography.Text className={styles.detailsText}>
            {clipText(detailsAsText(row), columnSizes.detailsLimit)}
          </Typography.Text>
        ),
      },
    ],
    [columnSizes]
  );

  return (
    <ConfigProvider locale={ruRU}>
      <div className={styles.root}>
        {errorText && <Alert type="error" showIcon message={errorText} />}

        <Alert type="info" showIcon message={formatPeriodText(filters.period)} />

        <div className={styles.filtersCard}>
        <Row gutter={[8, 8]}>
          <Col xs={24} md={12} lg={8}>
            <div className={styles.fieldLabel}>Период (МСК)</div>
            <RangePicker
              className={styles.fullWidth}
              value={Array.isArray(filters.period) && filters.period.length ? filters.period : null}
              showTime
              allowEmpty={[true, true]}
              format="DD.MM.YYYY HH:mm"
              onChange={(value) => setFilters((s) => ({ ...s, period: value || [] }))}
            />
          </Col>

          <Col xs={24} md={12} lg={4}>
            <div className={styles.fieldLabel}>Статус</div>
            <Select
              className={styles.fullWidth}
              value={filters.statusEvent}
              options={STATUS_OPTIONS}
              onChange={(v) => setFilters((s) => ({ ...s, statusEvent: v }))}
            />
          </Col>

          <Col xs={24} md={12} lg={5}>
            <div className={styles.fieldLabel}>Пользователь</div>
            <Select
              showSearch
              allowClear
              className={styles.fullWidth}
              placeholder="Выберите пользователя"
              value={filters.username || undefined}
              options={userOptions}
              loading={userLoading}
              filterOption={false}
              onFocus={() => loadUsers(filters.username)}
              onSearch={(v) => loadUsers(v)}
              onChange={(v) => setFilters((s) => ({ ...s, username: v || "" }))}
            />
          </Col>

          <Col xs={24} md={12} lg={7}>
            <div className={styles.fieldLabel}>Фильтр по ТН</div>
            <div className={styles.tnFilterRow}>
              <Segmented
                value={filters.tnType}
                options={TN_TYPE_OPTIONS}
                onChange={(v) => setFilters((s) => ({ ...s, tnType: String(v) }))}
              />
              <Input
                className={styles.fullWidth}
                placeholder={filters.tnType === "number" ? "Введите номер ТН" : "Введите GUID ТН"}
                value={filters.tnValue}
                onChange={(e) => setFilters((s) => ({ ...s, tnValue: e.target.value }))}
              />
            </div>
          </Col>

          <Col xs={24} md={8}>
            <div className={styles.fieldLabel}>Раздел</div>
            <Select
              className={styles.fullWidth}
              value={filters.page}
              options={PAGE_OPTIONS}
              onChange={(v) => setFilters((s) => ({ ...s, page: v }))}
            />
          </Col>

          <Col xs={24} md={8} className={styles.actionsCol}>
            <Space>
              <Button onClick={resetFilters} disabled={loading}>
                Сбросить
              </Button>
            </Space>
          </Col>
        </Row>
        </div>

        <div className={styles.tableWrap}>
          <Table
            rowKey={(row) =>
              String(
                row?.documentId ||
                  row?.id ||
                  `${row?.created_at || "na"}-${row?.username || "na"}-${row?.action || "na"}-${row?.entity_id || "na"}`
              )
            }
            loading={loading}
            columns={columns}
            dataSource={rows}
            pagination={{
              size: "small",
              pageSize: 10,
              showSizeChanger: false,
              showQuickJumper: { goButton: "Перейти" },
              showTotal: (total) => `Всего: ${total}`,
              locale: {
                items_per_page: "/ стр.",
                jump_to: "К странице",
                page: "",
                prev_page: "Предыдущая страница",
                next_page: "Следующая страница",
                prev_5: "Предыдущие 5 страниц",
                next_5: "Следующие 5 страниц",
                prev_3: "Предыдущие 3 страницы",
                next_3: "Следующие 3 страницы",
              },
              itemRender: (page, type, element) => {
                if (type === "prev") return <a>Назад</a>;
                if (type === "next") return <a>Вперед</a>;
                return element;
              },
            }}
            scroll={isLaptop15 ? { x: 1150, y: tableScrollY } : { y: tableScrollY }}
            tableLayout="fixed"
            style={{ width: "100%" }}
            size="small"
            locale={{ emptyText: "Нет данных по выбранным фильтрам" }}
          />
        </div>
      </div>
    </ConfigProvider>
  );
}
