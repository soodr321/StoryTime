import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/baloo-2/latin-600.css";
import "@fontsource/baloo-2/latin-800.css";
import "@fontsource/literata/latin-400.css";
import "@fontsource/literata/latin-400-italic.css";
import "@fontsource/literata/latin-600.css";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
