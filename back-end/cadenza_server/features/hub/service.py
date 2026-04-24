"""Hub service: owns session state and dispatches transport-agnostic messages.

Transport adapters (``features.api.ws_router``, ``features.api.score_router``)
call into the :class:`Hub` through the thin :class:`ClientConnection`
protocol. This lets us unit-test the whole dispatch pipeline without ever
booting FastAPI or opening a real socket.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any, Protocol, TypeAlias

from cadenza_server.core import protocol
from cadenza_server.core.protocol import MessageType
from cadenza_server.core.score import Score, build_score_from_payload
from cadenza_server.core.validator import Validator, unvalidated_reason
from cadenza_server.features.hub.state import Client, ClientRole, HubState
from cadenza_server.features.midi import (
    MidiCallTimeout,
    MidiEvent,
    MidiInput,
    list_input_ports_async,
)

log = logging.getLogger("cadenza.hub")


class HubError(Exception):
    """Raised for client-side errors the hub wants to surface verbatim."""


class ClientConnection(Protocol):
    """Minimum contract a transport adapter must satisfy.

    The hub only needs to send one frame at a time. Keeping this surface
    tiny lets tests fake it with a 20-line stub.
    """

    async def send_text(self, payload: str) -> None: ...


_MessageHandler: TypeAlias = Callable[[Client, dict[str, Any]], Awaitable[None]]


class Hub:
    """Stateful service coordinating the score, validator, MIDI, and clients.

    Lifecycle:

    * ``await hub.start()`` — bind the hub to the running event loop,
      create the :class:`MidiInput`, and spawn the drain task.
    * ``await hub.stop()`` — cancel the drain task and close the MIDI port.

    All other methods are safe to call from async request handlers.
    """

    def __init__(self) -> None:
        self._state = HubState()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._midi: MidiInput | None = None
        self._midi_task: asyncio.Task[None] | None = None

    @property
    def state(self) -> HubState:
        return self._state

    @property
    def midi(self) -> MidiInput:
        if self._midi is None:
            raise RuntimeError("Hub.start() has not been called yet")
        return self._midi

    async def start(self) -> None:
        """Wire the hub to the running loop. Idempotent."""
        if self._midi is not None:
            return
        self._loop = asyncio.get_running_loop()
        self._midi = MidiInput(self._loop)
        # If the hub was configured (e.g. speed pre-seeded by a test or
        # a future persistence layer) before start(), seed the new
        # MidiInput so the first note_on is already scaled correctly.
        if self._state.playback_speed != 1.0:
            self._midi.set_speed(self._state.playback_speed)
        self._midi_task = asyncio.create_task(self._drain_midi(), name="cadenza.midi")
        await self._log_startup_ports()

    async def stop(self) -> None:
        """Tear down the MIDI pump; safe to call multiple times."""
        if self._midi_task is not None:
            self._midi_task.cancel()
            try:
                await self._midi_task
            except (asyncio.CancelledError, Exception):  # pragma: no cover - teardown
                pass
            self._midi_task = None
        if self._midi is not None:
            self._midi.close()
            self._midi = None
        self._loop = None

    async def register(self, conn: ClientConnection) -> Client:
        """Register a new client and send the initial status frame."""
        client = Client(conn=conn)
        self._state.clients.add(client)
        await self._send_status_to(client)
        # Late-joining clients never saw the broadcast from ``apply_score``;
        # push the current timeline so the UI can render without a reload.
        if self._state.score is not None:
            await self._send(
                client,
                {"type": MessageType.SCORE_TIMELINE, **self._state.score.to_dict()},
            )
        return client

    def unregister(self, client: Client) -> None:
        self._state.clients.discard(client)
        log.info("Client disconnected (role=%s)", client.role)

    async def handle_message(self, client: Client, msg: dict[str, Any]) -> None:
        """Entry point for a single inbound JSON frame from a WebSocket client."""
        mtype = msg.get("type")
        handler = self._dispatch_table().get(str(mtype) if mtype is not None else "")
        if handler is None:
            await self._send(
                client,
                {"type": MessageType.ERROR, "error": f"Unknown type: {mtype}"},
            )
            return
        await handler(client, msg)

    async def apply_score(self, payload: dict[str, Any]) -> Score:
        """Common path for score payloads from both WebSocket and HTTP ingest."""
        loop = asyncio.get_running_loop()

        def on_fingering_progress(info: dict[str, Any]) -> None:
            asyncio.run_coroutine_threadsafe(
                self._emit_fingering_progress(info),
                loop,
            )

        score = await asyncio.to_thread(
            build_score_from_payload,
            payload,
            fingering_progress=on_fingering_progress,
        )
        self._state.score = score
        # Honour the currently-configured tolerance so the user-chosen
        # slider value persists across score reloads.
        self._state.validator = Validator(score, tolerance_ms=self._state.tolerance_ms)
        log.info(
            "Score received: %d notes @ %.1f BPM (tolerance=%.0f ms)",
            len(score.notes),
            score.bpm,
            self._state.tolerance_ms,
        )
        await self._broadcast_to_role(
            ClientRole.FRONTEND,
            {"type": MessageType.SCORE_TIMELINE, **score.to_dict()},
        )
        # Frontend UIs also key off ``status.score_loaded``; a timeline
        # frame alone used to leave that stale until the next unrelated
        # status (e.g. tolerance change). Echo status once per ingest.
        await self._broadcast_status()
        return score

    async def _emit_fingering_progress(self, info: dict[str, Any]) -> None:
        await self._broadcast_to_role(
            ClientRole.FRONTEND,
            {"type": MessageType.FINGERING_PROGRESS, **info},
        )

    def _dispatch_table(self) -> dict[str, _MessageHandler]:
        """Map inbound message type -> handler coroutine.

        Rebuilt per-call so test patches applied to bound methods take
        effect on the next dispatched frame.
        """
        return {
            MessageType.HELLO.value: self._on_hello,
            MessageType.SCORE.value: self._on_score,
            MessageType.LIST_MIDI.value: self._on_list_midi,
            MessageType.SELECT_MIDI.value: self._on_select_midi,
            MessageType.START.value: self._on_start,
            MessageType.PAUSE.value: self._on_pause,
            MessageType.RESUME.value: self._on_resume,
            MessageType.STOP.value: self._on_stop,
            MessageType.SEEK.value: self._on_seek,
            MessageType.SET_TOLERANCE.value: self._on_set_tolerance,
            MessageType.SET_PLAYBACK_SPEED.value: self._on_set_playback_speed,
        }

    async def _on_hello(self, client: Client, msg: dict[str, Any]) -> None:
        client.role = ClientRole.parse(msg.get("role"))
        log.info("Client hello (role=%s)", client.role)
        await self._broadcast_status()

    async def _on_score(self, _client: Client, msg: dict[str, Any]) -> None:
        await self.apply_score(msg)

    async def _on_list_midi(self, client: Client, _msg: dict[str, Any]) -> None:
        try:
            ports = await list_input_ports_async()
        except MidiCallTimeout as exc:
            log.warning("list_midi: %s", exc)
            await self._send(client, {"type": MessageType.ERROR, "error": str(exc)})
            return
        await self._send(client, {"type": MessageType.MIDI_PORTS, "ports": ports})

    async def _on_select_midi(self, client: Client, msg: dict[str, Any]) -> None:
        port = msg.get("port")
        if not port:
            await self._send(client, {"type": MessageType.ERROR, "error": "Missing port"})
            return
        try:
            await self.midi.open_async(str(port))
        except MidiCallTimeout as exc:
            log.warning("select_midi: %s", exc)
            await self._send(client, {"type": MessageType.ERROR, "error": str(exc)})
            return
        except Exception as exc:
            log.exception("Failed to open MIDI port")
            await self._send(client, {"type": MessageType.ERROR, "error": str(exc)})
            return
        await self._broadcast_status()

    async def _on_start(self, _client: Client, _msg: dict[str, Any]) -> None:
        if not self.midi.is_open:
            # Most common UX misstep: hitting Start without selecting a
            # device first. The server still starts its clock, but no
            # note_on will ever arrive. Say so loudly in the log.
            log.warning(
                "Start pressed but no MIDI port is open. "
                "Select a device in the UI and click 'Use device' first."
            )
        self.midi.mark_time_zero()
        if self._state.validator is not None:
            self._state.validator.reset()
        self._state.playing = True
        self._state.paused = False
        await self._broadcast_status()

    async def _on_pause(self, _client: Client, _msg: dict[str, Any]) -> None:
        if self._state.playing and not self._state.paused:
            self.midi.pause()
            self._state.playing = False
            self._state.paused = True
            await self._broadcast_status()

    async def _on_resume(self, _client: Client, _msg: dict[str, Any]) -> None:
        if self._state.paused:
            self.midi.resume()
            self._state.playing = True
            self._state.paused = False
            await self._broadcast_status()

    async def _on_stop(self, _client: Client, _msg: dict[str, Any]) -> None:
        self._state.playing = False
        self._state.paused = False
        await self._broadcast_status()

    async def _on_seek(self, client: Client, msg: dict[str, Any]) -> None:
        value = msg.get("elapsed_ms")
        parsed: float | None
        try:
            parsed = float(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            parsed = None
        if parsed is None or isinstance(value, bool) or parsed < 0 or parsed != parsed:
            await self._send(
                client,
                {
                    "type": MessageType.ERROR,
                    "error": "elapsed_ms must be a non-negative finite number",
                },
            )
            return
        # Seeking while running must pause session; frontend expects this and
        # server remains authoritative even if frames arrive out of order.
        if self._state.playing and not self._state.paused:
            self.midi.pause()
        self.midi.seek_to_ms(parsed)
        self._state.playing = False
        self._state.paused = True
        if self._state.validator is not None:
            self._state.validator.reset()
        await self._broadcast_status()

    async def _on_set_tolerance(self, client: Client, msg: dict[str, Any]) -> None:
        value = msg.get("tolerance_ms")
        # Accept int/float/string-of-number for forward compatibility with
        # clients that don't coerce on the way out. Reject booleans
        # (``bool`` is an ``int`` subclass in Python) and anything negative.
        parsed: float | None
        try:
            parsed = float(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            parsed = None
        if parsed is None or isinstance(value, bool) or parsed < 0:
            await self._send(
                client,
                {
                    "type": MessageType.ERROR,
                    "error": "tolerance_ms must be a non-negative number",
                },
            )
            return
        self._state.tolerance_ms = parsed
        if self._state.validator is not None:
            self._state.validator.tolerance_ms = parsed
        log.info("Hit-timing tolerance set to %.0f ms", parsed)
        await self._broadcast_status()

    async def _on_set_playback_speed(self, client: Client, msg: dict[str, Any]) -> None:
        """Apply a new replay-speed multiplier.

        Validation matches ``_on_set_tolerance`` in spirit: reject
        booleans (``bool`` is an ``int`` subclass), non-numerics, and
        anything that isn't strictly positive. The MIDI clock is
        rebased inside :meth:`MidiInput.set_speed` so a live change
        doesn't skip the playhead.
        """
        value = msg.get("playback_speed")
        parsed: float | None
        try:
            parsed = float(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            parsed = None
        if (
            parsed is None
            or isinstance(value, bool)
            or not (parsed > 0)
            or parsed != parsed  # NaN guard; ``float('nan') > 0`` is False anyway
        ):
            await self._send(
                client,
                {
                    "type": MessageType.ERROR,
                    "error": "playback_speed must be a positive finite number",
                },
            )
            return
        self._state.playback_speed = parsed
        if self._midi is not None:
            try:
                self._midi.set_speed(parsed)
            except ValueError as exc:  # defensive; validator above rejects first
                await self._send(client, {"type": MessageType.ERROR, "error": str(exc)})
                return
        log.info("Playback speed set to %.3fx", parsed)
        await self._broadcast_status()

    async def _drain_midi(self) -> None:
        assert self._midi is not None
        while True:
            try:
                event = await self._midi.events.get()
            except asyncio.CancelledError:  # pragma: no cover - teardown
                raise
            await self._handle_midi_event(event)

    async def _handle_midi_event(self, event: MidiEvent) -> None:
        if not event.on:
            log.info(
                "MIDI note_off pitch=%d t=%.1fms",
                event.pitch,
                event.timestamp_ms,
            )
            await self._broadcast_to_role(
                ClientRole.FRONTEND,
                {
                    "type": MessageType.NOTE_OFF,
                    "pitch": event.pitch,
                },
            )
            return

        validator = self._state.validator
        reason = unvalidated_reason(
            validator, playing=self._state.playing, paused=self._state.paused
        )

        if reason is not None:
            # Still forward raw "note played" for visual feedback. ``correct``
            # is ``None`` here (distinct from ``False``) so the frontend can
            # tell "no validation context" from "validated and wrong" — the
            # former should produce a neutral key flash with a reason hint,
            # the latter a red flash with a miss indicator.
            log.info(
                "MIDI note_on pitch=%d vel=%d t=%.1fms (unvalidated: %s)",
                event.pitch,
                event.velocity,
                event.timestamp_ms,
                reason,
            )
            await self._broadcast_to_role(
                ClientRole.FRONTEND,
                {
                    "type": MessageType.NOTE_PLAYED,
                    "correct": None,
                    "played_pitch": event.pitch,
                    "played_time_ms": event.timestamp_ms,
                    # Matches ``ValidationResult.to_dict`` shape exactly so the
                    # frontend doesn't need a special-case branch for the
                    # unvalidated path.
                    "expected_id": None,
                    "expected_pitch": None,
                    "expected_time_ms": None,
                    "delta_ms": None,
                    "reason": reason,
                },
            )
            return

        assert validator is not None
        log.info(
            "MIDI note_on pitch=%d vel=%d t=%.1fms",
            event.pitch,
            event.velocity,
            event.timestamp_ms,
        )
        result = validator.validate(event.pitch, event.timestamp_ms)
        log.info(
            "VALIDATE pitch=%d t=%.1fms -> %s delta=%s",
            event.pitch,
            event.timestamp_ms,
            "HIT" if result.correct else "MISS",
            f"{result.delta_ms:.1f}ms" if result.delta_ms is not None else "n/a",
        )
        await self._broadcast_to_role(
            ClientRole.FRONTEND,
            {"type": MessageType.NOTE_PLAYED, **result.to_dict()},
        )

    async def _send(self, client: Client, message: dict[str, Any]) -> None:
        try:
            await client.conn.send_text(protocol.encode(message))
        except Exception:
            # Intentionally swallowed: the hub should not abort dispatch because
            # one of its clients went away mid-send. The transport adapter will
            # surface disconnects via its own loop and call ``unregister``.
            pass

    async def _broadcast_to_role(self, role: ClientRole, message: dict[str, Any]) -> None:
        payload = protocol.encode(message)
        await asyncio.gather(
            *(c.conn.send_text(payload) for c in list(self._state.clients) if c.role == role),
            return_exceptions=True,
        )

    async def _broadcast_status(self) -> None:
        await asyncio.gather(
            *(self._send_status_to(c) for c in list(self._state.clients)),
            return_exceptions=True,
        )

    async def _send_status_to(self, client: Client) -> None:
        # ``elapsed_ms`` is the server-authoritative virtual-time
        # playhead. Clients use it to align their local renderer to the
        # backend clock whenever the speed changes or a client joins
        # mid-session — without it, slider drags and reconnects silently
        # drift the two sides apart (the backend rebases on commit
        # while the frontend rebased optimistically on every pixel tick,
        # leaving a persistent offset that showed up as systematically
        # negative ``delta_ms`` after a round-trip of the slider).
        #
        # Outside an active session (not playing and not paused) we
        # pin ``elapsed_ms`` to ``0.0`` instead of exposing the raw
        # ``MidiInput`` clock (which keeps ticking since construction).
        # This prevents a client that reconnects between Stop and Start
        # from aligning its renderer to a meaningless offset.
        if self._midi is not None and (self._state.playing or self._state.paused):
            elapsed_ms = self._midi.virtual_elapsed_ms
        else:
            elapsed_ms = 0.0
        status = {
            "type": MessageType.STATUS,
            "midi_port": self._midi.port_name if self._midi else None,
            "midi_open": bool(self._midi and self._midi.is_open),
            "playing": self._state.playing,
            "paused": self._state.paused,
            "score_loaded": self._state.score is not None,
            "tolerance_ms": self._state.tolerance_ms,
            "playback_speed": self._state.playback_speed,
            "elapsed_ms": elapsed_ms,
            "clients": {
                role.value: sum(1 for c in self._state.clients if c.role == role)
                for role in (
                    ClientRole.PLUGIN,
                    ClientRole.FRONTEND,
                    ClientRole.UNKNOWN,
                )
            },
        }
        await self._send(client, status)

    async def _log_startup_ports(self) -> None:
        """Surface enumerated MIDI ports at startup.

        The most common root cause of "the server isn't receiving any notes"
        is an invisible/unselected device. A timeout here must NOT abort boot:
        the hub can still serve score ingests and forward MIDI events that
        arrive later (e.g. once the user triggers a refresh).
        """
        try:
            ports = await list_input_ports_async()
        except MidiCallTimeout as exc:
            log.warning(
                "Startup MIDI enumeration stalled (%s). Continuing without "
                "the port list; the user can retry via the UI Refresh button.",
                exc,
            )
            return

        if ports:
            log.info("MIDI input ports visible to this process (%d):", len(ports))
            for i, name in enumerate(ports):
                log.info("  [%d] %s", i, name)
        else:
            log.warning(
                "No MIDI input ports are visible. Plug the keyboard in, make "
                "sure no other app holds it exclusively, then click Refresh "
                "in the UI."
            )
