export const PRIORITY_PES_NUMBERS = new Set([
  "001", "025", "038", "060", "062", "071", "074", "076", "077", "081",
  "085", "086", "105", "106", "107", "109", "110", "111", "112", "114",
  "117", "120", "121", "122", "123", "124", "125", "126", "127", "128",
  "129", "130", "132", "133", "134", "138", "139", "140", "142", "143",
  "144",
]);

function normPesNumber(v) {
  const s = String(v || "").replace(/\D+/g, "");
  return s ? s.padStart(3, "0") : "";
}

function priorityRank(item) {
  const isPriority = PRIORITY_PES_NUMBERS.has(normPesNumber(item?.number));
  const status = String(item?.effectiveStatus || item?.status || "ready");
  if (isPriority && status === "ready") return 0;
  if (status === "ready") return 1;
  if (isPriority) return 2;
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
