import {
  Button,
  Flex,
  Modal,
  Select,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import React from "react";
import {
  buildTnFilialySelectOptions,
  fetchTnFilialyRows,
  formatTnFilialyName,
  getTnFilialyWriteId,
  notifyTnFilialyRezimUpdated,
  updateTnFilialyRezim,
} from "../../../utils/tnFilialyApi";

const DISTRICT_MODE_EMPTY = "bez_rezhima";
const DISTRICT_MODE_OPTIONS = [
  { label: "Без режима", value: DISTRICT_MODE_EMPTY },
  { label: "РПГ", value: "rpg" },
  { label: "ОРР", value: "orr" },
];
const DISTRICT_MODE_LABELS = {
  [DISTRICT_MODE_EMPTY]: "Без режима",
  rpg: "РПГ",
  orr: "ОРР",
};
const DISTRICT_MODE_TAG_STYLES = {
  rpg: {
    backgroundColor: "#fffbe6",
    borderColor: "#fadb14",
    color: "#ad8b00",
  },
  orr: {
    backgroundColor: "#fff1f0",
    borderColor: "#ff4d4f",
    color: "#cf1322",
  },
};

const buildFilialModesFromRows = (rows) =>
  (Array.isArray(rows) ? rows : []).reduce((acc, row) => {
    const writeId = getTnFilialyWriteId(row);
    if (!writeId) return acc;
    if (!row?.rezim || row.rezim === DISTRICT_MODE_EMPTY) return acc;
    acc[String(writeId)] = row.rezim;
    return acc;
  }, {});

export default function DistrictModeModal({ open, onClose }) {
  const [messageApi, contextHolder] = message.useMessage();
  const [filialModeOptions, setFilialModeOptions] = React.useState([]);
  const [filialModeRows, setFilialModeRows] = React.useState([]);
  const [filialModeLoading, setFilialModeLoading] = React.useState(false);
  const [filialModeSaving, setFilialModeSaving] = React.useState(false);
  const [resettingFilialIds, setResettingFilialIds] = React.useState(new Set());
  const [selectedFilialsForMode, setSelectedFilialsForMode] = React.useState([]);
  const [selectedFilialMode, setSelectedFilialMode] = React.useState(DISTRICT_MODE_EMPTY);
  const [filialModes, setFilialModes] = React.useState({});

  React.useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setFilialModeLoading(true);

    fetchTnFilialyRows()
      .then((rows) => {
        if (cancelled) return;
        setFilialModeRows(rows);
        setFilialModeOptions(buildTnFilialySelectOptions(rows));
        setFilialModes(buildFilialModesFromRows(rows));
      })
      .catch(() => {
        if (cancelled) return;
        setFilialModeRows([]);
        setFilialModeOptions([]);
        setFilialModes({});
        messageApi.error("Не удалось загрузить филиалы");
      })
      .finally(() => {
        if (!cancelled) setFilialModeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [messageApi, open]);

  const applyFilialMode = async () => {
    if (!selectedFilialsForMode.length || filialModeSaving) return;

    setFilialModeSaving(true);

    try {
      const updatedRows = await Promise.all(
        selectedFilialsForMode.map((filialId) =>
          updateTnFilialyRezim(filialId, selectedFilialMode)
        )
      );

      setFilialModeRows((prev) => {
        const updatedById = new Map(
          updatedRows
            .filter(Boolean)
            .map((row) => [String(getTnFilialyWriteId(row)), row])
        );

        return prev.map((row) => {
          const writeId = getTnFilialyWriteId(row);
          return updatedById.get(String(writeId)) || row;
        });
      });

      setFilialModes((prev) => {
        const next = { ...prev };
        selectedFilialsForMode.forEach((filialId) => {
          const key = String(filialId);
          if (selectedFilialMode === DISTRICT_MODE_EMPTY) {
            delete next[key];
          } else {
            next[key] = selectedFilialMode;
          }
        });
        return next;
      });

      notifyTnFilialyRezimUpdated({
        action: "set",
        filialIds: selectedFilialsForMode,
        rezim: selectedFilialMode,
      });
      messageApi.success("Режимы сохранены");
    } catch (error) {
      messageApi.error("Не удалось сохранить режимы");
    } finally {
      setFilialModeSaving(false);
    }
  };

  const resetFilialMode = async (filialId) => {
    const key = String(filialId);
    if (!filialModes[key] || resettingFilialIds.has(key)) return;

    setResettingFilialIds((prev) => new Set(prev).add(key));

    try {
      const updatedRow = await updateTnFilialyRezim(filialId, DISTRICT_MODE_EMPTY);

      setFilialModeRows((prev) =>
        prev.map((row) => {
          const writeId = getTnFilialyWriteId(row);
          return String(writeId) === key && updatedRow ? updatedRow : row;
        })
      );

      setFilialModes((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setSelectedFilialsForMode((prev) =>
        prev.filter((selectedId) => String(selectedId) !== key)
      );

      notifyTnFilialyRezimUpdated({
        action: "reset",
        filialIds: [filialId],
        rezim: DISTRICT_MODE_EMPTY,
      });
      messageApi.success("Режим отменён");
    } catch (error) {
      messageApi.error("Не удалось сбросить режим");
    } finally {
      setResettingFilialIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const assignedFilialModes = React.useMemo(() => {
    const rowsByWriteId = new Map(
      filialModeRows.map((row) => [String(getTnFilialyWriteId(row)), row])
    );

    return Object.entries(filialModes)
      .map(([filialId, mode]) => ({
        filialId,
        mode,
        name: formatTnFilialyName(rowsByWriteId.get(String(filialId))?.name) || filialId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [filialModeRows, filialModes]);

  return (
    <>
      {contextHolder}
      <Modal
        title="Режимы филиалов"
        open={open}
        onCancel={onClose}
        footer={[
          <Button
            key="apply"
            type="primary"
            disabled={!selectedFilialsForMode.length || filialModeLoading}
            loading={filialModeSaving}
            onClick={applyFilialMode}
          >
            Применить
          </Button>,
          <Button key="close" disabled={filialModeSaving} onClick={onClose}>
            Закрыть
          </Button>,
        ]}
      >
        <Spin spinning={filialModeLoading}>
          <Flex vertical gap={14}>
            <Flex vertical gap={6}>
              <Typography.Text strong>Филиалы</Typography.Text>
              <Select
                mode="multiple"
                allowClear
                showSearch
                placeholder="Выберите один или несколько филиалов"
                loading={filialModeLoading}
                disabled={filialModeLoading || filialModeSaving}
                value={selectedFilialsForMode}
                options={filialModeOptions}
                onChange={setSelectedFilialsForMode}
                optionFilterProp="label"
                maxTagCount="responsive"
                notFoundContent={
                  filialModeLoading ? <Spin size="small" /> : "Нет данных"
                }
              />
            </Flex>

            <Flex vertical gap={6}>
              <Typography.Text strong>Режим</Typography.Text>
              <Segmented
                block
                options={DISTRICT_MODE_OPTIONS}
                value={selectedFilialMode}
                disabled={filialModeSaving}
                onChange={setSelectedFilialMode}
              />
            </Flex>

            <Flex vertical gap={6}>
              <Typography.Text strong>Назначенные режимы</Typography.Text>
              {assignedFilialModes.length ? (
                <Space wrap>
                  {assignedFilialModes.map(({ filialId, name, mode }) => (
                    <Tag
                      key={filialId}
                      closable
                      onClose={(event) => {
                        event.preventDefault();
                        resetFilialMode(filialId);
                      }}
                      style={{
                        ...(DISTRICT_MODE_TAG_STYLES[mode] || {}),
                        opacity: resettingFilialIds.has(String(filialId)) ? 0.55 : 1,
                      }}
                    >
                      {name}: {DISTRICT_MODE_LABELS[mode] || mode}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Typography.Text type="secondary">
                  Режимы не назначены
                </Typography.Text>
              )}
            </Flex>
          </Flex>
        </Spin>
      </Modal>
    </>
  );
}
