function isPriority(item) {
  return Boolean(item?.prioritet);
}

function priorityRank(item) {
  const priority = isPriority(item);
  const status = String(item?.effectiveStatus || item?.status || "ready");
  if (priority && status === "ready") return 0;
  if (status === "ready") return 1;
  if (priority) return 2;
  return 3;
}

// Сортировка ПЭС по номеру (число, затем строка).
export function sortPesNumber(a, b) {
  const pr = priorityRank(a) - priorityRank(b);
  if (pr !== 0) return pr;
  const an = Number.parseInt(String(a?.number || ""), 10);
  const bn = Number.parseInt(String(b?.number || ""), 10);
  if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
  return String(a?.number || "").localeCompare(String(b?.number || ""), "ru");
}

// Группировка списка ПЭС: филиал -> ПО -> плитки.
export function buildGroupedPes(items) {
  const byBranch = new Map();
  for (const it of items) {
    const branch = it.branch || "—";
    const po = it.po || "—";
    if (!byBranch.has(branch)) byBranch.set(branch, new Map());
    const byPo = byBranch.get(branch);
    if (!byPo.has(po)) byPo.set(po, []);
    byPo.get(po).push(it);
  }

  return Array.from(byBranch.entries())
    .sort(([a], [b]) => a.localeCompare(b, "ru"))
    .map(([branch, poMap]) => {
      const pos = Array.from(poMap.entries())
        .sort(([a], [b]) => a.localeCompare(b, "ru"))
        .map(([po, list]) => ({
          po,
          items: [...list].sort(sortPesNumber),
        }));
      const count = pos.reduce((acc, x) => acc + x.items.length, 0);
      return { branch, pos, count };
    });
}
