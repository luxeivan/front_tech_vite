import React from "react";
import { motion } from "framer-motion";
import styles from "./Portal404.module.css";

const allPaths = [
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
  "M138.1,59.7c50.2,0,91,40.5,91,90.4s-40.8,90.4-91,90.4s-91-40.5-91-90.4S87.8,59.7,138.1,59.7z M138.1,78.4 c-39.9,0-72.2,32.1-72.2,71.7s32.3,71.8,72.2,71.8s72.2-32.2,72.2-71.8S177.9,78.4,138.1,78.4z",
];

const petals = allPaths.slice(0, -1);

export default function Portal404() {
  return (
    <div className={styles.container}>
      <div className={styles.visualRow}>
        <motion.span
          className={styles.digit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.6 }}
        >
          4
        </motion.span>
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 275.8 300.5"
          className={styles.item}
        >
          {petals.map((d, i) => (
            <motion.path
              key={i}
              d={d}
              fill="#e37021"
              initial={{ pathLength: 1, opacity: 1 }}
              animate={{ pathLength: 0, opacity: 0 }}
              transition={{ duration: 2, ease: "easeInOut" }}
            />
          ))}
          <circle
            cx="138.1"
            cy="150.1"
            r="90.4"
            fill="none"
            stroke="#e37021"
            strokeWidth="14"
          />
        </motion.svg>
        <motion.span
          className={styles.digit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.6 }}
        >
          4
        </motion.span>
      </div>
      <motion.div
        className={styles.tagline}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5, duration: 1 }}
      >
        <p>
          Разработчик нового портала аварийных отключений «МосОблЭнерго»
          трудится в поте лица, чтобы вы скорее могли потыкать все кнопочки и
          пощупать функционал нашего нового сайта! 🚫🔌
        </p>
      </motion.div>
    </div>
  );
}
