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
  Pagination,
} from "antd";
import ruRU from "antd/locale/ru_RU";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAuditEvents, fetchAuditUsers } from "../js/fetchAuditLogs";
import BrandSunLoader from "../../ui/BrandSunLoader";
import styles from "../css/LoggingPanel.module.css";

const { RangePicker } = DatePicker;
dayjs.locale("ru");

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

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
  { label: "Дашборд ОО", value: "/dashboard-oo" },
  { label: "Модуль ПЭС", value: "/pes" },
  { label: "Журнал действий", value: "/logging" },
];

const PAGE_LABEL_MAP = {
  "/": "Аварийные отключения",
  "/planned": "Плановые отключения",
  "/dashboard": "Дашборд",
  "/dashboard-oo": "Дашборд ОО",
  "/pes": "Модуль ПЭС",
  "/logging": "Журнал действий",
};

function prettyPage(pathValue) {
  const value = String(pathValue || "").trim();
  if (!value) return "—";
  if (value.startsWith("/dashboard-oo")) return PAGE_LABEL_MAP["/dashboard-oo"];
  if (value.startsWith("/planned")) return PAGE_LABEL_MAP["/planned"];
  if (value.startsWith("/pes") || value.startsWith("/services/pes")) return PAGE_LABEL_MAP["/pes"];
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
  if (!from && !to) return "Показаны все записи журнала.";
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

function isAutoSendRow(row) {
  const username = String(row?.username || "").trim().toLowerCase();
  const role = String(row?.role || row?.view_role || "").trim().toLowerCase();
  const page = String(row?.page || "").trim().toLowerCase();
  const action = String(row?.action || "").trim().toLowerCase();

  return (
    username === "unknown" &&
    role === "system" &&
    (page === "/services/edds" || action === "edds_send")
  );
}

function createDefaultFilters() {
  return {
    username: "",
    page: "",
    period: [],
    statusEvent: "",
    tnType: "guid",
    tnValue: "",
    pesNumber: "",
  };
}

function isTnPage(page) {
  return page === "/" || page === "/planned";
}

function isPesPage(page) {
  return page === "/pes";
}

function buildRequestFilters(filters, pagination) {
  const [from, to] = Array.isArray(filters.period) ? filters.period : [];
  const shouldFilterTn = isTnPage(filters.page);
  const shouldFilterPes = isPesPage(filters.page);
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    username: String(filters.username || "").trim(),
    pagePath: String(filters.page || "").trim(),
    from: from && dayjs.isDayjs(from) ? from.toISOString() : "",
    to: to && dayjs.isDayjs(to) ? to.toISOString() : "",
    statusEvent: String(filters.statusEvent || "").trim(),
    tnType: shouldFilterTn ? String(filters.tnType || "").trim() : "",
    tnValue: shouldFilterTn ? String(filters.tnValue || "").trim() : "",
    search: shouldFilterPes ? String(filters.pesNumber || "").trim() : "",
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
    const displayName =
      typeof item === "string" ? username : String(item?.displayName || item?.label || username).trim();

    options.push({
      value: username,
      search: `${displayName} ${username} ${email}`.toLowerCase(),
      label: (
        <div className={styles.userOption}>
          <div>{displayName}</div>
          {displayName !== username ? <div className={styles.userEmail}>{username}</div> : null}
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
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
  });
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
  const userSearchTimerRef = useRef(null);
  const userSearchSeqRef = useRef(0);

  const loadUsers = useCallback(
    async (query = "") => {
      const seq = userSearchSeqRef.current + 1;
      userSearchSeqRef.current = seq;
      const jwt = localStorage.getItem("jwt") || "";
      const params = {
        query: String(query || "").trim(),
        limit: 50,
      };
      setUserLoading(true);
      try {
        const resp = await fetchAuditUsers(params, jwt);
        if (seq !== userSearchSeqRef.current) return;
        const list = Array.isArray(resp?.data) ? resp.data : [];
        setUserOptions(normalizeUserOptions(list));
      } catch {
        if (seq !== userSearchSeqRef.current) return;
        setUserOptions([]);
      } finally {
        if (seq === userSearchSeqRef.current) setUserLoading(false);
      }
    },
    []
  );

  const scheduleLoadUsers = useCallback(
    (query = "") => {
      window.clearTimeout(userSearchTimerRef.current);
      userSearchTimerRef.current = window.setTimeout(() => {
        loadUsers(query);
      }, 250);
    },
    [loadUsers]
  );

  const load = useCallback(
    async (nextFilters, nextPagination, { silent = false } = {}) => {
      const jwt = localStorage.getItem("jwt") || "";
      const requestFilters = buildRequestFilters(nextFilters, nextPagination);
      if (!silent) setLoading(true);
      setErrorText("");

      try {
        const eventsResp = await fetchAuditEvents(requestFilters, jwt);

        const data = Array.isArray(eventsResp?.data) ? eventsResp.data : [];
        const meta = eventsResp?.meta || {};
        setRows(data);
        setPagination((prev) => ({
          ...prev,
          page: Number(meta.page) || nextPagination.page,
          pageSize: Number(meta.pageSize) || nextPagination.pageSize,
          total: Number(meta.total) || 0,
        }));
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
    load(filters, pagination);
    loadUsers("");
    return () => window.clearTimeout(userSearchTimerRef.current);
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
      load(filters, pagination);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters, pagination.page, pagination.pageSize, load]);

  const updateFilters = (updater) => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilters(updater);
  };

  const resetFilters = async () => {
    const next = createDefaultFilters();
    setPagination((prev) => ({ ...prev, page: 1, pageSize: DEFAULT_PAGE_SIZE }));
    setFilters(next);
    await loadUsers("");
  };

  const handlePageChange = (page) => {
    updateFilters((s) => ({
      ...s,
      page,
      tnValue: isTnPage(page) ? s.tnValue : "",
      pesNumber: isPesPage(page) ? s.pesNumber : "",
    }));
  };

  const tableLoading = loading
    ? {
        indicator: (
          <div className={styles.loaderBox}>
            <BrandSunLoader size={42} text="Загружаем журнал" />
          </div>
        ),
      }
    : false;

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
        render: (_, row) => {
          const isAutoSend = isAutoSendRow(row);

          return (
            <div
              className={
                isAutoSend
                  ? `${styles.userOption} ${styles.autoSendUser}`
                  : styles.userOption
              }
            >
              <div>{isAutoSend ? "Автоотправка" : row?.username || "—"}</div>
              {row?.email && !isAutoSend ? (
                <div className={styles.userEmail}>{row.email}</div>
              ) : null}
            </div>
          );
        },
      },
      {
        title: "Роль",
        dataIndex: "role",
        key: "role",
        width: columnSizes.role,
        render: (v, row) =>
          isAutoSendRow(row) ? <Tag color="cyan">system</Tag> : <Tag>{v || "—"}</Tag>,
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
              onChange={(value) => updateFilters((s) => ({ ...s, period: value || [] }))}
            />
          </Col>

          <Col xs={24} md={12} lg={4}>
            <div className={styles.fieldLabel}>Статус</div>
            <Select
              className={styles.fullWidth}
              value={filters.statusEvent}
              options={STATUS_OPTIONS}
              onChange={(v) => updateFilters((s) => ({ ...s, statusEvent: v }))}
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
              filterOption={false}
              onFocus={() => loadUsers(filters.username)}
              onSearch={scheduleLoadUsers}
              onChange={(v) => updateFilters((s) => ({ ...s, username: v || "" }))}
              suffixIcon={userLoading ? <BrandSunLoader size={18} /> : undefined}
              notFoundContent={
                userLoading ? (
                  <div className={styles.selectLoader}>
                    <BrandSunLoader size={28} text="Ищем" />
                  </div>
                ) : (
                  "Нет данных"
                )
              }
            />
          </Col>

          {isTnPage(filters.page) && (
            <Col xs={24} md={12} lg={7}>
              <div className={styles.fieldLabel}>Фильтр по ТН</div>
              <div className={styles.tnFilterRow}>
                <Segmented
                  value={filters.tnType}
                  options={TN_TYPE_OPTIONS}
                  onChange={(v) => updateFilters((s) => ({ ...s, tnType: String(v) }))}
                />
                <Input
                  className={styles.fullWidth}
                  placeholder={
                    filters.tnType === "number" ? "Введите номер ТН" : "Введите GUID ТН"
                  }
                  value={filters.tnValue}
                  onChange={(e) => updateFilters((s) => ({ ...s, tnValue: e.target.value }))}
                />
              </div>
            </Col>
          )}

          {isPesPage(filters.page) && (
            <Col xs={24} md={12} lg={7}>
              <div className={styles.fieldLabel}>Номер ПЭС</div>
              <Input
                className={styles.fullWidth}
                placeholder="Введите номер ПЭС"
                value={filters.pesNumber}
                onChange={(e) => updateFilters((s) => ({ ...s, pesNumber: e.target.value }))}
              />
            </Col>
          )}

          <Col xs={24} md={8}>
            <div className={styles.fieldLabel}>Раздел</div>
            <Select
              className={styles.fullWidth}
              value={filters.page}
              options={PAGE_OPTIONS}
              onChange={handlePageChange}
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
            loading={tableLoading}
            columns={columns}
            dataSource={rows}
            pagination={false}
            scroll={isLaptop15 ? { x: 1150, y: tableScrollY } : { y: tableScrollY }}
            tableLayout="fixed"
            style={{ width: "100%" }}
            size="small"
            locale={{ emptyText: "Нет данных по выбранным фильтрам" }}
          />
          <div className={styles.paginationWrap}>
            <Pagination
              align="center"
              total={pagination.total}
              current={pagination.page}
              pageSize={pagination.pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              showSizeChanger
              onChange={(page, pageSize) =>
                setPagination((prev) => ({ ...prev, page, pageSize }))
              }
              showTotal={(total, range) => `${range[0]}-${range[1]} из ${total} записей`}
            />
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}
