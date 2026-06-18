import React, { useEffect, useMemo } from "react";
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
} from "../js/plannedTable.utils";
import {
  ALL_BRANCHES,
  ALL_PO,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  buildBranchOptions,
  buildPlannedStats,
  buildPoOptions,
  filterPlannedRows,
  mapPlannedRow,
  normalizePlannedRows,
  paginateRows,
  sortPlannedRows,
} from "../js/plannedTableFilters";
import { SEND_CHANNELS, DATE_TIME_COLUMN_WIDTH } from "../js/plannedTable.constants";
import usePlannedStore from "../../../stores/planned/usePlannedStore";
import "../css/PlannedTable.css";

const { RangePicker } = DatePicker;

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
  const user = useAuth((s) => s.user);
  const showJournal = hasFeatureAccess(user?.view_role, "journal");

  const pagination = usePlannedStore((s) => s.pagination);
  const date = usePlannedStore((s) => s.date);
  const selectedBranch = usePlannedStore((s) => s.selectedBranch);
  const selectedPo = usePlannedStore((s) => s.selectedPo);
  const selectedStatuses = usePlannedStore((s) => s.selectedStatuses);
  const numberQuery = usePlannedStore((s) => s.numberQuery);
  const sorter = usePlannedStore((s) => s.sorter);
  const modalDocId = usePlannedStore((s) => s.modalDocId);
  const isJournalOpen = usePlannedStore((s) => s.isJournalOpen);
  const isLoadingPlannedTns = usePlannedStore((s) => s.isLoadingPlannedTns);
  const isSendStatusLoading = usePlannedStore((s) => s.isSendStatusLoading);
  const exportRange = usePlannedStore((s) => s.exportRange);
  const isExporting = usePlannedStore((s) => s.isExporting);
  const isExportModalOpen = usePlannedStore((s) => s.isExportModalOpen);
  const plannedTns = usePlannedStore((s) => s.plannedTns);
  const sendStatus = usePlannedStore((s) => s.sendStatus);
  const totalCount = usePlannedStore((s) => s.totalCount);

  const setDate = usePlannedStore((s) => s.setDate);
  const setSelectedBranch = usePlannedStore((s) => s.setSelectedBranch);
  const setSelectedPo = usePlannedStore((s) => s.setSelectedPo);
  const setSelectedStatuses = usePlannedStore((s) => s.setSelectedStatuses);
  const setNumberQuery = usePlannedStore((s) => s.setNumberQuery);
  const setSorter = usePlannedStore((s) => s.setSorter);
  const setPagination = usePlannedStore((s) => s.setPagination);
  const setModalDocId = usePlannedStore((s) => s.setModalDocId);
  const setIsJournalOpen = usePlannedStore((s) => s.setIsJournalOpen);
  const setExportRange = usePlannedStore((s) => s.setExportRange);
  const setIsExportModalOpen = usePlannedStore((s) => s.setIsExportModalOpen);
  const resetFilters = usePlannedStore((s) => s.resetFilters);
  const fetchPrimaryData = usePlannedStore((s) => s.fetchPrimaryData);
  const loadSendStatus = usePlannedStore((s) => s.loadSendStatus);
  const fetchAllForExport = usePlannedStore((s) => s.fetchAllForExport);
  const refreshAll = usePlannedStore((s) => s.refreshAll);
  const refreshAfterModal = usePlannedStore((s) => s.refreshAfterModal);
  const updateTotalCount = usePlannedStore((s) => s.updateTotalCount);

  useEffect(() => {
    fetchPrimaryData({ force: false });
  }, [date, selectedStatuses, numberQuery, fetchPrimaryData]);

  useEffect(() => {
    loadSendStatus({ force: false });
  }, [loadSendStatus]);

  const rawRows = useMemo(() => normalizePlannedRows(plannedTns), [plannedTns]);

  const poOptions = useMemo(
    () => buildPoOptions(rawRows, selectedBranch),
    [rawRows, selectedBranch]
  );

  const branchOptions = useMemo(() => buildBranchOptions(rawRows), [rawRows]);

  const filtered = useMemo(
    () =>
      filterPlannedRows({
        rows: rawRows,
        statuses: selectedStatuses,
        selectedBranch,
        selectedPo,
        sendStatus,
      }),
    [rawRows, selectedStatuses, selectedBranch, selectedPo, sendStatus]
  );

  const plannedStats = useMemo(() => buildPlannedStats(filtered), [filtered]);

  const sorted = useMemo(() => sortPlannedRows(filtered, sorter), [filtered, sorter]);

  const dataSource = useMemo(() => paginateRows(sorted, pagination), [sorted, pagination]);

  useEffect(() => {
    updateTotalCount();
  }, [sorted.length, updateTotalCount]);

  const handleExport = async () => {
    const result = await fetchAllForExport();
    if (result.error) {
      message.warning(result.error);
      return;
    }

    const { items, sendStatus } = result;
    if (items.length === 0) {
      message.info("Нет данных за выбранный период");
      return;
    }

    const rowsToExport = items.map((item) => {
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
    const [start, end] = exportRange;
    const dateFrom = dayjs(start).format("YYYY-MM-DD");
    const dateTo = dayjs(end).format("YYYY-MM-DD");
    link.href = objectUrl;
    link.download = `planovye-otklyucheniya-${dateFrom}--${dateTo}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    message.success(`Экспортировано ${items.length} ТН`);
    setIsExportModalOpen(false);
    setExportRange(null);
  };

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
            onChange={(v) => setDate(v)}
            placeholder="Выберите дату"
            allowClear
          />
          <Select
            allowClear
            style={{ minWidth: 220 }}
            placeholder="Все филиалы"
            value={selectedBranch}
            onChange={(val) => setSelectedBranch(val)}
            options={branchOptions}
            dropdownMatchSelectWidth={false}
          />
          <Select
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 240 }}
            placeholder="Все ПО"
            value={selectedPo}
            onChange={(val) => setSelectedPo(val)}
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
            onChange={(values) => setSelectedStatuses(values)}
            options={PLANNED_STATUS_OPTIONS}
            dropdownMatchSelectWidth={false}
            maxTagCount={false}
          />
          <Input
            allowClear
            style={{ width: 150 }}
            placeholder="№ ТН..."
            value={numberQuery}
            onChange={(e) => setNumberQuery(e.target.value)}
          />
        </Flex>
        <Flex gap={8} wrap justify="flex-end">
          <Button type="primary" onClick={() => setIsExportModalOpen(true)}>
            Выгрузка в Excel
          </Button>
          <Button onClick={resetFilters}>Сброс</Button>
          {showJournal && (
            <Button onClick={() => setIsJournalOpen(true)}>Журнал отправки</Button>
          )}
          <Button
            onClick={refreshAll}
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
          onChange={(page, pageSize) => setPagination({ page, pageSize })}
          showTotal={(total, range) => `${range[0]}-${range[1]} из ${total} ТН`}
        />
      </div>

      <TNModal
        open={modalDocId}
        onClose={() => {
          setModalDocId(false);
          refreshAfterModal();
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
            onClick={handleExport}
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
