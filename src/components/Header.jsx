import { Button, Flex, Image, message } from "antd";
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useAuth from "../stores/useAuth";
import { logAuditEvent } from "../utils/auditLogger";
import logo from "../img/logoBlue.svg";
import styles from "./Header.module.css";

export default function Header() {
  const { isAuth, exit, user } = useAuth((store) => store);
  const navigate = useNavigate();
  const location = useLocation();

  const goTo = (path, action) => {
    logAuditEvent({ page: location.pathname, action, entity: "button" }, user);
    navigate(path);
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
            <Button
              type={location.pathname === "/" ? "primary" : "default"}
              onClick={() => goTo("/", "click_unplanned_tn")}
            >
              Аварийные отключения
            </Button>
            <Button
              type={location.pathname === "/planned" ? "primary" : "default"}
              onClick={() => {
                goTo("/planned", "click_planned_tn");
                message.info("Раздел «Плановые отключения» в разработке");
              }}
            >
              Плановые отключения
            </Button>
            <Button
              type={location.pathname === "/dashboard" ? "primary" : "default"}
              onClick={() => goTo("/dashboard", "click_dashboard")}
            >
              Дашборд
            </Button>
            <Button
              type={location.pathname === "/pes" ? "primary" : "default"}
              onClick={() => goTo("/pes", "click_pes_module")}
            >
              Модуль ПЭС
            </Button>
          </Flex>
        )}
      </Flex>

      {isAuth ? (
        <Button
          type="primary"
          danger
          onClick={() => exit()}
          className={styles.logoutBtn}
        >
          Выйти
        </Button>
      ) : null}
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
