"""End-to-end WebSocket dispatch tests through the FastAPI TestClient.

The TestClient runs the real app lifespan (starting the hub + MIDI pump)
in a background thread, so these tests exercise the exact wiring a
production process would, minus uvicorn/ASGI network transport.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from cadenza_server.app import create_app


@pytest.fixture
def client() -> TestClient:
    with TestClient(create_app()) as c:
        yield c


def _drain_status(ws) -> dict:
    msg = ws.receive_json()
    assert msg["type"] == "status"
    return msg


def _recv_of_type(ws, expected: str, *, max_frames: int = 20) -> dict:
    for _ in range(max_frames):
        msg = ws.receive_json()
        if msg.get("type") == expected:
            return msg
    raise AssertionError(f"Expected a {expected!r} frame; never arrived")


class TestHelloHandshake:
    def test_status_on_connect_and_after_hello(self, client: TestClient) -> None:
        with client.websocket_connect("/") as ws:
            initial = _drain_status(ws)
            assert initial["score_loaded"] is False
            assert initial["playing"] is False

            ws.send_json({"type": "hello", "role": "frontend"})
            updated = _drain_status(ws)
            # Clients counter bumps once the role is known.
            assert updated["clients"]["frontend"] == 1


class TestScoreOverWebsocket:
    def test_plugin_score_reaches_frontend_as_timeline(self, client: TestClient) -> None:
        with client.websocket_connect("/") as frontend, client.websocket_connect("/") as plugin:
            _drain_status(frontend)
            _drain_status(plugin)

            frontend.send_json({"type": "hello", "role": "frontend"})
            plugin.send_json({"type": "hello", "role": "plugin"})

            # Drain the subsequent status broadcasts triggered by hello.
            _recv_of_type(frontend, "status")

            plugin.send_json(
                {
                    "type": "score",
                    "bpm": 120,
                    "notes": [
                        {"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0},
                        {"pitch": 62, "offset_ql": 1.0, "duration_ql": 1.0},
                    ],
                }
            )

            timeline = _recv_of_type(frontend, "score_timeline")
            assert timeline["bpm"] == 120
            assert len(timeline["notes"]) == 2
            assert timeline["notes"][0]["pitch"] == 60
            assert timeline["notes"][1]["start_ms"] == pytest.approx(500.0)


class TestUnknownMessageType:
    def test_hub_replies_with_error_for_unknown_type(self, client: TestClient) -> None:
        with client.websocket_connect("/") as ws:
            _drain_status(ws)
            ws.send_json({"type": "does_not_exist"})
            err = _recv_of_type(ws, "error")
            assert "Unknown type" in err["error"]


class TestToleranceFlow:
    def test_set_tolerance_updates_status(self, client: TestClient) -> None:
        with client.websocket_connect("/") as ws:
            _drain_status(ws)

            ws.send_json({"type": "set_tolerance", "tolerance_ms": 42})
            status = _recv_of_type(ws, "status")
            assert status["tolerance_ms"] == 42.0

    def test_negative_tolerance_rejected(self, client: TestClient) -> None:
        with client.websocket_connect("/") as ws:
            _drain_status(ws)

            ws.send_json({"type": "set_tolerance", "tolerance_ms": -1})
            err = _recv_of_type(ws, "error")
            assert "non-negative" in err["error"]

    def test_bool_tolerance_rejected(self, client: TestClient) -> None:
        # ``True`` is ``int`` in Python; the hub must reject it explicitly.
        with client.websocket_connect("/") as ws:
            _drain_status(ws)

            ws.send_json({"type": "set_tolerance", "tolerance_ms": True})
            err = _recv_of_type(ws, "error")
            assert "non-negative" in err["error"]


class TestPlaybackSpeedFlow:
    def test_default_speed_is_reported_in_status(self, client: TestClient) -> None:
        with client.websocket_connect("/") as ws:
            initial = _drain_status(ws)
            assert initial["playback_speed"] == 1.0

    def test_set_playback_speed_updates_status(self, client: TestClient) -> None:
        with client.websocket_connect("/") as ws:
            _drain_status(ws)

            ws.send_json({"type": "set_playback_speed", "playback_speed": 0.5})
            status = _recv_of_type(ws, "status")
            assert status["playback_speed"] == 0.5

    def test_zero_speed_rejected(self, client: TestClient) -> None:
        with client.websocket_connect("/") as ws:
            _drain_status(ws)

            ws.send_json({"type": "set_playback_speed", "playback_speed": 0})
            err = _recv_of_type(ws, "error")
            assert "playback_speed" in err["error"]

    def test_bool_speed_rejected(self, client: TestClient) -> None:
        # ``True`` is numerically 1.0 but semantically wrong — reject loudly.
        with client.websocket_connect("/") as ws:
            _drain_status(ws)

            ws.send_json({"type": "set_playback_speed", "playback_speed": True})
            err = _recv_of_type(ws, "error")
            assert "playback_speed" in err["error"]


class TestScoreTitleBroadcast:
    def test_title_forwarded_in_score_timeline(self, client: TestClient) -> None:
        with client.websocket_connect("/") as frontend, client.websocket_connect("/") as plugin:
            _drain_status(frontend)
            _drain_status(plugin)
            frontend.send_json({"type": "hello", "role": "frontend"})
            plugin.send_json({"type": "hello", "role": "plugin"})
            _recv_of_type(frontend, "status")

            plugin.send_json(
                {
                    "type": "score",
                    "bpm": 120,
                    "notes": [{"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0}],
                    "meta": {"title": "Minuet in G"},
                }
            )

            timeline = _recv_of_type(frontend, "score_timeline")
            assert timeline["title"] == "Minuet in G"
            assert len(timeline["notes"]) == 1
