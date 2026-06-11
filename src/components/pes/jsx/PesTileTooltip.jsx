import React from "react";
import { PhoneFilled } from "@ant-design/icons";

import { formatDateTime, formatPowerKw } from "../js/pesModuleMeta";

function getDestinationText(item) {
  return (
    item?.destination?.address ||
    item?.destination?.title ||
    item?.destination?.name ||
    "—"
  );
}

export default function PesTileTooltip({ item, meta }) {
  return (
    <div className="pes-tile-tooltip">
      <div>
        <b>ПЭС №{item.number}</b>
      </div>
      <div>
        {item.branch || "—"} / {item.po || "—"}
      </div>
      <div>Мощность: {formatPowerKw(item.powerKw)} кВт</div>
      <div>Статус: {meta.label}</div>
      <div>Адрес: {getDestinationText(item)}</div>
      <div>Выезд: {formatDateTime(item.actualDepartureAt)}</div>
      <div>Подключение: {formatDateTime(item.connectedAt)}</div>
      <div>
        <PhoneFilled /> Диспетчер: {item.dispatcherPhone || "—"}
      </div>
    </div>
  );
}
