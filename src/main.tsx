import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { Sfx } from "@/services/sfx";

const root = document.getElementById("root");
if (!root) {
  throw new Error("root element not found");
}

const unlock = (): void => {
  Sfx.unlock();
  window.removeEventListener("pointerdown", unlock);
  window.removeEventListener("touchstart", unlock);
};
window.addEventListener("pointerdown", unlock, { passive: true });
window.addEventListener("touchstart", unlock, { passive: true });

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
