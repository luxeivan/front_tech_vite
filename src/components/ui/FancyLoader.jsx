// /src/components/ui/FancyLoader.jsx
import React, { useEffect, useMemo, useRef } from "react";

// Пытаемся аккуратно подключить animejs (если есть) — но без зависимости,
// основной спин крутится на чистом CSS.
let animeMaybe = null;
try {
  // разные билды пакета ведут себя по-разному, нормализуем
  // eslint-disable-next-line import/no-unresolved
  const mod = await import(/* @vite-ignore */ "animejs");
  animeMaybe =
    mod?.default || mod?.anime || (typeof mod === "function" ? mod : null);
} catch (_) {
  // не страшно — живём на CSS
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// Глобально один раз втыкаем keyframes
function ensureKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById("fancy-loader-kf")) return;
  const style = document.createElement("style");
  style.id = "fancy-loader-kf";
  style.textContent = `
  @keyframes fl-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
  @keyframes fl-pulse { 
    0% { transform: scale(.6); opacity: .35 } 
    50% { transform: scale(1.15); opacity: 1 } 
    100% { transform: scale(.6); opacity: .35 } 
  }
  @keyframes fl-dash {
    0%   { stroke-dashoffset: var(--fl-len, 360) }
    50%  { stroke-dashoffset: calc(var(--fl-len, 360) * .25) }
    100% { stroke-dashoffset: 0 }
  }`;
  document.head.appendChild(style);
}

/**
 * props:
 * - variant: "orbit" | "ring"
 * - color: CSS color
 * - size: px
 */
export default function FancyLoader({
  variant = "orbit",
  color = "#e37021",
  size = 140,
  ariaLabel = "Загрузка",
}) {
  const wrapRef = useRef(null);
  const dotsRef = useRef([]);
  const ringRef = useRef(null);

  // сбрасываем массив рефов перед отрисовкой точек
  dotsRef.current = [];

  const s = useMemo(() => {
    const d = clamp(size, 96, 220);
    return {
      box: d,
      dot: Math.max(6, Math.floor(d / 18)),
      ringStroke: Math.max(4, Math.floor(d / 28)),
      radius: Math.floor(d / 2.8),
    };
  }, [size]);

  useEffect(() => {
    ensureKeyframes();

    // CSS-анимации и так работают. Ниже — опциональный апгрейд через animejs.
    if (!animeMaybe) return;

    // очищаем прежние анимации
    animeMaybe.remove(wrapRef.current);
    animeMaybe.remove(dotsRef.current);
    animeMaybe.remove(ringRef.current);

    if (variant === "orbit") {
      // Плавное вращение контейнера (поверх CSS — не конфликтует)
      animeMaybe({
        targets: wrapRef.current,
        rotate: "1turn",
        duration: 2400,
        easing: "linear",
        loop: true,
      });

      // Поочерёдное пульсирование точек (стягиваем с CSS, делаем чуть богаче)
      animeMaybe({
        targets: dotsRef.current,
        scale: [
          { value: 0.6, duration: 0 },
          { value: 1.15, duration: 420, easing: "easeOutQuad" },
          { value: 0.6, duration: 580, easing: "easeInQuad" },
        ],
        opacity: [
          { value: 0.35, duration: 0 },
          { value: 1, duration: 420, easing: "easeOutQuad" },
          { value: 0.35, duration: 580, easing: "easeInQuad" },
        ],
        delay: animeMaybe.stagger(80),
        loop: true,
      });
    } else if (variant === "ring") {
      const len =
        ringRef.current?.getTotalLength?.() ??
        Math.round(2 * Math.PI * s.radius);

      ringRef.current.style.setProperty("--fl-len", `${len}`);
      ringRef.current.style.strokeDasharray = `${len}`;
      ringRef.current.style.strokeDashoffset = `${len}`;

      animeMaybe
        .timeline({ loop: true })
        .add({
          targets: ringRef.current,
          strokeDashoffset: [len, len * 0.25],
          duration: 900,
          easing: "easeInOutQuad",
        })
        .add({
          targets: ringRef.current,
          strokeDashoffset: [len * 0.25, 0],
          duration: 900,
          easing: "easeInOutQuad",
        });

      animeMaybe({
        targets: wrapRef.current,
        scale: [
          { value: 1.03, duration: 800 },
          { value: 1, duration: 800 },
        ],
        easing: "easeInOutSine",
        loop: true,
      });
    }

    return () => {
      if (!animeMaybe) return;
      animeMaybe.remove(wrapRef.current);
      animeMaybe.remove(dotsRef.current);
      animeMaybe.remove(ringRef.current);
    };
  }, [variant, s]);

  if (variant === "ring") {
    const circumference = Math.round(2 * Math.PI * s.radius);
    return (
      <div
        ref={wrapRef}
        role="status"
        aria-label={ariaLabel}
        style={{
          width: s.box,
          height: s.box,
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg
          width={s.box}
          height={s.box}
          viewBox={`0 0 ${s.box} ${s.box}`}
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={color} stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* Фон-кольцо */}
          <circle
            cx={s.box / 2}
            cy={s.box / 2}
            r={s.radius}
            fill="none"
            stroke="rgba(0,0,0,0.06)"
            strokeWidth={s.ringStroke}
          />

          {/* Анимируемое кольцо: CSS fallback + возможный апгрейд через animejs */}
          <circle
            ref={ringRef}
            cx={s.box / 2}
            cy={s.box / 2}
            r={s.radius}
            fill="none"
            stroke="url(#ringGrad)"
            strokeLinecap="round"
            strokeWidth={s.ringStroke}
            style={{
              // CSS-fallback (работает всегда)
              ["--fl-len"]: `${circumference}`,
              strokeDasharray: circumference,
              strokeDashoffset: circumference,
              animation: "fl-dash 1.8s ease-in-out infinite",
            }}
          />
        </svg>
      </div>
    );
  }

  // variant === "orbit"
  const DOTS = 12;
  const angleStep = (Math.PI * 2) / DOTS;

  return (
    <div
      ref={wrapRef}
      role="status"
      aria-label={ariaLabel}
      style={{
        position: "relative",
        width: s.box,
        height: s.box,
        filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.12))",
        // CSS-вращение контейнера — видно сразу
        animation: "fl-spin 2.4s linear infinite",
      }}
    >
      {[...Array(DOTS)].map((_, i) => {
        const angle = i * angleStep;
        const x = s.box / 2 + s.radius * Math.cos(angle);
        const y = s.box / 2 + s.radius * Math.sin(angle);
        return (
          <div
            key={i}
            ref={(el) => (dotsRef.current[i] = el)}
            style={{
              position: "absolute",
              left: x - s.dot / 2,
              top: y - s.dot / 2,
              width: s.dot,
              height: s.dot,
              borderRadius: s.dot,
              background: color,
              boxShadow: "0 0 12px rgba(227,112,33,0.55)",
              // CSS-пульс с рассинхроном по окружности
              animation: "fl-pulse 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.08}s`,
            }}
          />
        );
      })}
      {/* центральная точка для объёма */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: s.dot * 1.2,
          height: s.dot * 1.2,
          borderRadius: 999,
          background: color,
          transform: "translate(-50%,-50%)",
          opacity: 0.15,
        }}
      />
    </div>
  );
}
