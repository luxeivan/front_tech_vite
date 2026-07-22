import React from "react";
import { Link, useParams } from "react-router-dom";

import { getOperationalFilialRouteBySlug } from "../../utils/operationalFilialRoutes";
import "./OperationalFilialPage.css";

export default function OperationalFilialPage() {
  const { filialSlug } = useParams();
  const filialRoute = getOperationalFilialRouteBySlug(filialSlug);

  return (
    <section className="operational-filial-page">
      <header className="operational-filial-page__header">
        <Link to="/dashboard-oo">Назад к дашборду</Link>
        <h1>{filialRoute?.name || "Филиал"}</h1>
      </header>
      <div className="operational-filial-page__body" />
    </section>
  );
}
