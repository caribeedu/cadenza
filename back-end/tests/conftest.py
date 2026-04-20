"""Shared pytest fixtures.

The ``autouse`` patch below short-circuits ``list_input_ports_async`` so
the FastAPI app lifespan doesn't stall on real MIDI-stack enumeration
during integration tests (the default 3 s hard ceiling would compound
across dozens of cases).
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable, Iterator
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest

from cadenza_server.app import AppConfig, create_app

if TYPE_CHECKING:
    from fastapi import FastAPI


@pytest.fixture(autouse=True)
def _stub_midi_enumeration() -> Iterator[None]:
    """Keep unit/integration tests fast and deterministic.

    Real MIDI enumeration reaches into ALSA/CoreMIDI/WinMM/WinRT and on
    some dev machines takes seconds. Tests that need to assert the
    fast-path explicitly patch the call themselves; this fixture keeps
    everyone else off the MIDI stack.
    """

    async def _empty_list(*, timeout_s: float = 3.0) -> list[str]:  # noqa: ARG001
        return []

    # Patch every module that imports the helper so the hub's
    # ``_log_startup_ports`` and any list_midi dispatch path both see
    # the stub. We only replace it for the *default* call site; tests
    # that construct their own MidiInput can still drive the real code.
    with patch("cadenza_server.features.hub.service.list_input_ports_async", _empty_list):
        yield


@pytest.fixture
def app_factory() -> Callable[..., FastAPI]:
    def _build(**overrides: object) -> FastAPI:
        config = AppConfig(**overrides)  # type: ignore[arg-type]
        return create_app(config)

    return _build
