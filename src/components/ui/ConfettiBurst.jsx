// /src/components/ui/ConfettiBurst.jsx
import React, { useEffect, useRef } from "react";

const prefersReduce =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

/** Небольшой «всплеск» точек на animejs — для успешного ответа ИИ. */
export default function ConfettiBurst({ color = "#e37021", count = 12 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (prefersReduce) return;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import("animejs");
        if (cancelled) return;
        const anime = mod?.default || mod?.anime || mod;
        const el = ref.current;
        if (!el) return;
        const dots = [...el.querySelectorAll(".cb-dot")];

        anime({
          targets: dots,
          translateX: () => (Math.random() - 0.5) * 120,
          translateY: () => (Math.random() - 0.5) * 80,
          scale: [
            { value: 1, duration: 0 },
            { value: 0, duration: 700 },
          ],
          opacity: [
            { value: 1, duration: 0 },
            { value: 0, duration: 700 },
          ],
          easing: "easeOutCubic",
          delay: anime.stagger(15),
          complete: () => el?.parentNode?.removeChild?.(el),
        });
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: "50%",
        bottom: 72,
        transform: "translateX(-50%)",
        pointerEvents: "none",
      }}
    >
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="cb-dot"
          style={{
            position: "absolute",
            width: 6,
            height: 6,
            borderRadius: 6,
            background: color,
            left: 0,
            top: 0,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}
