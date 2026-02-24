import React from "react";

// Линейный мини-график 7-точечной динамики.
export default function Sparkline7({ points }) {
  const w = 900;
  const h = 120;
  const padX = 24;
  const padY = 22;
  const max = Math.max(1, ...points.map((p) => Number(p.total || 0)));
  const step = points.length > 1 ? (w - 2 * padX) / (points.length - 1) : 0;

  const xy = points.map((p, i) => {
    if (p.total == null) return null;
    return [padX + i * step, h - padY - (h - 2 * padY) * (p.total / max)];
  });

  const poly = xy.map((p) => p?.join(",")).filter(Boolean).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 140 }}>
      <polyline points={poly} fill="none" stroke="#ff4d4f" strokeWidth="2" />
      {xy.map((pt, i) => {
        if (!pt) return null;
        const [x, y] = pt;
        const p = points[i];
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="4" fill="#ff4d4f">
              <title>{`${p.label.toUpperCase()}: всего ${p.total}\n— открыто: ${p.opened}\n— закрыто: ${p.closed}\n— удалено: ${p.deleted}`}</title>
            </circle>
            <text x={x} y={y - 8} fontSize="12" textAnchor="middle" fill="#595959">
              {p.total}
            </text>
            <text x={x} y={h - 8} fontSize="12" textAnchor="middle" fill="#8c8c8c">
              {p.label}
            </text>
          </g>
        );
      })}
      <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} stroke="#f0f0f0" />
    </svg>
  );
}
