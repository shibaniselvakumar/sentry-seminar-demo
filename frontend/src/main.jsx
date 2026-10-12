import React from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.jsx";
import "./styles.css";

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
const configuredEnvironment =
  import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || "seminar";
const parsedRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE);
const tracesSampleRate =
  Number.isFinite(parsedRate) && parsedRate >= 0 && parsedRate <= 1
    ? parsedRate
    : 1.0;

if (dsn) {
  Sentry.init({
    dsn,
    environment: configuredEnvironment,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate,
    tracePropagationTargets: ["localhost", /^http:\/\/localhost:5000\//],
  });
}

class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    if (dsn) {
      Sentry.withScope((scope) => {
        scope.setTag("component", "ErrorBoundary");
        scope.setTag("environment", configuredEnvironment);
        scope.setContext("render_error", { componentStack: errorInfo.componentStack });
        Sentry.captureException(error);
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="boundary-fallback">
          <span className="eyebrow">RECOVERY MODE</span>
          <h1>Something went wrong</h1>
          <p>The dashboard hit a rendering error. Reload the page to try again.</p>
          <button className="button button-primary" onClick={() => window.location.reload()}>
            Reload dashboard
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App
        sentryConfigured={Boolean(dsn)}
        environment={configuredEnvironment}
        apiBaseUrl={
          import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ||
          "http://localhost:5000"
        }
      />
    </ErrorBoundary>
  </React.StrictMode>,
);
