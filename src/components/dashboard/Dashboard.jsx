import React from "react";
import { Typography } from "antd";
import dayjs from "dayjs";

export default function Dashboard() {
  const now = dayjs().format("DD.MM.YYYY, HH:mm:ss");

  return (
    <div style={{ textAlign: "center" }}>
      <Typography.Title level={2} style={{ textTransform: "uppercase", color: "blue" }}>
        ТЕХНОЛОГИЧЕСКИЕ НАРУШЕНИЯ В ЭЛЕКТРИЧЕСКИХ СЕТЯХ АО «МОСОБЛЭНЕРГО»
      </Typography.Title>
      <Typography.Paragraph>
        По состоянию на {now}
      </Typography.Paragraph>
    </div>
  );
}
