import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { appUpdates } from "./lib/appUpdate";
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
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
registerSW({
  onNeedRefresh() {
    appUpdates.ready();
  },
  onRegisteredSW(_url, registration) {
    if (registration) appUpdates.register(registration);
  },
  // Reloading is managed after an explicit, successful save in this tab.
  onNeedReload() {},
  onRegisterError(error) {
    console.warn("Offline installation is unavailable", error);
  },
});
