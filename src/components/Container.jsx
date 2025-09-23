import React from "react";

export default function Container({ children }) {
  return (
    <div style={{  margin: "0 auto", padding: 10 }}>
      {children}
    </div>
  );
}
