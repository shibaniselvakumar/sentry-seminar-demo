import os
import time
from pathlib import Path

import sentry_sdk
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from sentry_sdk.integrations.flask import FlaskIntegration


load_dotenv(Path(__file__).with_name(".env"))


def _sample_rate(value):
    try:
        rate = float(value)
    except (TypeError, ValueError):
        return 1.0
    return rate if 0.0 <= rate <= 1.0 else 1.0


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_mapping(
        SENTRY_DSN=os.getenv("SENTRY_DSN", "").strip(),
        SENTRY_TRACES_SAMPLE_RATE=_sample_rate(
            os.getenv("SENTRY_TRACES_SAMPLE_RATE", "1.0")
        ),
        SENTRY_ENVIRONMENT=os.getenv("SENTRY_ENVIRONMENT", "seminar").strip()
        or "seminar",
        FRONTEND_ORIGIN=os.getenv(
            "FRONTEND_ORIGIN", "http://localhost:5173"
        ).strip(),
    )
    if test_config:
        app.config.update(test_config)

    if app.config["SENTRY_DSN"]:
        sentry_sdk.init(
            dsn=app.config["SENTRY_DSN"],
            integrations=[FlaskIntegration()],
            environment=app.config["SENTRY_ENVIRONMENT"],
            traces_sample_rate=_sample_rate(
                app.config["SENTRY_TRACES_SAMPLE_RATE"]
            ),
            send_default_pii=False,
        )

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": [app.config["FRONTEND_ORIGIN"]],
                "allow_headers": ["Content-Type", "sentry-trace", "baggage"],
                "methods": ["GET", "OPTIONS"],
            }
        },
    )

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", service="Flask backend")

    @app.get("/api/demo-message")
    def demo_message():
        return jsonify(message="Frontend and Flask backend are communicating.")

    @app.get("/api/slow")
    def slow():
        time.sleep(2)
        return jsonify(status="ok", message="Slow request completed.")

    @app.get("/api/demo-error")
    def demo_error():
        raise RuntimeError("Sentry Seminar: Intentional Backend Error")

    @app.errorhandler(500)
    def internal_error(_error):
        return jsonify(error="An internal demo error occurred."), 500

    return app


if __name__ == "__main__":
    create_app().run(host="127.0.0.1", port=5000, debug=False)
