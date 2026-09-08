import React from "react";
import { createRoot } from "react-dom/client";
import "./shell.css";
import { Explorer, Launcher } from "./lab-app.jsx";
class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fatal">
        <h1>A prototípus megakadt.</h1>
        <p>Az adataid helyben maradtak.</p>
        <button onClick={() => location.reload()}>Újratöltés</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
const variant = new URLSearchParams(location.search).get("v");
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    {["measure", "companion"].includes(variant) ? (
      <Explorer variant={variant} />
    ) : (
      <Launcher />
    )}
  </ErrorBoundary>,
);
