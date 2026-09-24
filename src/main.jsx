import React from "react";
import ReactDOM from "react-dom/client";
import SugorokuApp from "./SugorokuApp.jsx";
import GalleryApp from "./shooter/GalleryApp.jsx";
import PuzzleApp from "./puzzle/PuzzleApp.jsx";
import "./index.css";

const path = window.location.pathname;

function pickApp() {
  if (path.startsWith("/shooter")) return <GalleryApp />;
  if (path.startsWith("/puzzle")) return <PuzzleApp />;
  return <SugorokuApp />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>{pickApp()}</React.StrictMode>
);
