import { Button, Flex, Image } from "antd";
import React from "react";
import useAuth from "../stores/useAuth";
import logo from "../img/logoBlue.svg";

export default function Header() {
  const { isAuth, exit } = useAuth((store) => store);

  return (
    <Flex
      justify="space-between"
      align="center"
      style={{
        padding: "12px 20px",
        backgroundColor: "#fff", // белый фон вместо синего
        borderBottom: "1px solid #eaeaea", // тонкая сероватая линия снизу для аккуратности
      }}
    >
      <Image src={logo} preview={false} height={40} />
      {isAuth && (
        <Button type="primary" danger onClick={() => exit()}>
          Выйти
        </Button>
      )}
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
