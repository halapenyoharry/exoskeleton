import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { startJsonBusPersistence } from "./data/json-bus-persist";
import "dockview/dist/styles/dockview.css";
import "@xterm/xterm/css/xterm.css";
import "./theme.css";

// Load the stored JSON document library onto the bus (best-effort; panels
// that mount first still see documents arrive through onJsonChange).
void startJsonBusPersistence();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
