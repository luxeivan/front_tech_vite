// /src/components/ui/CountUp.jsx
import React, { useEffect, useRef, useState } from "react";

const prefersReduce =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

/**
 * Плавный счётчик на animejs.
 * props:
 *  - value: число
 *  - duration: мс (по умолчанию 900)
 *  - format: (n:number) => ReactNode (по умолчанию Math.round(n))
 */
export default function CountUp({
  value = 0,
  duration = 900,
  format = (n) => Math.round(n).toString(),
  easing = "easeOutCubic",
}) {
  const [out, setOut] = useState(Number(value) || 0);
  const fromRef = useRef(Number(value) || 0);
  const animRef = useRef(null);

  useEffect(() => {
    const to = Number(value) || 0;
    const from = fromRef.current || 0;

    if (prefersReduce || duration <= 0 || Math.abs(to - from) < 1e-4) {
      setOut(to);
      fromRef.current = to;
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const mod = await import("animejs");
        if (cancelled) return;
        const anime = mod?.default || mod?.anime || mod;

        animRef.current && anime.remove(animRef.current);
        const obj = { val: from };
        animRef.current = obj;

        anime({
          targets: obj,
          val: to,
          duration,
          easing,
          update: () => setOut(obj.val),
          complete: () => (fromRef.current = to),
        });
      } catch {
        // если animejs не подтянулся — просто выставим конечное
        setOut(to);
        fromRef.current = to;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [value, duration, easing]);

  return <span>{format(out)}</span>;
}
