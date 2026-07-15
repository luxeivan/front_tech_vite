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
  buildTnOkrugaSelectOptions,
  fetchTnOkrugaRows,
  getTnOkrugWriteId,
  updateTnOkrugRezim,
} from "../../../utils/tnOkrugaApi";

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

const buildDistrictModesFromRows = (rows) =>
  (Array.isArray(rows) ? rows : []).reduce((acc, row) => {
    const writeId = getTnOkrugWriteId(row);
    if (!writeId) return acc;
    if (!row?.rezim || row.rezim === DISTRICT_MODE_EMPTY) return acc;
    acc[String(writeId)] = row.rezim;
    return acc;
  }, {});

export default function DistrictModeModal({ open, onClose }) {
  const [messageApi, contextHolder] = message.useMessage();
  const [districtModeOptions, setDistrictModeOptions] = React.useState([]);
  const [districtModeRows, setDistrictModeRows] = React.useState([]);
  const [districtModeLoading, setDistrictModeLoading] = React.useState(false);
  const [districtModeSaving, setDistrictModeSaving] = React.useState(false);
  const [resettingDistrictIds, setResettingDistrictIds] = React.useState(new Set());
  const [selectedDistrictsForMode, setSelectedDistrictsForMode] = React.useState([]);
  const [selectedDistrictMode, setSelectedDistrictMode] = React.useState(DISTRICT_MODE_EMPTY);
  const [districtModes, setDistrictModes] = React.useState({});

  React.useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setDistrictModeLoading(true);

    fetchTnOkrugaRows()
      .then((rows) => {
        if (cancelled) return;
        setDistrictModeRows(rows);
        setDistrictModeOptions(buildTnOkrugaSelectOptions(rows));
        setDistrictModes(buildDistrictModesFromRows(rows));
      })
      .catch(() => {
        if (cancelled) return;
        setDistrictModeRows([]);
        setDistrictModeOptions([]);
        setDistrictModes({});
        messageApi.error("Не удалось загрузить округа");
      })
      .finally(() => {
        if (!cancelled) setDistrictModeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [messageApi, open]);

  const applyDistrictMode = async () => {
    if (!selectedDistrictsForMode.length || districtModeSaving) return;

    setDistrictModeSaving(true);

    try {
      const updatedRows = await Promise.all(
        selectedDistrictsForMode.map((districtId) =>
          updateTnOkrugRezim(districtId, selectedDistrictMode)
        )
      );

      setDistrictModeRows((prev) => {
        const updatedById = new Map(
          updatedRows
            .filter(Boolean)
            .map((row) => [String(getTnOkrugWriteId(row)), row])
        );

        return prev.map((row) => {
          const writeId = getTnOkrugWriteId(row);
          return updatedById.get(String(writeId)) || row;
        });
      });

      setDistrictModes((prev) => {
        const next = { ...prev };
        selectedDistrictsForMode.forEach((districtId) => {
          const key = String(districtId);
          if (selectedDistrictMode === DISTRICT_MODE_EMPTY) {
            delete next[key];
          } else {
            next[key] = selectedDistrictMode;
          }
        });
        return next;
      });

      messageApi.success("Режимы сохранены");
    } catch (error) {
      messageApi.error("Не удалось сохранить режимы");
    } finally {
      setDistrictModeSaving(false);
    }
  };

  const resetDistrictMode = async (districtId) => {
    const key = String(districtId);
    if (!districtModes[key] || resettingDistrictIds.has(key)) return;

    setResettingDistrictIds((prev) => new Set(prev).add(key));

    try {
      const updatedRow = await updateTnOkrugRezim(districtId, DISTRICT_MODE_EMPTY);

      setDistrictModeRows((prev) =>
        prev.map((row) => {
          const writeId = getTnOkrugWriteId(row);
          return String(writeId) === key && updatedRow ? updatedRow : row;
        })
      );

      setDistrictModes((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setSelectedDistrictsForMode((prev) =>
        prev.filter((selectedId) => String(selectedId) !== key)
      );

      messageApi.success("Режим отменён");
    } catch (error) {
      messageApi.error("Не удалось сбросить режим");
    } finally {
      setResettingDistrictIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const assignedDistrictModes = React.useMemo(() => {
    const rowsByWriteId = new Map(
      districtModeRows.map((row) => [String(getTnOkrugWriteId(row)), row])
    );

    return Object.entries(districtModes)
      .map(([districtId, mode]) => ({
        districtId,
        mode,
        name: rowsByWriteId.get(String(districtId))?.name || districtId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [districtModeRows, districtModes]);

  return (
    <>
      {contextHolder}
      <Modal
        title="Режимы округов"
        open={open}
        onCancel={onClose}
        footer={[
          <Button
            key="apply"
            type="primary"
            disabled={!selectedDistrictsForMode.length || districtModeLoading}
            loading={districtModeSaving}
            onClick={applyDistrictMode}
          >
            Применить
          </Button>,
          <Button key="close" disabled={districtModeSaving} onClick={onClose}>
            Закрыть
          </Button>,
        ]}
      >
        <Spin spinning={districtModeLoading}>
          <Flex vertical gap={14}>
            <Flex vertical gap={6}>
              <Typography.Text strong>Городские округа</Typography.Text>
              <Select
                mode="multiple"
                allowClear
                showSearch
                placeholder="Выберите один или несколько округов"
                loading={districtModeLoading}
                disabled={districtModeLoading || districtModeSaving}
                value={selectedDistrictsForMode}
                options={districtModeOptions}
                onChange={setSelectedDistrictsForMode}
                optionFilterProp="label"
                maxTagCount="responsive"
                notFoundContent={
                  districtModeLoading ? <Spin size="small" /> : "Нет данных"
                }
              />
            </Flex>

            <Flex vertical gap={6}>
              <Typography.Text strong>Режим</Typography.Text>
              <Segmented
                block
                options={DISTRICT_MODE_OPTIONS}
                value={selectedDistrictMode}
                disabled={districtModeSaving}
                onChange={setSelectedDistrictMode}
              />
            </Flex>

            <Flex vertical gap={6}>
              <Typography.Text strong>Назначенные режимы</Typography.Text>
              {assignedDistrictModes.length ? (
                <Space wrap>
                  {assignedDistrictModes.map(({ districtId, name, mode }) => (
                    <Tag
                      key={districtId}
                      closable
                      onClose={(event) => {
                        event.preventDefault();
                        resetDistrictMode(districtId);
                      }}
                      style={{
                        ...(DISTRICT_MODE_TAG_STYLES[mode] || {}),
                        opacity: resettingDistrictIds.has(String(districtId)) ? 0.55 : 1,
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
