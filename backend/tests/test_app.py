import app as backend


def make_client(monkeypatch):
    monkeypatch.setenv("SENTRY_DSN", "")
    return backend.create_app(
        {"TESTING": True, "PROPAGATE_EXCEPTIONS": False, "SENTRY_DSN": ""}
    ).test_client()


def test_health_endpoint(monkeypatch):
    response = make_client(monkeypatch).get("/api/health")

    assert response.status_code == 200
    assert response.get_json() == {"status": "ok", "service": "Flask backend"}


def test_demo_message_endpoint(monkeypatch):
    response = make_client(monkeypatch).get("/api/demo-message")

    assert response.status_code == 200
    assert "communicating" in response.get_json()["message"]


def test_slow_endpoint_returns_success_without_waiting(monkeypatch):
    monkeypatch.setattr(backend.time, "sleep", lambda _seconds: None)

    response = make_client(monkeypatch).get("/api/slow")

    assert response.status_code == 200
    assert response.get_json()["status"] == "ok"


def test_demo_error_returns_generic_500(monkeypatch):
    response = make_client(monkeypatch).get("/api/demo-error")
    body = response.get_data(as_text=True)

    assert response.status_code == 500
    assert response.get_json() == {"error": "An internal demo error occurred."}
    assert "RuntimeError" not in body
    assert "Intentional Backend Error" not in body


def test_cors_allows_configured_frontend_and_trace_headers(monkeypatch):
    response = make_client(monkeypatch).options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "sentry-trace,baggage",
        },
    )

    assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert "sentry-trace" in response.headers["Access-Control-Allow-Headers"]
    assert "baggage" in response.headers["Access-Control-Allow-Headers"]
