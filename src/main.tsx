import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { BRAND } from "./brand";
import "./styles.css";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("SchoolCal rendering error", error, info.componentStack);
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal-error">
          <h1>Let's get your timetable back.</h1>
          <p>
            Something interrupted this page. Your saved project has not been
            deleted.
          </p>
          <button
            className="button primary"
            onClick={() => window.location.reload()}
          >
            Reload SchoolCal
          </button>
        </main>
      );
    return this.props.children;
  }
}
document.title = `${BRAND.name} · Your school week, sorted`;
document.documentElement.style.setProperty("--primary", BRAND.primary);
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new Event("schoolcal:update-ready"));
  },
  onRegisterError(error) {
    console.warn("Offline installation is unavailable", error);
  },
});
window.addEventListener("schoolcal:apply-update", () => void updateSW(true));
