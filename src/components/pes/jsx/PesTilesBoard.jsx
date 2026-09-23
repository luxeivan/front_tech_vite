// Отрисовка плиток ПЭС с группировкой по филиалам и ПО.
import React, { useMemo } from "react";
import { Tooltip } from "antd";
import { formatPowerKw, STATUS_META } from "../js/pesModuleMeta";
import { buildGroupedPes } from "../js/pesTilesBoard.utils";
import PesTileTooltip from "./PesTileTooltip";

function PesTile({ item, selected, onToggle, selectable }) {
  const status = item?.effectiveStatus || "ready";
  const meta = STATUS_META[status] || STATUS_META.ready;
  const isPriority = Boolean(item?.prioritet);

  const className = [
    "pes-tile",
    `pes-tile--${status}`,
    isPriority ? "pes-tile--priority" : "",
    selected ? "pes-tile--selected" : "",
    selectable ? "" : "pes-tile--disabled",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tooltip
      title={<PesTileTooltip item={item} meta={meta} />}
      overlayClassName="pes-tile-tooltip-overlay"
      placement="top"
      mouseEnterDelay={0.1}
    >
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
          <span className="pes-tile__power">{formatPowerKw(item.powerKw)}</span>
        </div>
      </div>
    </Tooltip>
  );
}

function normalizeBranchName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+филиал$/i, "")
    .replace(/[^а-яa-z0-9]/gi, "");
}

function BranchCard({ branch, selected, onToggle, selectable }) {
  return (
    <div className="pes-branch">
      <div className="pes-branch__title">
        {branch.branch} <span className="pes-branch__count">({branch.count})</span>
      </div>
      {branch.pos.map((p) => (
        <div key={`${branch.branch}__${p.po}`} className="pes-po">
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
  );
}

export default function PesTilesBoard({
  items,
  selected,
  onToggle,
  selectable,
  className = "",
  branchGroups = null,
  showGroupTitles = true,
}) {
  const grouped = useMemo(() => buildGroupedPes(items), [items]);
  const groupedByBranch = useMemo(() => {
    const map = new Map();
    grouped.forEach((branch) => {
      map.set(normalizeBranchName(branch.branch), branch);
    });
    return map;
  }, [grouped]);

  if (Array.isArray(branchGroups) && branchGroups.length) {
    const used = new Set();
    const groups = branchGroups
      .map((group) => {
        const branches = (group.branches || [])
          .map((branchName) => {
            const key = normalizeBranchName(branchName);
            const branch = groupedByBranch.get(key);
            if (branch) used.add(key);
            return branch;
          })
          .filter(Boolean);
        return { ...group, branches };
      })
      .filter((group) => group.branches.length);

    const leftovers = grouped.filter((branch) => !used.has(normalizeBranchName(branch.branch)));
    if (leftovers.length) {
      groups.push({ title: "Прочее", branches: leftovers });
    }

    return (
      <div className={["pes-board", "pes-board--grouped", className].filter(Boolean).join(" ")}>
        {groups.map((group) => (
          <section key={group.title} className="pes-board-group">
            {showGroupTitles && <div className="pes-board-group__title">{group.title}</div>}
            {group.branches.map((branch) => (
              <BranchCard
                key={branch.branch}
                branch={branch}
                selected={selected}
                onToggle={onToggle}
                selectable={selectable}
              />
            ))}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className={["pes-board", className].filter(Boolean).join(" ")}>
      {grouped.map((b) => (
        <BranchCard
          key={b.branch}
          branch={b}
          selected={selected}
          onToggle={onToggle}
          selectable={selectable}
        />
      ))}
    </div>
  );
}
