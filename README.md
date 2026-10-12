# Sentry Observability Demo

A small local full-stack application for learning how Sentry helps developers discover and investigate errors and slow requests. The dashboard reports **local demo activity** only; it does not read metrics from Sentry or claim that an event has arrived there.

## Architecture

```text
React + Vite in your browser ── HTTP ──> Flask API
          │                                │
          └── React Sentry project         └── Flask Sentry project
```

The browser and API send telemetry to two separate Sentry projects. By default, both use the `seminar` environment; if you override it, set `VITE_SENTRY_ENVIRONMENT` and `SENTRY_ENVIRONMENT` to the same value. The app runs locally and has no database, authentication, containers, or cloud deployment.

## Prerequisites

- Node.js 20.19+ (or 22.12+) and npm
- Python 3.10+
- A Sentry account (Sentry is optional when running the app)

## Create the Sentry projects

1. In Sentry, create two projects: **`sentry-react-demo`** using the React platform, and **`sentry-flask-demo`** using the Python/Flask platform.
2. For each project, open **Settings → Projects → [project] → Client Keys (DSN)** (the exact navigation label can vary) and copy its DSN.
3. Keep the DSNs in your local environment files only. Put the React project's DSN in `frontend/.env` as `VITE_SENTRY_DSN`; put the Flask project's DSN in `backend/.env` as `SENTRY_DSN`. Do not paste them into source files or commit the `.env` files.

## Configure and install

From the repository root, create local environment files by copying the safe examples.

**macOS/Linux (Terminal):**

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

**Windows (PowerShell):**

```powershell
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
```

Edit each file and paste the matching project DSN into its variable. Leaving the DSN blank is fine; both services still start and the dashboard indicates Sentry is not configured. The example files document the API URL, trace sample rate, default `seminar` environment, and allowed frontend origin. Environment overrides are optional.

### Backend install

Open a terminal in the repository root.

**macOS/Linux:**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python app.py
```

**Windows PowerShell:**

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

The API listens at `http://localhost:5000`. If PowerShell blocks virtual-environment activation, follow Python's documented execution-policy instructions or invoke `.venv\Scripts\python.exe` directly.

### Frontend install and start

Keep the backend running, open a **second terminal** at the repository root, then run:

```bash
cd frontend
npm install
npm run dev
```

Open the local Vite URL printed in that terminal (normally `http://localhost:5173`). To create the production bundle, run `npm run build` from `frontend/`.

## Try the demo

The four buttons appear in **Demo Controls**. The dashboard summary and activity feed show local actions only.

1. **Check Backend Health** — calls `GET /api/health`; the actual JSON and HTTP status are shown. A reachable response turns the API indicator green.
2. **Trigger Frontend Error** — generates and catches `Sentry Seminar: Intentional Frontend Error`, with a breadcrumb, tags, and action context. It is captured once in the **React project** only when `VITE_SENTRY_DSN` is configured. The UI remains usable.
3. **Trigger Backend Error** — calls `GET /api/demo-error`. Flask raises an intentional server-side exception and responds with a generic 500 message. The exception is captured by the Flask integration in the **Flask project** when `SENTRY_DSN` is configured.
4. **Test Slow API** — calls `GET /api/slow`, measures actual elapsed time in the browser, and displays the returned JSON. A breadcrumb is added; browser request tracing is enabled when the SDK and project configuration support it.

Check the corresponding project's **Issues** page for frontend and backend exceptions. Open an issue to review its stack trace, tags, and breadcrumbs. Check **Performance** for available requests/transactions. Telemetry can take several seconds or longer to appear; actual availability depends on account plan, project settings, sampling, and SDK compatibility. Verify delivery in your own Sentry dashboard; the local app cannot confirm receipt.

## 5-Minute Live Demo

1. Open the dashboard, point out the local **seminar** environment, and check backend health.
2. Trigger the frontend exception, then open the React project's Issues page.
3. Show the captured stack trace and available tags or breadcrumbs.
4. Trigger the backend exception, then open the Flask project's Issues page and show its stack trace.
5. Test the slow API and inspect any available performance data.
6. Conclude: Sentry helps teams discover failures, investigate context, and debug issues faster. Ingestion takes time, and visibility depends on the Sentry plan, project settings, sampling, and SDK support.

## Troubleshooting

- **Sentry is not configured:** verify each DSN is in the correct local `.env` file and has no surrounding quotes/spaces. A blank DSN is supported but sends no events.
- **Changed a frontend variable:** restart the Vite dev server after editing `frontend/.env`; Vite reads `VITE_` variables at startup.
- **Wrong environment in Sentry:** this demo uses `seminar` by default. To override it, set both `SENTRY_ENVIRONMENT` and `VITE_SENTRY_ENVIRONMENT` in their respective `.env` files to the same value.
- **CORS error:** make sure the browser URL uses the origin in `backend/.env` as `FRONTEND_ORIGIN` (default `http://localhost:5173`). `localhost` and `127.0.0.1` are different origins. Restart Flask after changing it.
- **Backend offline/unreachable:** start Flask in its own terminal and confirm `http://localhost:5000/api/health` returns JSON.
- **No event or slow event in Sentry:** verify the project DSN and project platform, wait for ingestion, and review sampling, account plan, and project settings. The local activity feed is not proof of delivery.
- **Stop the services:** press `Ctrl+C` in each terminal. To leave the Python virtual environment, run `deactivate`.

## Screenshot/PPT capture checklist

After running the app locally, capture:

- Dashboard overview with local activity labels visible
- Backend health success and returned status
- Frontend-trigger confirmation
- Backend-trigger confirmation
- Slow API result and measured duration
- Optional: real React/Flask Sentry Issues and Performance screens

Use screenshots from your own running app and Sentry account. Do not present the local activity summary as Sentry-retrieved telemetry.

## Tests

With the backend virtual environment active, from `backend/` run:

```bash
pytest
```

Tests use Flask's test client, do not require a DSN, and replace the slow endpoint's sleep with a no-op.
