import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
const appVersion = localStorage.getItem("appVersion") || "v1";

if (appVersion === "v2") {
  import("../src-v2/AppV2").then(({ default: AppV2 }) => {
    root.render(
      <React.StrictMode>
        <AppV2 />
      </React.StrictMode>
    );
  });
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
