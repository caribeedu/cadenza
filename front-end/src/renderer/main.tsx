import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { bootTheme } from "@app/theme/ui-theme";

import "@shared/styles/globals.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root element missing from index.html");
bootTheme();

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
