"""HTTP ingest tests: POST /score under the FastAPI router.

Mirrors the behavioural contract of the previous hand-rolled asyncio HTTP
handler: valid score payloads ack with ``{ok, notes, bpm}``; malformed
JSON and wrong types are rejected with 4xx; unsupported ``type`` values
are rejected.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from cadenza_server.app import create_app


@pytest.fixture
def client() -> TestClient:
    # ``TestClient`` runs the lifespan context so the hub is fully wired.
    with TestClient(create_app()) as c:
        yield c


class TestScoreIngest:
    def test_valid_post_returns_200_with_ack(self, client: TestClient) -> None:
        response = client.post(
            "/score",
            json={
                "type": "score",
                "bpm": 120,
                "notes": [
                    {"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0},
                    {"pitch": 62, "offset_ql": 1.0, "duration_ql": 1.0},
                ],
            },
        )
        assert response.status_code == 200
        assert response.json() == {"ok": True, "notes": 2, "bpm": 120.0}

    def test_missing_type_defaults_to_score(self, client: TestClient) -> None:
        # Backwards-compat: the previous HTTP ingest accepted payloads
        # without an explicit ``type`` field.
        response = client.post(
            "/score",
            json={
                "bpm": 120,
                "notes": [{"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0}],
            },
        )
        assert response.status_code == 200
        assert response.json()["notes"] == 1

    def test_unsupported_type_returns_400(self, client: TestClient) -> None:
        response = client.post(
            "/score",
            json={"type": "hello", "bpm": 120, "notes": []},
        )
        assert response.status_code == 400
        assert "unsupported payload type" in response.json()["detail"]

    def test_invalid_bpm_returns_400(self, client: TestClient) -> None:
        response = client.post(
            "/score",
            json={"type": "score", "bpm": 0, "notes": []},
        )
        assert response.status_code == 400
        assert "bpm" in response.json()["detail"]

    def test_invalid_json_returns_400(self, client: TestClient) -> None:
        response = client.post(
            "/score",
            data=b"not json",
            headers={"Content-Type": "application/json"},
        )
        # FastAPI maps JSON decode failures to 422 via Starlette, not 400,
        # but the key contract is "4xx, not 5xx, for client mistakes".
        assert 400 <= response.status_code < 500

    def test_get_method_not_allowed(self, client: TestClient) -> None:
        response = client.get("/score")
        assert response.status_code == 405


class TestScoreIngestBroadcasts:
    """Regression for TD-05: a score posted over HTTP must reach every
    WebSocket-connected frontend as a ``score_timeline`` frame. This is
    what justifies keeping both transports on the same FastAPI app."""

    def test_http_score_broadcasts_to_websocket_frontend(
        self, client: TestClient
    ) -> None:
        with client.websocket_connect("/") as ws:
            # Initial status frame is sent on connect; drain it.
            first = ws.receive_json()
            assert first["type"] == "status"

            ws.send_json({"type": "hello", "role": "frontend"})
            _updated_status = ws.receive_json()

            response = client.post(
                "/score",
                json={
                    "type": "score",
                    "bpm": 120,
                    "notes": [
                        {"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0},
                    ],
                },
            )
            assert response.status_code == 200

            timeline = _recv_of_type(ws, "score_timeline")
            assert timeline["bpm"] == 120
            assert len(timeline["notes"]) == 1
            assert timeline["notes"][0]["pitch"] == 60


def _recv_of_type(ws, expected: str) -> dict:
    """Drain frames until one matches the given ``type`` field."""
    # TestClient's WebSocket has a deterministic queue, so we just
    # pull frames until we see the one we want. No timeout needed:
    # if the broadcast never arrives the test hangs — which is the
    # correct failure mode.
    for _ in range(20):
        msg = ws.receive_json()
        if msg.get("type") == expected:
            return msg
    raise AssertionError(f"Expected a {expected!r} frame; never arrived")
