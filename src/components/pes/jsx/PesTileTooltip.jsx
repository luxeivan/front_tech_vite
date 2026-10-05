import React from "react";
import { PhoneFilled } from "@ant-design/icons";

import { formatDateTime, formatPowerKw } from "../js/pesModuleMeta";
import { isActiveEtaStatus } from "../js/pesEta";

function getDestinationText(item) {
  return (
    item?.destination?.address ||
    item?.destination?.title ||
    item?.destination?.name ||
    "—"
  );
}

function formatEtaMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${Math.max(0, Math.round(n))} мин`;
}

// Сколько минут с момента фактического выезда до сейчас.
function formatEnRouteMinutes(departureAt) {
  const ms = Date.parse(departureAt);
  if (!Number.isFinite(ms)) return "—";
  const minutes = (Date.now() - ms) / 60000;
  return `${Math.max(0, Math.round(minutes))} мин`;
}

export default function PesTileTooltip({ item, meta }) {
  const showEta = isActiveEtaStatus(item?.effectiveStatus);

  return (
    <div className="pes-tile-tooltip">
      <div>
        <b>ПЭС №{item.number}</b>
      </div>
      <div>
        {item.branch || "—"} / {item.po || "—"}
      </div>
      <div>Мощность: {formatPowerKw(item.powerKw)} кВт</div>
      <div className="pes-tile-tooltip__status">Статус: {meta.label}</div>
      <div>Адрес: {getDestinationText(item)}</div>
      <div>Выезд: {formatDateTime(item.actualDepartureAt)}</div>
      {showEta && (
        <div className="pes-tile-tooltip__eta">
          Время до пункта назначения: {formatEtaMinutes(item?.etaMinutes)}
        </div>
      )}
      {item?.actualDepartureAt && (
        <div>Время в пути: {formatEnRouteMinutes(item.actualDepartureAt)}</div>
      )}
      <div>Подключение: {formatDateTime(item.connectedAt)}</div>
      <div>
        <PhoneFilled /> Диспетчер: {item.dispatcherPhone || "—"}
      </div>
    </div>
  );
}
