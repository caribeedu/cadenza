"""HTTP ingest router: ``POST /score`` used by the MuseScore plugin.

MuseScore 4 on Windows and macOS does not ship the ``Qt.WebSockets`` QML
module (see TECH-DEBTS TD-05), so the plugin can only talk to us over
HTTP. This router mounts a single endpoint that forwards the payload to
the hub; the hub then broadcasts the timeline to every WebSocket frontend.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Body, HTTPException, Request, status

from cadenza_server.core.protocol import MessageType
from cadenza_server.features.api.schemas import ErrorResponse, ScoreAck, ScorePayload
from cadenza_server.features.hub import Hub

log = logging.getLogger("cadenza.api.score")


def build_score_router(hub: Hub) -> APIRouter:
    """Return a FastAPI router bound to the given ``hub`` instance."""
    router = APIRouter(tags=["score"])

    @router.post(
        "/score",
        response_model=ScoreAck,
        responses={
            status.HTTP_400_BAD_REQUEST: {"model": ErrorResponse},
        },
        summary="Ingest a MuseScore score payload",
    )
    async def ingest_score(
        request: Request,
        payload: Annotated[ScorePayload, Body(...)],
    ) -> ScoreAck:
        # We accept any extra fields but we *do* enforce the ``type``
        # discriminator because mis-routed payloads should fail loudly
        # rather than silently replacing the timeline.
        declared_type = payload.type or MessageType.SCORE.value
        if declared_type != MessageType.SCORE.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"unsupported payload type: {declared_type!r}",
            )

        # ``build_score_from_payload`` is permissive and expects a plain
        # dict; use ``model_dump`` rather than ``.dict(by_alias=...)``
        # to preserve optional nested-dict contents verbatim.
        raw = payload.model_dump()
        try:
            score = await hub.apply_score(raw)
        except ValueError as exc:
            log.warning("Rejected score payload: %s", exc)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

        # Client info is optional — we only log the remote address when
        # it's present (it's ``None`` under some TestClient configurations).
        remote = request.client.host if request.client else "?"
        log.info("Score ingested via HTTP from %s: %d notes", remote, len(score.notes))
        return ScoreAck(ok=True, notes=len(score.notes), bpm=score.bpm)

    return router
