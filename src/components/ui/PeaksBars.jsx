// /src/components/ui/PeaksBars.jsx
import React, { useEffect, useRef } from "react";

const prefersReduce =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

/**
 * Мини-барчарт «Пиковые часы» — анимируется через animejs.
 * props: data [{hour, count}], color, height
 */
export default function PeaksBars({
  data = [],
  color = "#e37021",
  height = 90,
}) {
  const wrapRef = useRef(null);
  const max = Math.max(1, ...data.map((d) => d.count));

  useEffect(() => {
    if (prefersReduce) return;

    let cancelled = false;
    (async () => {
      try {
        const mod = await import("animejs");
        if (cancelled) return;
        const anime = mod?.default || mod?.anime || mod;
        const bars = wrapRef.current?.querySelectorAll(".pb-bar") || [];
        anime({
          targets: bars,
          scaleY: [
            { value: 0, duration: 0 },
            { value: 1, duration: 650, easing: "easeOutCubic" },
          ],
          opacity: [
            { value: 0, duration: 0 },
            { value: 1, duration: 380, easing: "linear" },
          ],
          delay: anime.stagger(60),
          transformOrigin: "bottom",
        });
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  return (
    <div
      ref={wrapRef}
      style={{ display: "flex", alignItems: "end", gap: 6, height }}
    >
      {data.map(({ hour, count }) => {
        const h = Math.round((count / max) * height) || 2;
        return (
          <div key={hour} style={{ textAlign: "center" }}>
            <div
              className="pb-bar"
              style={{
                width: 14,
                height: h,
                borderRadius: 6,
                background: color,
                boxShadow: "0 2px 10px rgba(227,112,33,.22)",
                transform: "scaleY(1)",
                opacity: 1,
              }}
              title={`${hour}:00 — ${count}`}
            />
            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.8 }}>
              {hour}
            </div>
          </div>
        );
      })}
    </div>
  );
}
