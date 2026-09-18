import React from "react";
import ReactDOM from "react-dom/client";
import SugorokuApp from "./SugorokuApp.jsx";
import ShooterApp from "./shooter/ShooterApp.jsx";
import PuzzleApp from "./puzzle/PuzzleApp.jsx";
import "./index.css";

const path = window.location.pathname;

function pickApp() {
  if (path.startsWith("/shooter")) return <ShooterApp />;
  if (path.startsWith("/puzzle")) return <PuzzleApp />;
  return <SugorokuApp />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{pickApp()}</React.StrictMode>
);
