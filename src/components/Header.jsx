import { Button, Drawer, Flex, Image } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useAuth from "../stores/useAuth";
import { logAuditEvent } from "../utils/auditLogger";
import { hasFeatureAccess } from "../config/viewRoleAccess";
import logo from "../img/logoBlue.svg";
import styles from "./Header.module.css";

export default function Header() {
  const { isAuth, exit, user } = useAuth((store) => store);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const canSeeAuditLogs = hasFeatureAccess(user?.view_role, "auditLogging");
  const displayName =
    user?.fullName ||
    user?.username ||
    (user?.email ? user.email.split("@")[0] : null) ||
    "Пользователь";

  const goTo = (path, action) => {
    logAuditEvent({ page: location.pathname, action, entity: "button" }, user);
    navigate(path);
  };
  const navItems = [
    {
      path: "/",
      action: "click_unplanned_tn",
      label: "Аварийные отключения",
    },
    {
      path: "/planned",
      action: "click_planned_tn",
      label: "Плановые отключения",
    },
    {
      path: "/dashboard",
      action: "click_dashboard",
      label: "Дашборд",
    },
    {
      path: "/pes",
      action: "click_pes_module",
      label: "Модуль ПЭС",
    },
    ...(canSeeAuditLogs
      ? [
          {
            path: "/logging",
            action: "click_audit_logging",
            label: "Журнал действий",
          },
        ]
      : []),
  ];
  const handleNavigate = (item) => {
    setMobileMenuOpen(false);
    goTo(item.path, item.action);
  };

  // TODO: замена логотипа в одном месте.
  const LOGO_SRC = logo;

  return (
    <Flex justify="space-between" align="center" className={styles.header}>
      <Flex align="center" gap={20} className={styles.leftSide}>
        <Image
          src={LOGO_SRC}
          preview={false}
          height={38}
          className={styles.logo}
        />
        {isAuth && (
          <Flex gap={8} wrap className={styles.navWrap}>
            {navItems.map((item) => (
              <Button
                key={item.path}
                type={location.pathname === item.path ? "primary" : "default"}
                onClick={() => handleNavigate(item)}
              >
                {item.label}
              </Button>
            ))}
            {/* {canSeeOperationalDashboard && (
              <Button
                type={location.pathname === "/dashboard-oo" ? "primary" : "default"}
                onClick={() => goTo("/dashboard-oo", "click_operational_dashboard")}
              >
                Дашборд ОО
              </Button>
            )} */}
          </Flex>
        )}
      </Flex>
      {isAuth ? (
        <Button
          className={styles.mobileMenuButton}
          icon={<MenuOutlined />}
          onClick={() => setMobileMenuOpen(true)}
        >
          Меню
        </Button>
      ) : null}

      {isAuth ? (
        <Flex align="center" gap={10} className={styles.rightSide}>
          <span className={styles.userName}>{displayName}</span>
          <Button
            type="primary"
            danger
            onClick={() => exit()}
            className={styles.logoutBtn}
          >
            Выйти
          </Button>
        </Flex>
      ) : null}
      <Drawer
        title="Меню"
        placement="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        width={310}
        className={styles.mobileDrawer}
      >
        <div className={styles.mobileDrawerNav}>
          {navItems.map((item) => (
            <Button
              key={item.path}
              type={location.pathname === item.path ? "primary" : "default"}
              onClick={() => handleNavigate(item)}
              block
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className={styles.mobileDrawerFooter}>
          <span>{displayName}</span>
          <Button
            type="primary"
            danger
            onClick={() => {
              setMobileMenuOpen(false);
              exit();
            }}
            block
          >
            Выйти
          </Button>
        </div>
      </Drawer>
    </Flex>
  );
}

// import { Button, Flex, Image } from "antd";
// import React from "react";
// import useAuth from "../stores/useAuth";
// import logo from "../img/logo.svg";

// export default function Header() {
//   const { authing, isAuth, exit } = useAuth((store) => store);
//   return (
//     <Flex
//       justify="space-between"
//       align="center"
//       style={{ padding: 20, backgroundColor: "#0061aa" }}
//     >
//       <Image src={logo} preview={false} />
//       {isAuth && (
//         <Button
//           onClick={() => {
//             exit();
//           }}
//         >
//           Выход
//         </Button>
//       )}
//     </Flex>
//   );
// }
