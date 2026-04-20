"""WebSocket hub wiring together the plugin, the frontend, and MIDI input.

Every client (MuseScore plugin, Electron UI, or ad-hoc tester) is treated
identically: it announces a ``role`` in its ``hello`` message. The server
fans out messages to the right audience based on that role.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional

from websockets.asyncio.server import ServerConnection, serve
from websockets.exceptions import ConnectionClosed

from . import protocol
from .http_ingest import DEFAULT_PORT as DEFAULT_HTTP_PORT
from .http_ingest import serve_ingest
from .midi_input import (
    MidiCallTimeout,
    MidiEvent,
    MidiInput,
    list_input_ports_async,
)
from .score import Score, build_score_from_payload
from .validator import DEFAULT_TOLERANCE_MS, Validator

log = logging.getLogger("cadenza.server")

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765


def unvalidated_reason(
    validator: Optional[Validator], playing: bool, paused: bool
) -> Optional[str]:
    """Why an incoming MIDI event is *not* being validated right now.

    Returns ``None`` when validation can proceed, otherwise one of:

    * ``"no_score"``     — no MuseScore timeline has been ingested yet.
    * ``"paused"``       — session was paused via MSG_PAUSE.
    * ``"not_started"``  — score loaded but playback hasn't been started.

    Pure function (no side effects) so it's directly unit-testable without
    spinning up the hub.
    """
    if validator is None:
        return "no_score"
    if paused:
        return "paused"
    if not playing:
        return "not_started"
    return None


@dataclass(eq=False)
class Client:
    """Per-connection state. Identity-based equality/hash so instances work in sets."""

    conn: ServerConnection
    role: str = "unknown"


@dataclass
class HubState:
    score: Optional[Score] = None
    validator: Optional[Validator] = None
    clients: set[Client] = field(default_factory=set)
    playing: bool = False
    paused: bool = False
    # Kept on the hub rather than per-validator so a user-chosen
    # tolerance survives score reloads (the plugin can push a new
    # timeline at any time; the slider should not reset).
    tolerance_ms: float = DEFAULT_TOLERANCE_MS


class CadenzaServer:
    """Top-level async component owning the hub state and MIDI pump."""

    def __init__(
        self,
        host: str = DEFAULT_HOST,
        port: int = DEFAULT_PORT,
        http_port: int = DEFAULT_HTTP_PORT,
    ):
        self._host = host
        self._port = port
        self._http_port = http_port
        self._state = HubState()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._midi: Optional[MidiInput] = None
        self._midi_task: Optional[asyncio.Task[None]] = None

    async def run(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._midi = MidiInput(self._loop)
        self._midi_task = asyncio.create_task(self._drain_midi(), name="cadenza.midi")

        http_server = await serve_ingest(self._host, self._http_port, self._ingest_score_http)

        # Surface the list of enumerated MIDI ports at startup so the user
        # can immediately tell whether their device is even visible to the
        # process — the most common root cause of "the server isn't
        # receiving any notes". A timeout here must NOT abort boot: the
        # hub can still serve score ingests and forward MIDI events that
        # arrive later (e.g. once the user triggers a refresh).
        try:
            ports = await list_input_ports_async()
        except MidiCallTimeout as exc:
            log.warning(
                "Startup MIDI enumeration stalled (%s). Continuing without "
                "the port list; the user can retry via the UI Refresh button.",
                exc,
            )
            ports = []

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

        log.info("Cadenza server listening on ws://%s:%d", self._host, self._port)
        async with serve(self._handler, self._host, self._port) as server:
            try:
                await server.serve_forever()
            finally:
                if self._midi_task:
                    self._midi_task.cancel()
                if self._midi:
                    self._midi.close()
                http_server.close()
                await http_server.wait_closed()

    async def _handler(self, conn: ServerConnection) -> None:
        client = Client(conn=conn)
        self._state.clients.add(client)
        await self._send_status_to(client)
        try:
            async for raw in conn:
                try:
                    msg = protocol.decode(raw)
                except (ValueError, UnicodeDecodeError) as exc:
                    await self._send(client, {"type": protocol.MSG_ERROR, "error": str(exc)})
                    continue
                await self._dispatch(client, msg)
        except ConnectionClosed:
            pass
        finally:
            self._state.clients.discard(client)
            log.info("Client disconnected (role=%s)", client.role)

    async def _dispatch(self, client: Client, msg: dict) -> None:
        mtype = msg.get("type")
        if mtype == protocol.MSG_HELLO:
            client.role = str(msg.get("role") or "unknown")
            log.info("Client hello (role=%s)", client.role)
            await self._broadcast_status()
            return

        if mtype == protocol.MSG_SCORE:
            await self._apply_score(msg)
            return

        if mtype == protocol.MSG_LIST_MIDI:
            try:
                ports = await list_input_ports_async()
            except MidiCallTimeout as exc:
                # The client asked for a port list and we couldn't
                # deliver one within the hard timeout. Don't leave them
                # staring at nothing — push a structured error frame so
                # the UI can show the user what's going on.
                log.warning("list_midi: %s", exc)
                await self._send(
                    client,
                    {"type": protocol.MSG_ERROR, "error": str(exc)},
                )
                return
            await self._send(
                client,
                {"type": protocol.MSG_MIDI_PORTS, "ports": ports},
            )
            return

        if mtype == protocol.MSG_SELECT_MIDI:
            port = msg.get("port")
            if not port:
                await self._send(client, {"type": protocol.MSG_ERROR, "error": "Missing port"})
                return
            assert self._midi is not None
            try:
                await self._midi.open_async(str(port))
            except MidiCallTimeout as exc:
                log.warning("select_midi: %s", exc)
                await self._send(client, {"type": protocol.MSG_ERROR, "error": str(exc)})
                return
            except Exception as exc:
                log.exception("Failed to open MIDI port")
                await self._send(client, {"type": protocol.MSG_ERROR, "error": str(exc)})
                return
            await self._broadcast_status()
            return

        if mtype == protocol.MSG_START:
            assert self._midi is not None
            if not self._midi.is_open:
                # Most common UX misstep: hitting Start without selecting a
                # device first. The server still starts its clock, but no
                # note_on will ever arrive. Say so loudly in the log.
                log.warning(
                    "Start pressed but no MIDI port is open. "
                    "Select a device in the UI and click 'Use device' first."
                )
            self._midi.mark_time_zero()
            if self._state.validator is not None:
                self._state.validator.reset()
            self._state.playing = True
            self._state.paused = False
            await self._broadcast_status()
            return

        if mtype == protocol.MSG_PAUSE:
            assert self._midi is not None
            if self._state.playing and not self._state.paused:
                self._midi.pause()
                self._state.playing = False
                self._state.paused = True
                await self._broadcast_status()
            return

        if mtype == protocol.MSG_RESUME:
            assert self._midi is not None
            if self._state.paused:
                self._midi.resume()
                self._state.playing = True
                self._state.paused = False
                await self._broadcast_status()
            return

        if mtype == protocol.MSG_STOP:
            self._state.playing = False
            self._state.paused = False
            await self._broadcast_status()
            return

        if mtype == protocol.MSG_SET_TOLERANCE:
            value = msg.get("tolerance_ms")
            # Accept int/float/string-of-number for forward compatibility
            # with clients that don't coerce on the way out. Reject
            # booleans (``bool`` is an ``int`` subclass in Python) and
            # anything negative.
            try:
                parsed = float(value)
            except (TypeError, ValueError):
                parsed = None
            if parsed is None or isinstance(value, bool) or parsed < 0:
                await self._send(
                    client,
                    {
                        "type": protocol.MSG_ERROR,
                        "error": "tolerance_ms must be a non-negative number",
                    },
                )
                return
            self._state.tolerance_ms = parsed
            if self._state.validator is not None:
                self._state.validator.tolerance_ms = parsed
            log.info("Hit-timing tolerance set to %.0f ms", parsed)
            await self._broadcast_status()
            return

        await self._send(client, {"type": protocol.MSG_ERROR, "error": f"Unknown type: {mtype}"})

    async def _apply_score(self, msg: dict) -> Score:
        """Common path for score payloads from both WebSocket and HTTP ingest."""

        score = build_score_from_payload(msg)
        self._state.score = score
        # Honour the currently-configured tolerance so the user-chosen
        # slider value persists across score reloads.
        self._state.validator = Validator(
            score, tolerance_ms=self._state.tolerance_ms
        )
        log.info(
            "Score received: %d notes @ %.1f BPM (tolerance=%.0f ms)",
            len(score.notes),
            score.bpm,
            self._state.tolerance_ms,
        )
        await self._broadcast_to_role(
            "frontend",
            {"type": protocol.MSG_SCORE_TIMELINE, **score.to_dict()},
        )
        return score

    async def _ingest_score_http(self, payload: dict) -> dict:
        """HTTP adapter: reject non-score payloads, apply, return a JSON ack."""

        ptype = payload.get("type", protocol.MSG_SCORE)
        if ptype != protocol.MSG_SCORE:
            raise ValueError(f"unsupported payload type: {ptype!r}")
        score = await self._apply_score(payload)
        return {"ok": True, "notes": len(score.notes), "bpm": score.bpm}

    async def _drain_midi(self) -> None:
        assert self._midi is not None
        while True:
            try:
                event = await self._midi.events.get()
            except asyncio.CancelledError:  # pragma: no cover - teardown path
                raise
            await self._handle_midi_event(event)

    async def _handle_midi_event(self, event: MidiEvent) -> None:
        validator = self._state.validator
        reason = unvalidated_reason(
            validator, self._state.playing, self._state.paused
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
                "frontend",
                {
                    "type": protocol.MSG_NOTE_PLAYED,
                    "correct": None,
                    "played_pitch": event.pitch,
                    "played_time_ms": event.timestamp_ms,
                    # Matches ``ValidationResult.to_dict`` shape exactly
                    # so the frontend doesn't need a special-case branch
                    # for the unvalidated path.
                    "expected_id": None,
                    "expected_pitch": None,
                    "expected_time_ms": None,
                    "delta_ms": None,
                    "reason": reason,
                },
            )
            return

        assert validator is not None  # narrowed by unvalidated_reason == None
        log.info(
            "MIDI note_on pitch=%d vel=%d t=%.1fms",
            event.pitch,
            event.velocity,
            event.timestamp_ms,
        )
        result = validator.validate(event.pitch, event.timestamp_ms)
        log.info(
            "VALIDATE pitch=%d t=%.1fms → %s Δ=%s",
            event.pitch,
            event.timestamp_ms,
            "HIT" if result.correct else "MISS",
            f"{result.delta_ms:.1f}ms" if result.delta_ms is not None else "n/a",
        )
        await self._broadcast_to_role(
            "frontend",
            {"type": protocol.MSG_NOTE_PLAYED, **result.to_dict()},
        )

    async def _send(self, client: Client, message: dict) -> None:
        try:
            await client.conn.send(protocol.encode(message))
        except ConnectionClosed:
            pass

    async def _broadcast_to_role(self, role: str, message: dict) -> None:
        payload = protocol.encode(message)
        await asyncio.gather(
            *(
                c.conn.send(payload)
                for c in list(self._state.clients)
                if c.role == role
            ),
            return_exceptions=True,
        )

    async def _broadcast_status(self) -> None:
        await asyncio.gather(
            *(self._send_status_to(c) for c in list(self._state.clients)),
            return_exceptions=True,
        )

    async def _send_status_to(self, client: Client) -> None:
        status = {
            "type": protocol.MSG_STATUS,
            "midi_port": self._midi.port_name if self._midi else None,
            "midi_open": bool(self._midi and self._midi.is_open),
            "playing": self._state.playing,
            "paused": self._state.paused,
            "score_loaded": self._state.score is not None,
            "tolerance_ms": self._state.tolerance_ms,
            "clients": {
                role: sum(1 for c in self._state.clients if c.role == role)
                for role in ("plugin", "frontend", "unknown")
            },
        }
        await self._send(client, status)
