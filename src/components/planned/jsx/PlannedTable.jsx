import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  ConfigProvider,
  DatePicker,
  Flex,
  Input,
  Modal,
  Pagination,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import axios from "axios";
import dayjs from "dayjs";
import ruRU from "antd/locale/ru_RU";
import { ReloadOutlined } from "@ant-design/icons";
import useAuth from "../../../stores/useAuth";
import { hasFeatureAccess } from "../../../config/viewRoleAccess";
import TNModal from "../../emergency/jsx/TNModal";
import JournalOpenModal from "../../journalOpen/JournalOpenModal";
import {
  SzoCell,
  PLANNED_STATUS_OPTIONS,
  parseJournalStatuses,
} from "../js/plannedTable.utils";
import {
  ALL_BRANCHES,
  ALL_PO,
  DEFAULT_PAGE_SIZE,
  DEFAULT_PLANNED_STATUSES,
  DEFAULT_TNS_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  buildBranchOptions,
  buildPlannedDataKey,
  buildPlannedStats,
  buildPoOptions,
  buildPrimaryRequestParams,
  filterPlannedRows,
  getEffectiveStatuses,
  mapPlannedRow,
  normalizePlannedRows,
  paginateRows,
  sortPlannedRows,
} from "../js/plannedTableFilters";
import "../css/PlannedTable.css";

const { RangePicker } = DatePicker;

const DATE_TIME_COLUMN_WIDTH = 132;

const SEND_CHANNELS = [
  { key: "edds", label: "ЕДДС" },
  { key: "mes", label: "МЭС" },
  { key: "minenergo", label: "МинЭ" },
  { key: "mosenergosbyt", label: "МосЭсб" },
];

function StatusDot({ ok, label }) {
  const color = ok === true ? "#52c41a" : ok === false ? "#ff4d4f" : "#d9d9d9";
  return (
    <Tooltip
      title={`${label}: ${
        ok === true ? "отправлено" : ok === false ? "не отправлено" : "нет данных"
      }`}
    >
      <span className="planned-dot" style={{ background: color }} />
    </Tooltip>
  );
}

function SendDots({ st }) {
  const s = st || {};
  return (
    <Space size={8}>
      {SEND_CHANNELS.map((c) => (
        <StatusDot key={c.key} ok={s[c.key]} label={c.label} />
      ))}
    </Space>
  );
}

function PlannedDateCell({ value }) {
  return <span className="planned-date-nowrap">{value || "—"}</span>;
}

function PlannedStatsHeader({ planned, started, loading }) {
  return (
    <div style={{ textAlign: "center", margin: "12px 0 16px" }}>
      <Space size={20} wrap>
        <Typography.Title level={4} style={{ margin: 0, fontWeight: 500 }}>
          Всего запланированных: {loading ? <Spin size="small" /> : planned}
        </Typography.Title>
        <Typography.Title level={4} style={{ margin: 0, fontWeight: 500 }}>
          Всего начатых: {loading ? <Spin size="small" /> : started}
        </Typography.Title>
      </Space>
    </div>
  );
}

export default function PlannedTable() {
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [date, setDate] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(ALL_BRANCHES);
  const [selectedPo, setSelectedPo] = useState(ALL_PO);
  const [selectedStatuses, setSelectedStatuses] = useState(DEFAULT_PLANNED_STATUSES);
  const [numberQuery, setNumberQuery] = useState("");
  const [sorter, setSorter] = useState({
    field: "startPlan",
    order: "descend",
  });
  const [modalDocId, setModalDocId] = useState(false);
  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [sendStatus, setSendStatus] = useState({ byGuid: {}, byNumber: {} });
  const [isSendStatusLoading, setIsSendStatusLoading] = useState(false);
  const [hasLoadedSendStatus, setHasLoadedSendStatus] = useState(false);
  const [plannedTns, setPlannedTns] = useState({ data: [] });
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingPlannedTns, setIsLoadingPlannedTns] = useState(false);
  const [exportRange, setExportRange] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const lastDataKeyRef = useRef(null);
  const primaryDataRequestSeqRef = useRef(0);
  const sendStatusInFlightRef = useRef(false);

  const user = useAuth((s) => s.user);
  const showJournal = hasFeatureAccess(user?.view_role, "journal");

  const loadSendStatus = useCallback(async ({ force = false } = {}) => {
    if (sendStatusInFlightRef.current && !force) return;
    try {
      sendStatusInFlightRef.current = true;
      setIsSendStatusLoading(true);
      const base = import.meta.env.VITE_URL_BACKEND;
      const url = `${base}/api/zhurnal-otpravkis`;
      const params = {
        "pagination[page]": 1,
        "pagination[pageSize]": 1,
        "sort[0]": "updatedAt:desc",
      };
      const { data: payload } = await axios.get(url, { params });
      const firstItem =
        Array.isArray(payload?.data) && payload.data.length > 0
          ? payload.data[0]
          : null;
      let arr = firstItem?.attributes?.data ?? firstItem?.data ?? [];
      if (!Array.isArray(arr) && typeof arr === "string") {
        arr = arr.split(/\r?\n/).filter(Boolean);
      }
      setSendStatus(parseJournalStatuses(arr));
      setHasLoadedSendStatus(true);
    } catch {
      setSendStatus({ byGuid: {}, byNumber: {} });
      setHasLoadedSendStatus(true);
    } finally {
      sendStatusInFlightRef.current = false;
      setIsSendStatusLoading(false);
    }
  }, []);

  const fetchPrimaryData = useCallback(
    async ({ nextDate = date, force = false } = {}) => {
      const key = buildPlannedDataKey({
        date: nextDate,
        statuses: selectedStatuses,
        numberQuery,
      });
      if (!force && lastDataKeyRef.current === key) return;
      lastDataKeyRef.current = key;
      const requestSeq = primaryDataRequestSeqRef.current + 1;
      primaryDataRequestSeqRef.current = requestSeq;
      if (getEffectiveStatuses(selectedStatuses).length === 0) {
        setPlannedTns({ data: [] });
        setTotalCount(0);
        setIsLoadingPlannedTns(false);
        return;
      }
      try {
        setIsLoadingPlannedTns(true);
        const jwt = localStorage.getItem("jwt");
        const base = `${import.meta.env.VITE_URL_BACKEND}/api/teh-narusheniyas`;
        const requestPageSize = DEFAULT_TNS_PAGE_SIZE;
        let requestPage = 1;
        let allItems = [];
        let total = 0;

        while (true) {
          const params = buildPrimaryRequestParams({
            page: requestPage,
            pageSize: requestPageSize,
            date: nextDate,
            statuses: selectedStatuses,
            numberQuery,
          });

          const { data } = await axios.get(base, {
            params,
            headers: { Authorization: `Bearer ${jwt}` },
          });
          const list = Array.isArray(data?.data) ? data.data : [];
          total = data?.meta?.pagination?.total ?? list.length;
          allItems = allItems.concat(list);

          if (allItems.length >= total || list.length === 0) break;
          requestPage += 1;
        }

        if (primaryDataRequestSeqRef.current !== requestSeq) return;
        setPlannedTns({ data: allItems });
      } catch (error) {
        if (primaryDataRequestSeqRef.current !== requestSeq) return;
        console.log("Ошибка при получении плановых ТН", error);
        setPlannedTns({ data: [] });
        setTotalCount(0);
      } finally {
        if (primaryDataRequestSeqRef.current === requestSeq) {
          setIsLoadingPlannedTns(false);
        }
      }
    },
    [date, numberQuery, selectedStatuses]
  );

  useEffect(() => {
    fetchPrimaryData({
      nextDate: date,
      force: false,
    });
  }, [date, fetchPrimaryData]);

  useEffect(() => {
    loadSendStatus({ force: false });
  }, [loadSendStatus]);

  const rows = useMemo(() => {
    return normalizePlannedRows(plannedTns);
  }, [plannedTns?.data]);

  const poOptions = useMemo(
    () => buildPoOptions(rows, selectedBranch),
    [rows, selectedBranch]
  );

  const branchOptions = useMemo(() => buildBranchOptions(rows), [rows]);

  const filtered = useMemo(() => {
    return filterPlannedRows({
      rows,
      statuses: selectedStatuses,
      selectedBranch,
      selectedPo,
      sendStatus,
    });
  }, [rows, selectedStatuses, selectedBranch, selectedPo, sendStatus]);

  const plannedStats = useMemo(() => buildPlannedStats(filtered), [filtered]);

  const sorted = useMemo(() => sortPlannedRows(filtered, sorter), [filtered, sorter]);

  const startIndex = (pagination.page - 1) * pagination.pageSize;
  const dataSource = paginateRows(sorted, pagination);

  useEffect(() => {
    setTotalCount(sorted.length);
    if (sorted.length > 0 && startIndex >= sorted.length) {
      setPagination((p) => ({ ...p, page: 1 }));
    }
  }, [sorted.length, startIndex]);

  const fetchAllForExport = useCallback(async () => {
    if (!exportRange || exportRange.length !== 2 || !exportRange[0] || !exportRange[1]) {
      message.warning("Выберите период для экспорта");
      return;
    }
    setIsExporting(true);
    try {
      const jwt = localStorage.getItem("jwt");
      const base = `${import.meta.env.VITE_URL_BACKEND}/api/teh-narusheniyas`;
      const [start, end] = exportRange;
      const startIso = new Date(start.year(), start.month(), start.date(), 0, 0, 0).toISOString();
      const endIso = new Date(end.year(), end.month(), end.date(), 23, 59, 59).toISOString();

      let allItems = [];
      let page = 1;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        const params = {
          "pagination[page]": page,
          "pagination[pageSize]": pageSize,
          "sort[0]": "createDateTime:DESC",
          "filters[BASE_TYPE][$eq]": 1,
          "filters[createDateTime][$gte]": startIso,
          "filters[createDateTime][$lte]": endIso,
        };
        const { data } = await axios.get(base, {
          params,
          headers: { Authorization: `Bearer ${jwt}` },
        });
        const list = Array.isArray(data?.data) ? data.data : [];
        allItems = allItems.concat(normalizePlannedRows({ data: list }));
        const total = data?.meta?.pagination?.total ?? 0;
        hasMore = page * pageSize < total && list.length > 0;
        page++;
      }

      if (allItems.length === 0) {
        message.info("Нет данных за выбранный период");
        return;
      }

      const rowsToExport = allItems.map((item) => {
        const mapped = mapPlannedRow(item, sendStatus);
        return {
          "№": mapped.number,
          "Вид заявки": mapped.violationType,
          "Начало работ (план)": mapped.startPlan,
          "Начало работ (факт)": mapped.startFact,
          "Окончание работ (план)": mapped.endPlan,
          "Окончание работ (факт)": mapped.endFact,
          "Филиал": mapped.branch,
          "ПО": mapped.po,
          "Объект": mapped.objectName,
          "Адреса": mapped.addressList,
          "СЗО": Array.isArray(mapped.szoTags) && mapped.szoTags.length > 0
            ? mapped.szoTags.map((tag) => `${tag.label}: ${tag.count}`).join("; ")
            : "—",
          "Описание": mapped.description,
          "Статус": mapped.statusName,
          "Отправки": mapped.send
            ? SEND_CHANNELS.map((ch) => `${ch.label}: ${mapped.send[ch.key] === true ? "да" : mapped.send[ch.key] === false ? "нет" : "—"}`).join("; ")
            : "—",
        };
      });

      const headers = Object.keys(rowsToExport[0]);
      const escapeHtml = (v) =>
        String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
      const headHtml = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
      const bodyHtml = rowsToExport.map((row) => `<tr>${headers.map((h) => `<td>${escapeHtml(row[h])}</td>`).join("")}</tr>`).join("");
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8" /></head><body><table border="1"><thead>${headHtml}</thead><tbody>${bodyHtml}</tbody></table></body></html>`;

      const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateFrom = dayjs(start).format("YYYY-MM-DD");
      const dateTo = dayjs(end).format("YYYY-MM-DD");
      link.href = objectUrl;
      link.download = `planovye-otklyucheniya-${dateFrom}--${dateTo}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      message.success(`Экспортировано ${allItems.length} ТН`);
      setIsExportModalOpen(false);
      setExportRange(null);
    } catch (err) {
      console.error("Ошибка экспорта:", err);
      message.error("Ошибка при экспорте данных");
    } finally {
      setIsExporting(false);
    }
  }, [exportRange, sendStatus]);

  const columns = [
    {
      title: "№",
      dataIndex: "number",
      key: "number",
      width: 50,
      ellipsis: true,
      sorter: true,
      sortOrder: sorter.field === "number" ? sorter.order : null,
    },
    {
      title: "Вид заявки",
      dataIndex: "violationType",
      key: "violationType",
      width: 96,
      render: (v) => <Tag className="planned-type-tag">{v || "—"}</Tag>,
    },
    {
      title: "Начало работ",
      children: [
        {
          title: "план",
          dataIndex: "startPlan",
          key: "startPlan",
          width: DATE_TIME_COLUMN_WIDTH,
          render: (value) => <PlannedDateCell value={value} />,
          sorter: true,
          sortOrder: sorter.field === "startPlan" ? sorter.order : null,
        },
        {
          title: "факт",
          dataIndex: "startFact",
          key: "startFact",
          width: DATE_TIME_COLUMN_WIDTH,
          render: (value) => <PlannedDateCell value={value} />,
        },
      ],
    },
    {
      title: "Окончание работ",
      children: [
        {
          title: "план",
          dataIndex: "endPlan",
          key: "endPlan",
          width: DATE_TIME_COLUMN_WIDTH,
          render: (value) => <PlannedDateCell value={value} />,
        },
        {
          title: "факт",
          dataIndex: "endFact",
          key: "endFact",
          width: DATE_TIME_COLUMN_WIDTH,
          render: (value) => <PlannedDateCell value={value} />,
        },
      ],
    },
    {
      title: "Филиал",
      dataIndex: "branch",
      key: "branch",
      width: 118,
      ellipsis: true,
      sorter: true,
      sortOrder: sorter.field === "branch" ? sorter.order : null,
    },
    {
      title: "ПО",
      dataIndex: "po",
      key: "po",
      width: 112,
      ellipsis: true,
      sorter: true,
      sortOrder: sorter.field === "po" ? sorter.order : null,
    },
    {
      title: "Объект",
      dataIndex: "objectName",
      key: "objectName",
      width: 152,
      ellipsis: true,
      sorter: true,
      sortOrder: sorter.field === "objectName" ? sorter.order : null,
    },
    {
      title: "Адреса",
      dataIndex: "addressList",
      key: "addressList",
      width: 136,
      ellipsis: true,
    },
    {
      title: "СЗО",
      dataIndex: "szoTags",
      key: "szo",
      width: 162,
      render: (tags) => <SzoCell tags={tags} />,
      ellipsis: true,
    },
    {
      title: "Описание",
      dataIndex: "description",
      key: "description",
      width: 132,
      ellipsis: true,
    },
    {
      title: "Статус",
      dataIndex: "statusName",
      key: "statusName",
      width: 84,
      ellipsis: true,
      sorter: true,
      sortOrder: sorter.field === "statusName" ? sorter.order : null,
    },
    {
      title: "Отправки",
      dataIndex: "send",
      key: "send",
      width: 94,
      render: (st) => <SendDots st={st} />,
      ellipsis: true,
    },
  ];

  return (
    <ConfigProvider locale={ruRU}>
      <PlannedStatsHeader
        planned={plannedStats.planned}
        started={plannedStats.started}
        loading={isLoadingPlannedTns}
      />

      <Flex
        justify="space-between"
        align="center"
        style={{ marginBottom: 10, flexWrap: "wrap", gap: 8 }}
      >
        <Flex gap={8} wrap style={{ rowGap: 8 }}>
          <DatePicker
            value={date}
            format={"DD.MM.YYYY"}
            onChange={(v) => {
              setDate(v);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            placeholder="Выберите дату"
            allowClear
          />
          <Select
            allowClear
            style={{ minWidth: 220 }}
            placeholder="Все филиалы"
            value={selectedBranch}
            onChange={(val) => {
              setSelectedBranch(val || ALL_BRANCHES);
              setSelectedPo(ALL_PO);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            options={branchOptions}
            dropdownMatchSelectWidth={false}
          />
          <Select
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 240 }}
            placeholder="Все ПО"
            value={selectedPo}
            onChange={(val) => {
              setSelectedPo(val || ALL_PO);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            options={poOptions}
            dropdownMatchSelectWidth={false}
          />
          <Typography.Text style={{ whiteSpace: "nowrap" }}>
            Статус заявки:
          </Typography.Text>
          <Select
            mode="multiple"
            allowClear
            style={{ minWidth: 260 }}
            placeholder="Выберите статус(ы)"
            value={selectedStatuses}
            onChange={(values) => {
              setSelectedStatuses(values || []);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            options={PLANNED_STATUS_OPTIONS}
            dropdownMatchSelectWidth={false}
            maxTagCount={false}
          />
          <Input
            allowClear
            style={{ width: 150 }}
            placeholder="№ ТН..."
            value={numberQuery}
            onChange={(e) => {
              setNumberQuery(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          />
        </Flex>
        <Flex gap={8} wrap justify="flex-end">
          <Button type="primary" onClick={() => setIsExportModalOpen(true)}>
            Выгрузка в Excel
          </Button>
          <Button
            onClick={() => {
              setDate(null);
              setSelectedBranch(ALL_BRANCHES);
              setSelectedPo(ALL_PO);
              setSelectedStatuses(DEFAULT_PLANNED_STATUSES);
              setNumberQuery("");
              setPagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
              lastDataKeyRef.current = null;
              loadSendStatus({ force: true });
            }}
          >
            Сброс
          </Button>
          {showJournal && (
            <Button onClick={() => setIsJournalOpen(true)}>Журнал отправки</Button>
          )}
          <Button
            onClick={() => {
              lastDataKeyRef.current = null;
              fetchPrimaryData({
                nextDate: date,
                page: pagination.page,
                pageSize: pagination.pageSize,
                force: true,
              });
              loadSendStatus({ force: true });
            }}
            disabled={isLoadingPlannedTns || isSendStatusLoading}
          >
            <ReloadOutlined />
          </Button>
        </Flex>
      </Flex>

      <Table
        className="planned-table--compact"
        size="small"
        tableLayout="fixed"
        loading={isLoadingPlannedTns}
        rowKey="key"
        dataSource={dataSource}
        columns={columns}
        pagination={false}
        onChange={(p, f, s) => {
          const info = Array.isArray(s) ? s[0] : s;
          if (info && info.field) {
            setSorter({ field: info.field, order: info.order || "ascend" });
          } else {
            setSorter({ field: "startPlan", order: "descend" });
          }
        }}
        onRow={(record) => ({
          style: { cursor: "pointer" },
          onClick: () => setModalDocId(record.documentId),
        })}
      />

      <div style={{ marginTop: 10 }}>
        <Pagination
          align="center"
          total={totalCount}
          current={pagination.page}
          pageSize={pagination.pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          showSizeChanger
          onChange={(page, pageSize) => {
            setPagination({ page, pageSize });
          }}
          showTotal={(total, range) => `${range[0]}-${range[1]} из ${total} ТН`}
        />
      </div>

      <TNModal
        open={modalDocId}
        onClose={() => {
          setModalDocId(false);
          setTimeout(() => {
            lastDataKeyRef.current = null;
            fetchPrimaryData({
              nextDate: date,
              page: pagination.page,
              pageSize: pagination.pageSize,
              force: true,
            });
            loadSendStatus({ force: true });
          }, 0);
        }}
        documentId={modalDocId}
        mode="planned"
      />

      <JournalOpenModal
        open={isJournalOpen}
        onClose={() => setIsJournalOpen(false)}
      />

      <Modal
        title="Выгрузка в Excel"
        open={isExportModalOpen}
        onCancel={() => {
          setIsExportModalOpen(false);
          setExportRange(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setIsExportModalOpen(false);
              setExportRange(null);
            }}
          >
            Отмена
          </Button>,
          <Button
            key="export"
            type="primary"
            loading={isExporting}
            disabled={!exportRange || exportRange.length !== 2}
            onClick={fetchAllForExport}
          >
            Экспортировать
          </Button>,
        ]}
        destroyOnClose
      >
        <div style={{ padding: "8px 0" }}>
          <Typography.Text style={{ display: "block", marginBottom: 8 }}>
            Выберите период для выгрузки:
          </Typography.Text>
          <RangePicker
            value={exportRange}
            onChange={(v) => setExportRange(v)}
            format="DD.MM.YYYY"
            placeholder={["Дата начала", "Дата окончания"]}
            style={{ width: "100%" }}
            size="large"
          />
        </div>
      </Modal>
    </ConfigProvider>
  );
}
