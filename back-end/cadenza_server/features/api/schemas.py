"""Pydantic schemas that describe the HTTP surface for OpenAPI.

We keep the *validation* surface intentionally permissive: the score
builder (:func:`cadenza_server.core.score.build_score_from_payload`)
silently drops malformed note / tempo entries so a partially broken
MuseScore payload is still useful. Pydantic's role here is therefore
purely documentary — it shapes the OpenAPI schema without rejecting
payloads the builder would otherwise accept.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ScorePayload(BaseModel):
    """Score payload posted by the MuseScore plugin."""

    model_config = ConfigDict(extra="allow")

    type: str | None = Field(
        default=None,
        description="Must be 'score' for the /score endpoint; other values are rejected.",
    )
    bpm: float | None = Field(
        default=None,
        description="Tempo at offset 0. Ignored if tempo_map is populated.",
    )
    tempo_map: list[dict[str, Any]] | None = Field(
        default=None,
        description="Piecewise tempo changes: [{offset_ql, bpm}, ...].",
    )
    notes: list[dict[str, Any]] | None = Field(
        default=None,
        description=(
            "Scored notes with quarter-length offsets: "
            "[{pitch, offset_ql, duration_ql, track?}, ...]."
        ),
    )
    meta: dict[str, Any] | None = Field(
        default=None,
        description=(
            "Free-form metadata from the plugin. Today only meta.title "
            "is surfaced downstream (forwarded in score_timeline)."
        ),
    )


class ScoreAck(BaseModel):
    """HTTP ack returned by POST /score."""

    ok: bool = True
    notes: int = Field(description="Number of notes materialised in the timeline.")
    bpm: float = Field(description="BPM actually used for the timeline at offset 0.")


class ErrorResponse(BaseModel):
    error: str
