"""Regression: late-joining WebSocket clients must receive the active score."""

from __future__ import annotations

import json

import pytest

from cadenza_server.core.protocol import MessageType
from cadenza_server.features.hub.service import Hub


class _FakeConn:
    def __init__(self) -> None:
        self.sent: list[dict[str, object]] = []

    async def send_text(self, payload: str) -> None:
        self.sent.append(json.loads(payload))


@pytest.mark.asyncio
async def test_register_pushes_score_timeline_when_hub_holds_a_score() -> None:
    """``register`` must echo ``score_timeline`` — broadcast from ingest is not replayed."""
    hub = Hub()
    await hub.start()
    await hub.apply_score(
        {
            "bpm": 100,
            "notes": [{"pitch": 52, "offset_ql": 0.0, "duration_ql": 1.0}],
        },
    )

    conn = _FakeConn()
    await hub.register(conn)

    types = [str(m.get("type")) for m in conn.sent]
    assert types[0] == MessageType.STATUS
    assert types[1] == MessageType.SCORE_TIMELINE
    assert conn.sent[1]["bpm"] == 100.0
    assert len(conn.sent[1]["notes"]) == 1  # type: ignore[arg-type]
