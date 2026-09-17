import React from "react";
import ReactDOM from "react-dom/client";
import SugorokuApp from "./SugorokuApp.jsx";
import ShooterApp from "./shooter/ShooterApp.jsx";
import "./index.css";

const isShooter = window.location.pathname.startsWith("/shooter");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isShooter ? <ShooterApp /> : <SugorokuApp />}
  </React.StrictMode>
);
