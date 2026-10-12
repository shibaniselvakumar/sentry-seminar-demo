import { useCallback, useEffect, useMemo, useState } from "react";
import * as Sentry from "@sentry/react";

const timeNow = () =>
  new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(
    new Date(),
  );

function App({ sentryConfigured, environment, apiBaseUrl }) {
  const [activity, setActivity] = useState([]);
  const [busy, setBusy] = useState({});
  const [apiState, setApiState] = useState("checking");
  const [frontendErrors, setFrontendErrors] = useState(0);
  const [backendAttempts, setBackendAttempts] = useState(0);
  const [latestSlow, setLatestSlow] = useState(null);
  const [healthResponse, setHealthResponse] = useState(null);
  const [notice, setNotice] = useState(null);

  const addActivity = useCallback((title, detail, status = "success") => {
    setActivity((items) =>
      [{ id: `${Date.now()}-${Math.random()}`, title, detail, status, time: timeNow() }, ...items].slice(
        0,
        8,
      ),
    );
  }, []);

  const runAction = useCallback(
    async (key, action) => {
      setBusy((current) => ({ ...current, [key]: true }));
      setNotice(null);
      try {
        await action();
      } catch {
        setNotice({ status: "failure", text: "The request could not be completed. Check the service and try again." });
        addActivity(key, "The operation could not be completed.", "failure");
      } finally {
        setBusy((current) => ({ ...current, [key]: false }));
      }
    },
    [addActivity],
  );

  const checkHealth = useCallback(
    async (recordActivity = true) => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/health`);
        const data = await response.json();
        setHealthResponse({ status: response.status, data });
        const healthy = response.ok && data.status === "ok";
        setApiState(healthy ? "online" : "offline");
        if (recordActivity) {
          const detail = `HTTP ${response.status} · ${JSON.stringify(data)}`;
          setNotice({ status: healthy ? "success" : "failure", text: detail });
          addActivity("Backend health check", detail, healthy ? "success" : "failure");
        }
      } catch {
        setApiState("offline");
        setHealthResponse(null);
        if (recordActivity) {
          const detail = "Backend is unreachable. Make sure Flask is running.";
          setNotice({ status: "failure", text: detail });
          addActivity("Backend health check", detail, "failure");
        }
      }
    },
    [addActivity, apiBaseUrl],
  );

  useEffect(() => {
    checkHealth(false);
  }, [checkHealth]);

  const triggerFrontendError = () =>
    runAction("Trigger Frontend Error", async () => {
      Sentry.addBreadcrumb({
        category: "demo",
        message: "User triggered the frontend error demo",
        level: "warning",
        data: { action: "frontend-error", environment },
      });
      try {
        throw new Error("Sentry Seminar: Intentional Frontend Error");
      } catch (error) {
        if (sentryConfigured) {
          Sentry.withScope((scope) => {
            scope.setTag("demo_type", "intentional_frontend_error");
            scope.setTag("component", "DemoControls");
            scope.setTag("environment", environment);
            scope.setContext("demo_action", {
              action: "Trigger Frontend Error",
              source: "local seminar dashboard",
            });
            Sentry.captureException(error);
          });
        }
        setFrontendErrors((count) => count + 1);
        const detail = sentryConfigured
          ? "Generated locally. It may take several seconds to appear in the React Sentry project; verify delivery in Sentry."
          : "Generated locally, but no event was sent because a Sentry DSN is not configured.";
        setNotice({ status: sentryConfigured ? "success" : "warning", text: detail });
        addActivity("Frontend error generated", detail, sentryConfigured ? "success" : "warning");
      }
    });

  const triggerBackendError = () =>
    runAction("Trigger Backend Error", async () => {
      setBackendAttempts((count) => count + 1);
      try {
        const response = await fetch(`${apiBaseUrl}/api/demo-error`);
        let data = {};
        try {
          data = await response.json();
        } catch {
          data = {};
        }
        const detail = response.status === 500
          ? "The expected backend error returned HTTP 500. Check the Flask Sentry project after ingestion."
          : `The endpoint returned HTTP ${response.status}.`;
        setNotice({ status: response.status === 500 ? "success" : "failure", text: detail });
        addActivity(
          "Backend error requested",
          response.status === 500 ? `${detail} ${data.error || ""}`.trim() : detail,
          response.status === 500 ? "success" : "failure",
        );
      } catch {
        setApiState("offline");
        const detail = "Could not reach Flask. No backend error request was delivered.";
        setNotice({ status: "failure", text: detail });
        addActivity("Backend error request failed", detail, "failure");
      }
    });

  const testSlowApi = () =>
    runAction("Test Slow API", async () => {
      Sentry.addBreadcrumb({
        category: "demo",
        message: "User started the slow API demo",
        level: "info",
        data: { endpoint: "/api/slow", environment },
      });
      const startedAt = performance.now();
      const response = await fetch(`${apiBaseUrl}/api/slow`);
      const elapsed = performance.now() - startedAt;
      const data = await response.json();
      setLatestSlow(elapsed);
      const detail = response.ok
        ? `${elapsed.toFixed(0)} ms · ${JSON.stringify(data)}`
        : `HTTP ${response.status} · ${JSON.stringify(data)}`;
      setNotice({ status: response.ok ? "success" : "failure", text: detail });
      addActivity("Slow API request", detail, response.ok ? "success" : "failure");
    });

  const navigation = useMemo(
    () => [
      ["Overview", "#overview", "◫"],
      ["Error Monitoring", "#monitoring", "⌁"],
      ["Performance", "#performance", "◷"],
      ["Demo Controls", "#controls", "▶"],
    ],
    [],
  );

  const running = (key) => Boolean(busy[key]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Sentry Observability Demo home">
          <span className="brand-mark">S</span>
          <span><strong>Sentry</strong><small>OBSERVABILITY DEMO</small></span>
        </a>
        <div className="side-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(([label, href, icon], index) => (
            <a className={`nav-link ${index === 0 ? "active" : ""}`} href={href} key={label}>
              <span className="nav-icon">{icon}</span>{label}
              {label === "Demo Controls" && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-card">
            <span className="pulse-dot" />
            <div><b>Local demo mode</b><small>Activity shown here is generated on this device.</small></div>
          </div>
          <small className="sidebar-version">SEMINAR BUILD · V1.0</small>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>Overview</strong></div>
          <div className="topbar-status">
            <span className="status-pill"><i className="status-dot green" />Application running</span>
            <span className="env-pill">ENV <b>{environment}</b></span>
          </div>
        </header>

        <div className="content-wrap">
          <section className="page-heading" id="overview">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> DEVELOPER OBSERVABILITY</div>
              <h1>Sentry Observability Demo</h1>
              <p className="subtitle">A safe local playground for seeing how errors and slow requests move through your app.</p>
            </div>
            <div className={`sentry-status ${sentryConfigured ? "is-configured" : "is-missing"}`}>
              <span className="sentry-glyph">◉</span>
              <span><small>SENTRY MONITORING</small><b>{sentryConfigured ? "Configured" : "Not configured"}</b></span>
              <span className="status-dot" />
            </div>
          </section>

          <section className="metrics-section" aria-labelledby="local-activity-heading">
            <div className="section-title-row">
              <div><h2 id="local-activity-heading">Local demo activity</h2><p>These are actions from this browser session—not metrics retrieved from Sentry.</p></div>
              <span className="local-label"><span className="pulse-dot" /> LOCAL SESSION</span>
            </div>
            <div className="metric-grid">
              <MetricCard icon="!" label="Frontend errors triggered" value={frontendErrors} color="coral" caption="Generated locally" />
              <MetricCard icon="↗" label="Backend error attempts" value={backendAttempts} color="violet" caption="Requests from this browser" />
              <MetricCard icon="⌁" label="API health" value={apiState === "online" ? "Online" : apiState === "checking" ? "Checking" : "Offline"} color={apiState === "online" ? "mint" : "amber"} caption={healthResponse ? `HTTP ${healthResponse.status}` : "Flask connection"} />
              <MetricCard icon="◷" label="Latest slow request" value={latestSlow == null ? "—" : `${latestSlow.toFixed(0)} ms`} color="blue" caption={latestSlow == null ? "Run the slow API test" : "Measured in browser"} />
            </div>
          </section>

          <section className="workspace-grid">
            <div className="panel controls-panel" id="controls">
              <div className="panel-header">
                <div><div className="eyebrow">INTERACTIVE SCENARIOS</div><h2>Demo controls</h2><p>Trigger real local actions and see the result right here.</p></div>
                <span className="panel-icon">⌘</span>
              </div>
              {notice && <div className={`notice notice-${notice.status}`} role="status"><span>{notice.status === "success" ? "✓" : notice.status === "warning" ? "!" : "×"}</span><p>{notice.text}</p></div>}
              <div className="control-list">
                <ControlRow icon="!" iconTone="coral" title="Trigger Frontend Error" description="Generate a caught JavaScript error with Sentry context." buttonTone="primary" loading={running("Trigger Frontend Error")} onClick={triggerFrontendError} />
                <ControlRow icon="⌁" iconTone="mint" title="Check Backend Health" description="Call the Flask health endpoint and inspect its response." buttonTone="quiet" loading={running("Check Backend Health")} onClick={() => runAction("Check Backend Health", () => checkHealth(true))} />
                <ControlRow icon="↗" iconTone="violet" title="Trigger Backend Error" description="Request an intentional Flask exception; show a safe response." buttonTone="quiet" loading={running("Trigger Backend Error")} onClick={triggerBackendError} />
                <ControlRow icon="◷" iconTone="blue" title="Test Slow API" description="Measure a real request to the two-second Flask endpoint." buttonTone="quiet" loading={running("Test Slow API")} onClick={testSlowApi} />
              </div>
              {!sentryConfigured && <div className="config-hint"><span>i</span><p>Controls still work without Sentry. Add a DSN to the local <code>.env</code> file to send events.</p></div>}
            </div>

            <div className="right-column">
              <section className="panel connection-panel" id="monitoring">
                <div className="panel-header compact"><div><div className="eyebrow">SERVICE CONNECTION</div><h2>Runtime status</h2></div><span className="live-badge"><i /> LIVE</span></div>
                <div className="service-row">
                  <span className="service-icon browser-icon">◧</span><div className="service-copy"><b>React frontend</b><small>Browser application · {environment}</small></div><span className="connected-tag">RUNNING</span>
                </div>
                <div className="service-row">
                  <span className="service-icon api-icon">⌁</span><div className="service-copy"><b>Flask API</b><small>{apiBaseUrl}</small></div><span className={`connected-tag ${apiState === "online" ? "" : "tag-muted"}`}>{apiState === "online" ? "ONLINE" : apiState === "checking" ? "CHECKING" : "OFFLINE"}</span>
                </div>
                <div className="service-row">
                  <span className="service-icon sentry-icon">◉</span><div className="service-copy"><b>Sentry telemetry</b><small>Independent project DSNs</small></div><span className={`connected-tag ${sentryConfigured ? "" : "tag-muted"}`}>{sentryConfigured ? "READY" : "OPTIONAL"}</span>
                </div>
                <div className="health-response">
                  <span className="response-label">LATEST HEALTH RESPONSE</span>
                  <code>{healthResponse ? `HTTP ${healthResponse.status}  ${JSON.stringify(healthResponse.data)}` : apiState === "checking" ? "Checking Flask API…" : "No response received"}</code>
                </div>
              </section>
              <section className="panel trace-panel" id="performance">
                <div className="panel-header compact"><div><div className="eyebrow">REQUEST TRACE</div><h2>Performance check</h2></div><span className="trace-icon">◷</span></div>
                <p className="trace-copy">The slow endpoint waits about two seconds. Your browser measures the actual round-trip; Sentry request tracing is enabled when configured and supported.</p>
                <div className="trace-footer"><span><i className="status-dot green" /> {latestSlow == null ? "Ready to test" : "Last request complete"}</span><button className="text-button" onClick={() => document.getElementById("controls")?.scrollIntoView({ behavior: "smooth" })}>Run test <span>↗</span></button></div>
              </section>
            </div>
          </section>

          <section className="panel activity-panel">
            <div className="panel-header compact activity-heading"><div><div className="eyebrow">THIS BROWSER SESSION</div><h2>Recent activity</h2></div><span className="activity-count">{activity.length} {activity.length === 1 ? "EVENT" : "EVENTS"}</span></div>
            {activity.length === 0 ? (
              <div className="empty-activity"><span className="empty-icon">↳</span><div><b>Nothing has happened yet</b><p>Choose a demo control to see a real local action and its outcome.</p></div></div>
            ) : (
              <div className="activity-list">
                {activity.map((item) => (
                  <article className="activity-item" key={item.id}>
                    <span className={`activity-mark mark-${item.status}`}>{item.status === "success" ? "✓" : item.status === "warning" ? "!" : "×"}</span>
                    <div className="activity-detail"><b>{item.title}</b><p>{item.detail}</p></div>
                    <time>{item.time}</time>
                  </article>
                ))}
              </div>
            )}
          </section>
          <footer className="page-footer"><span>BUILT FOR LEARNING · NO SENTRY DASHBOARD DATA IS DISPLAYED HERE</span><a href="https://docs.sentry.io/" target="_blank" rel="noreferrer">Sentry docs ↗</a></footer>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ icon, label, value, color, caption }) {
  return <article className="metric-card"><div className={`metric-icon ${color}`}>{icon}</div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><small>{caption}</small></article>;
}

function ControlRow({ icon, iconTone, title, description, buttonTone, loading, onClick }) {
  return <div className="control-row"><span className={`control-icon ${iconTone}`}>{icon}</span><div className="control-copy"><b>{title}</b><p>{description}</p></div><button className={`button button-${buttonTone}`} onClick={onClick} disabled={loading}>{loading ? <><span className="spinner" /> Working…</> : title}</button></div>;
}

export default App;
