import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

if (import.meta.env.VITE_DEMO) await import("./demoApi.js");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
