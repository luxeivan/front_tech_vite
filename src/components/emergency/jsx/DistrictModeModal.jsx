import { Button, Modal, message } from "antd";
import React from "react";
import BrandSunLoader from "../../ui/BrandSunLoader";
import useAuth from "../../../stores/useAuth";
import { logAuditEvent } from "../../../utils/auditLogger";
import {
  fetchTnFilialyModeRows,
  formatTnFilialyName,
  getTnFilialyWriteId,
  notifyTnFilialyRezimUpdated,
  updateTnFilialyRezim,
} from "../../../utils/tnFilialyApi";
import "../css/DistrictModeModal.css";

const DISTRICT_MODE_EMPTY = "bez_rezhima";
const DISTRICT_MODE_LABELS = {
  [DISTRICT_MODE_EMPTY]: "Без режима",
  rpg: "РПГ",
  orr: "ОРР",
};

const buildFilialModesFromRows = (rows) =>
  (Array.isArray(rows) ? rows : []).reduce((acc, row) => {
    const writeId = getTnFilialyWriteId(row);
    if (!writeId) return acc;
    if (!row?.rezim || row.rezim === DISTRICT_MODE_EMPTY) return acc;
    acc[String(writeId)] = row.rezim;
    return acc;
  }, {});

const getModeLabel = (mode) => DISTRICT_MODE_LABELS[mode] || mode || "Без режима";

const buildAuditFilials = (rows, filialIds) => {
  const rowsByWriteId = new Map(
    (Array.isArray(rows) ? rows : [])
      .map((row) => [String(getTnFilialyWriteId(row)), row])
      .filter(([writeId]) => writeId)
  );

  return (Array.isArray(filialIds) ? filialIds : []).map((filialId) => {
    const row = rowsByWriteId.get(String(filialId));
    return {
      id: String(filialId),
      name: formatTnFilialyName(row?.name) || String(filialId),
    };
  });
};

export default function DistrictModeModal({ open, onClose }) {
  const user = useAuth((store) => store.user);
  const [messageApi, contextHolder] = message.useMessage();
  const [filialModeRows, setFilialModeRows] = React.useState([]);
  const [filialModeLoading, setFilialModeLoading] = React.useState(false);
  const [savingFilialIds, setSavingFilialIds] = React.useState(new Set());
  const [filialModes, setFilialModes] = React.useState({});

  React.useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setFilialModeLoading(true);

    fetchTnFilialyModeRows()
      .then((rows) => {
        if (cancelled) return;
        setFilialModeRows(rows);
        setFilialModes(buildFilialModesFromRows(rows));
      })
      .catch(() => {
        if (cancelled) return;
        setFilialModeRows([]);
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

  const visibleFilialRows = React.useMemo(() => {
    return filialModeRows
      .filter((row) => row?.name && getTnFilialyWriteId(row))
      .slice()
      .sort((a, b) =>
        formatTnFilialyName(a.name).localeCompare(formatTnFilialyName(b.name), "ru")
      );
  }, [filialModeRows]);

  const saveFilialMode = async (filialId, mode) => {
    const key = String(filialId);
    const currentMode = filialModes[key] || DISTRICT_MODE_EMPTY;
    const nextMode = currentMode === mode ? DISTRICT_MODE_EMPTY : mode;
    if (savingFilialIds.has(key)) return;

    setSavingFilialIds((prev) => new Set(prev).add(key));

    try {
      const updatedRow = await updateTnFilialyRezim(filialId, nextMode);

      setFilialModeRows((prev) =>
        prev.map((row) => {
          const writeId = getTnFilialyWriteId(row);
          return String(writeId) === key && updatedRow ? updatedRow : row;
        })
      );

      setFilialModes((prev) => {
        const next = { ...prev };
        if (nextMode === DISTRICT_MODE_EMPTY) {
          delete next[key];
        } else {
          next[key] = nextMode;
        }
        return next;
      });

      notifyTnFilialyRezimUpdated({
        action: nextMode === DISTRICT_MODE_EMPTY ? "reset" : "set",
        filialIds: [filialId],
        rezim: nextMode,
      });

      await logAuditEvent(
        {
          action:
            nextMode === DISTRICT_MODE_EMPTY ? "filial_mode_reset" : "filial_mode_set",
          entity: "tn_filialy_rezim",
          entity_id: key,
          details: {
            filial_ids: [key],
            filials: buildAuditFilials(
              [...filialModeRows, updatedRow].filter(Boolean),
              [filialId]
            ),
            mode: nextMode,
            mode_label: getModeLabel(nextMode),
            previous_mode: currentMode,
            previous_mode_label: getModeLabel(currentMode),
            applied_count: 1,
            failed_count: 0,
          },
        },
        user
      );

      messageApi.success(
        nextMode === DISTRICT_MODE_EMPTY ? "Режим отменён" : "Режим сохранён"
      );
    } catch {
      messageApi.error("Не удалось сохранить режим");
    } finally {
      setSavingFilialIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const renderModeButton = (row, mode) => {
    const writeId = getTnFilialyWriteId(row);
    const key = String(writeId);
    const activeMode = filialModes[key];
    const isActive = activeMode === mode;
    const isSaving = savingFilialIds.has(key);
    const modeLabel = getModeLabel(mode);
    const filialName = formatTnFilialyName(row?.name);

    return (
      <Button
        className={[
          "district-mode-modal__mode-button",
          isActive ? `district-mode-modal__mode-button--${mode}` : "",
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={!writeId || filialModeLoading || isSaving}
        title={
          isActive
            ? `Снять режим ${modeLabel}: ${filialName}`
            : `Ввести режим ${modeLabel}: ${filialName}`
        }
        onClick={() => saveFilialMode(writeId, mode)}
      >
        {isSaving ? <BrandSunLoader size={18} ariaLabel="Сохраняем режим" /> : "Ввести"}
      </Button>
    );
  };

  return (
    <>
      {contextHolder}
      <Modal
        title="Выберите филиал"
        open={open}
        onCancel={onClose}
        footer={null}
        centered
        width={780}
        className="district-mode-modal"
      >
        {filialModeLoading ? (
          <div className="district-mode-modal__loader">
            <BrandSunLoader size={56} text="Загружаем филиалы" />
          </div>
        ) : (
          <div className="district-mode-modal__table" role="table">
            <div
              className="district-mode-modal__row district-mode-modal__row--header"
              role="row"
            >
              <div role="columnheader">Филиал</div>
              <div role="columnheader">РПГ</div>
              <div role="columnheader">ОРР</div>
            </div>

            {visibleFilialRows.map((row) => {
              const writeId = getTnFilialyWriteId(row);
              return (
                <div className="district-mode-modal__row" role="row" key={writeId}>
                  <div className="district-mode-modal__filial-name" role="cell">
                    {formatTnFilialyName(row.name)}
                  </div>
                  <div className="district-mode-modal__mode-cell" role="cell">
                    {renderModeButton(row, "rpg")}
                  </div>
                  <div className="district-mode-modal__mode-cell" role="cell">
                    {renderModeButton(row, "orr")}
                  </div>
                </div>
              );
            })}

            {!filialModeLoading && !visibleFilialRows.length ? (
              <div className="district-mode-modal__empty">Филиалы не найдены</div>
            ) : null}
          </div>
        )}
      </Modal>
    </>
  );
}
