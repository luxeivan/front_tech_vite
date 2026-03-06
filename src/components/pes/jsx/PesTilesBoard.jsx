// Отрисовка плиток ПЭС с группировкой по филиалам и ПО.
import React, { useMemo } from "react";
import { Tooltip } from "antd";
import { formatPowerKw, STATUS_META } from "../js/pesModuleMeta";
import { buildGroupedPes, PRIORITY_PES_NUMBERS } from "../js/pesTilesBoard.utils";

function PesTile({ item, selected, onToggle, selectable }) {
  const status = item?.effectiveStatus || "ready";
  const meta = STATUS_META[status] || STATUS_META.ready;
  const numberKey = String(item?.number || "").replace(/\D+/g, "").padStart(3, "0");
  const isPriority = PRIORITY_PES_NUMBERS.has(numberKey);

  const className = [
    "pes-tile",
    `pes-tile--${status}`,
    isPriority ? "pes-tile--priority" : "",
    selected ? "pes-tile--selected" : "",
    selectable ? "" : "pes-tile--disabled",
  ]
    .filter(Boolean)
    .join(" ");

  const tooltip = (
    <div className="pes-tile-tooltip">
      <div>
        <b>ПЭС №{item.number}</b>
      </div>
      <div>{item.name || "—"}</div>
      <div>
        {item.branch || "—"} / {item.po || "—"}
      </div>
      <div>Мощность: {formatPowerKw(item.powerKw)} кВт</div>
      <div>Телефон диспетчера: {item.dispatcherPhone || "—"}</div>
      <div>Статус: {meta.label}</div>
      {isPriority ? <div>Приоритет: да</div> : null}
    </div>
  );

  return (
    <Tooltip title={tooltip} placement="top" mouseEnterDelay={0.1}>
      <div
        className={className}
        role={selectable ? "button" : "group"}
        tabIndex={selectable ? 0 : -1}
        onClick={() => {
          if (!selectable) return;
          onToggle(item.id);
        }}
        onKeyDown={(e) => {
          if (!selectable) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle(item.id);
          }
        }}
      >
        <div className="pes-tile__top">
          <span className="pes-tile__number">№{item.number}</span>
          <span className="pes-tile__power">{formatPowerKw(item.powerKw)}кВт</span>
        </div>
      </div>
    </Tooltip>
  );
}

export default function PesTilesBoard({ items, selected, onToggle, selectable }) {
  const grouped = useMemo(() => buildGroupedPes(items), [items]);
  return (
    <div className="pes-board">
      {grouped.map((b) => (
        <div key={b.branch} className="pes-branch">
          <div className="pes-branch__title">
            {b.branch} <span className="pes-branch__count">({b.count})</span>
          </div>
          {b.pos.map((p) => (
            <div key={`${b.branch}__${p.po}`} className="pes-po">
              <div className="pes-po__title">{p.po}</div>
              <div className="pes-tiles">
                {p.items.map((it) => (
                  <PesTile
                    key={it.id}
                    item={it}
                    selected={selected.includes(it.id)}
                    onToggle={onToggle}
                    selectable={selectable}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
