"""FastAPI lifespan wiring.

Builds a lifespan context manager that starts the hub (MIDI pump +
drain task) before the server accepts traffic and tears it down on
shutdown.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from cadenza_server.features.hub import Hub

if TYPE_CHECKING:
    from fastapi import FastAPI

log = logging.getLogger("cadenza.app")


def build_lifespan(hub: Hub):  # noqa: ANN201 - return type is framework-internal
    """Return a lifespan coroutine bound to the given hub.

    Stored on the FastAPI instance via ``lifespan=lifespan``. On startup
    we call :meth:`Hub.start` (which enumerates ports and starts draining
    MIDI); on shutdown we call :meth:`Hub.stop`.
    """

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        await hub.start()
        log.info("Cadenza hub online")
        try:
            yield
        finally:
            await hub.stop()
            log.info("Cadenza hub stopped")

    return lifespan
