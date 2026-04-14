import { useEffect, useMemo, useState } from "react";
import { Typography, theme } from "antd";
import { motion } from "framer-motion";
import { POST_AUTH_SPLASH_TIMING } from "../../config/postAuthSplashConfig";
import styles from "./PostAuthSplash.module.css";

const sunPaths = [
  "M137.6,0.1L157,53.7h-6.6l-12.9-30l-12.9,30h-6.6L137.6,0.1z",
  "M73.2,21.6l36.7,35.8l-5.3,2.6L82.4,40.7l1.3,29.2l-5.3,2.6L73.2,21.6z",
  "M27.1,63l42.9,14.7l-3.2,4l-25-7l12.2,22.7l-3.2,4L27.1,63z",
  "M1.8,117.3l42.9-4.7l-1.2,5l-23.4,4.2l18.5,15.5l-1.3,5L1.8,117.3z",
  "M205.1,22.4L168,57.8l5.2,2.6l22.4-19l-1.7,29.2l5.2,2.6L205.1,22.4z",
  "M249.5,63l-42.9,14.7l3.2,4l25-7l-12.2,22.8l3.2,4L249.5,63z",
  "M274.1,114.8l-42.9-3.9l1.3,5l23.5,3.8l-18.2,15.8l1.3,5L274.1,114.8z",
  "M137.6,300.1l19.4-53.6h-6.6l-12.9,30l-12.9-30h-6.6L137.6,300.1z",
  "M75.6,279.8l36.1-36.4l-5.4-2.5l-21.8,19.7l0.8-29.2l-5.3-2.5L75.6,279.8z",
  "M24.3,233.8l43.3-13.3l-3.1-4.1l-25.1,6.2l12.9-22.3l-3.1-4.1L24.3,233.8z",
  "M201,279.8l-36.1-36.4l5.3-2.5l21.8,19.7l-0.8-29.2l5.3-2.5L201,279.8z",
  "M252.1,234.1l-43.3-13.5l3.1-4.1l25.2,6.3l-12.9-22.4l3.1-4.1L252.1,234.1z",
  "M275.5,180.2l-42.8,5.6l1.1-5l23.3-4.7l-18.8-15.1l1.1-5.1L275.5,180.2z",
  "M0.7,178.2l42.7,6.2l-1.1-5l-23.2-5l19-14.8l-1.1-5L0.7,178.2z",
  "M138.1,59.7c50.2,0,91,40.5,91,90.4s-40.8,90.4-91,90.4s-91-40.5-91-90.4S87.8,59.7,138.1,59.7L138.1,59.7z M138.1,78.4 c-39.9,0-72.2,32.1-72.2,71.7s32.3,71.8,72.2,71.8s72.2-32.2,72.2-71.8S177.9,78.4,138.1,78.4z",
];

const sunPathAnimation = {
  hidden: {
    opacity: 0,
    pathLength: 0,
    fill: "rgba(227, 112, 33, 0)",
  },
  visible: {
    opacity: 1,
    pathLength: 1,
    fill: "rgba(227, 112, 33, 1)",
  },
};

const splashText = "Добро пожаловать в «Модуль коммуникаций и мониторинга отключений»";

export default function PostAuthSplash({ onDone }) {
  const { colorPrimary } = theme.useToken().token;
  const [typedLength, setTypedLength] = useState(0);
  const typingIntervalMs = useMemo(() => {
    const availableTypingTimeMs = Math.max(
      POST_AUTH_SPLASH_TIMING.TOTAL_DURATION_MS -
        POST_AUTH_SPLASH_TIMING.TYPE_START_DELAY_MS -
        POST_AUTH_SPLASH_TIMING.AFTER_TYPING_BUFFER_MS,
      300
    );
    const perChar = Math.floor(availableTypingTimeMs / splashText.length);
    return Math.min(
      POST_AUTH_SPLASH_TIMING.TYPE_INTERVAL_MAX_MS,
      Math.max(POST_AUTH_SPLASH_TIMING.TYPE_INTERVAL_MIN_MS, perChar)
    );
  }, []);

  useEffect(() => {
    const textStartDelayMs = POST_AUTH_SPLASH_TIMING.TYPE_START_DELAY_MS;
    let intervalId;

    const startTimerId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        setTypedLength((prev) => {
          if (prev >= splashText.length) {
            window.clearInterval(intervalId);
            return prev;
          }
          return prev + 1;
        });
      }, typingIntervalMs);
    }, textStartDelayMs);

    return () => {
      window.clearTimeout(startTimerId);
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [typingIntervalMs]);

  useEffect(() => {
    if (!onDone) return;
    const finishTimerId = window.setTimeout(() => {
      onDone();
    }, POST_AUTH_SPLASH_TIMING.TOTAL_DURATION_MS);

    return () => {
      window.clearTimeout(finishTimerId);
    };
  }, [onDone]);

  const typedText = useMemo(() => splashText.slice(0, typedLength), [typedLength]);

  return (
    <div className={styles.container}>
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 275.8 300.5"
        className={styles.sun}
      >
        {sunPaths.map((path, index) => (
          <motion.path
            key={index}
            d={path}
            variants={sunPathAnimation}
            initial="hidden"
            animate="visible"
            transition={{
              default: {
                duration: POST_AUTH_SPLASH_TIMING.SUN_ANIMATION_MS / 1000,
                ease: "easeInOut",
              },
              fill: {
                duration: POST_AUTH_SPLASH_TIMING.SUN_ANIMATION_MS / 1000,
                ease: [1, 0, 0.8, 1],
                delay: POST_AUTH_SPLASH_TIMING.SUN_FILL_DELAY_MS / 1000,
              },
            }}
          />
        ))}
      </motion.svg>

      <motion.div
        className={styles.textWrap}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          ease: "easeOut",
          duration: POST_AUTH_SPLASH_TIMING.TEXT_REVEAL_DURATION_MS / 1000,
          delay: POST_AUTH_SPLASH_TIMING.TEXT_REVEAL_DELAY_MS / 1000,
        }}
      >
        <Typography.Title
          level={3}
          className={styles.text}
          style={{ color: colorPrimary }}
        >
          {typedText}
          <span className={styles.cursor}>|</span>
        </Typography.Title>
      </motion.div>
    </div>
  );
}
