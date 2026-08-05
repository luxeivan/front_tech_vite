import React from "react";
import { Link } from "react-router-dom";
import { Steps } from "antd";

export default function OperationalNavigationSteps({
  basePath = "/dashboard-oo",
  filialPath = "",
  filialName = "",
  poName = "",
  className = "",
}) {
  const baseSteps = [
    {
      icon: <span className="operational-navigation-steps__empty-icon" />,
      title: (
        <Link className="operational-navigation-steps__link" to={basePath}>
          АО «Мособлэнерго»
        </Link>
      ),
    },
    {
      icon: <span className="operational-navigation-steps__empty-icon" />,
      title:
        poName && filialPath ? (
          <Link className="operational-navigation-steps__link" to={filialPath}>
            {filialName || "Филиал"}
          </Link>
        ) : (
          filialName || "Филиал"
        ),
    },
  ];

  if (poName) {
    baseSteps.push({
      icon: <span className="operational-navigation-steps__empty-icon" />,
      title: poName,
    });
  }

  const currentStep = baseSteps.length - 1;
  const steps = baseSteps.map((step, index) => ({
    ...step,
    status: index < currentStep ? "finish" : "process",
  }));

  return (
    <Steps
      className={["operational-navigation-steps", className].filter(Boolean).join(" ")}
      current={steps.length - 1}
      direction="horizontal"
      items={steps}
      responsive={false}
      size="small"
    />
  );
}
