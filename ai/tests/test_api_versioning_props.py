"""Property tests for API versioning endpoints."""

import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app  # noqa: E402


client = TestClient(app)


def _sample_request():
    moves = [{"x": i, "y": i, "p": "X" if i % 2 == 0 else "O"} for i in range(5)]
    return {
        "match_id": "12345678-1234-1234-1234-123456789012",
        "user_id": "87654321-4321-4321-4321-210987654321",
        "moves": moves,
        "tier": "basic",
        "language": "vi",
    }


def test_api_v1_deprecation_header():
    resp = client.post("/api/v1/analyze", json=_sample_request())
    assert resp.status_code == 200
    assert resp.headers.get("X-API-Version") == "v1"
    assert "deprecated" in resp.headers.get("Warning", "").lower()


def test_api_v2_version_header():
    resp = client.post("/api/v2/analyze", json=_sample_request())
    assert resp.status_code == 200
    assert resp.headers.get("X-API-Version") == "v2"
    assert resp.headers.get("Warning") is None or "deprecated" not in resp.headers.get("Warning", "").lower()
