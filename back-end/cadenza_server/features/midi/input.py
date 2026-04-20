"""MIDI input using ``mido`` with the default ``python-rtmidi`` backend.

Callbacks from ``mido`` are executed on a background thread. We forward
``note_on`` events into an :class:`asyncio.Queue` so the async event loop
can consume them without ever blocking on a MIDI read.
"""

from __future__ import annotations

import asyncio
import logging
import threading
from dataclasses import dataclass
from typing import TYPE_CHECKING

import mido

if TYPE_CHECKING:
    from mido.ports import BaseInput  # type: ignore[import-not-found]

log = logging.getLogger(__name__)


# Default hard ceiling for any blocking mido/python-rtmidi call. The
# worst known real-world stall is BlueZ hanging on a BLE MIDI handshake
# (bluez/bluez#225). Three seconds is comfortably longer than a healthy
# ALSA/CoreMIDI/WinMM enumeration (sub-10 ms in practice) and short
# enough that the UI feels "failed" rather than "frozen". Callers may
# override per-site.
DEFAULT_MIDI_CALL_TIMEOUT_S = 3.0


class MidiCallTimeout(TimeoutError):
    """Raised when a blocking MIDI call (enumerate/open) exceeds its timeout.

    Dedicated subclass so handlers can surface a precise user-facing
    error ("Your MIDI backend isn't responding — is a BLE device mid-
    handshake?") without swallowing unrelated ``asyncio.TimeoutError``.
    """


@dataclass(frozen=True)
class MidiEvent:
    """A note event lifted from a ``mido.Message``."""

    pitch: int
    velocity: int
    timestamp_ms: float


def list_input_ports() -> list[str]:
    """Return the list of available MIDI input port names.

    Blocking call — reaches into ALSA/CoreMIDI/WinMM/WinRT via
    python-rtmidi. Async callers should route through
    :func:`list_input_ports_async` instead to avoid stalling the event
    loop on a BLE adapter handshake.
    """
    try:
        return list(mido.get_input_names())
    except Exception as exc:  # pragma: no cover - depends on platform/backend
        log.warning("Unable to enumerate MIDI ports: %s", exc)
        return []


async def list_input_ports_async(
    *, timeout_s: float = DEFAULT_MIDI_CALL_TIMEOUT_S
) -> list[str]:
    """Async wrapper around :func:`list_input_ports` with a hard timeout.

    The sync call can stall for tens of seconds when the OS MIDI
    backend is wedged; running it via :func:`asyncio.to_thread` keeps
    the event loop responsive, and wrapping in :func:`asyncio.wait_for`
    guarantees the caller gets a :class:`MidiCallTimeout` rather than
    an unbounded wait.
    """
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(list_input_ports), timeout=timeout_s
        )
    except asyncio.TimeoutError as exc:
        raise MidiCallTimeout(
            f"MIDI port enumeration timed out after {timeout_s:.1f}s"
        ) from exc


class MidiInput:
    """Async-friendly wrapper around ``mido.open_input``.

    Usage::

        midi = MidiInput(loop)
        midi.open("My Keyboard")
        event = await midi.events.get()
        ...
        midi.close()
    """

    # Message types we'd rather not spam the log with, regardless of level.
    # MIDI clock (0xF8) and active-sensing (0xFE) are emitted continuously
    # by many devices and would drown real signal in noise.
    _NOISY_TYPES: frozenset[str] = frozenset({"clock", "active_sensing"})

    def __init__(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop
        self._port: BaseInput | None = None
        self._port_name: str | None = None
        self._lock = threading.Lock()
        self._start_time = self._loop.time()
        # When paused, we remember how much time had elapsed *before* the
        # pause so we can resume from the same logical offset instead of
        # restarting the clock.
        self._paused_elapsed_s: float | None = None
        self.events: asyncio.Queue[MidiEvent] = asyncio.Queue()

    @property
    def port_name(self) -> str | None:
        return self._port_name

    @property
    def is_open(self) -> bool:
        return self._port is not None

    @property
    def is_paused(self) -> bool:
        return self._paused_elapsed_s is not None

    def mark_time_zero(self) -> None:
        """Reset the time origin used to timestamp incoming events."""
        self._start_time = self._loop.time()
        self._paused_elapsed_s = None

    def pause(self) -> None:
        """Freeze the logical clock at its current elapsed value.

        Subsequent MIDI events will still be captured (they must be, in case
        the OS delivers late note-offs), but the elapsed value stored for a
        later :meth:`resume` keeps the timeline consistent: after resume,
        event timestamps continue exactly where they left off, so any notes
        played during the pause fall outside the validator's tolerance
        window rather than silently colliding with scored notes.
        """
        if self._paused_elapsed_s is not None:
            return
        self._paused_elapsed_s = self._loop.time() - self._start_time

    def resume(self) -> None:
        """Continue from the last :meth:`pause` position. No-op if not paused."""
        if self._paused_elapsed_s is None:
            return
        self._start_time = self._loop.time() - self._paused_elapsed_s
        self._paused_elapsed_s = None

    def open(self, port_name: str) -> None:
        """Blocking open. Prefer :meth:`open_async` from async call sites.

        Kept as the primary API for unit tests (so they can stub
        ``mido.open_input`` without dragging asyncio in) and for
        synchronous bootstrap scripts.
        """
        with self._lock:
            self.close_locked()
            # ``callback`` dispatches on a background thread managed by mido.
            self._port = mido.open_input(port_name, callback=self._on_message)
            self._port_name = port_name
            log.info(
                "Opened MIDI input: %r — callback wired on thread %s. "
                "Waiting for note_on events...",
                port_name,
                threading.current_thread().name,
            )

    async def open_async(
        self,
        port_name: str,
        *,
        timeout_s: float = DEFAULT_MIDI_CALL_TIMEOUT_S,
    ) -> None:
        """Open ``port_name`` without blocking the event loop.

        Runs the synchronous :meth:`open` in a worker thread with a
        hard timeout. On timeout the call raises :class:`MidiCallTimeout`
        so the caller can surface a structured error to the UI instead
        of leaving it staring at a stalled status chip.

        Note: a hard timeout can leave the worker thread still pulling
        on the OS handshake. That thread will either finish naturally
        (harmless) or never finish if the backend is permanently wedged
        — at which point the user will need to restart the server
        process. We log a warning so this state is at least visible.
        """
        try:
            await asyncio.wait_for(
                asyncio.to_thread(self.open, port_name), timeout=timeout_s
            )
        except asyncio.TimeoutError as exc:
            log.warning(
                "MIDI open(%r) still running after %.1fs — worker thread "
                "abandoned; restart the server if it never returns.",
                port_name,
                timeout_s,
            )
            raise MidiCallTimeout(
                f"Opening MIDI port {port_name!r} timed out after {timeout_s:.1f}s"
            ) from exc

    def close(self) -> None:
        with self._lock:
            self.close_locked()

    def close_locked(self) -> None:
        if self._port is not None:
            try:
                self._port.close()
            except Exception:  # pragma: no cover - best-effort cleanup
                log.exception("Error closing MIDI port %s", self._port_name)
            self._port = None
            self._port_name = None

    def _on_message(self, msg: mido.Message) -> None:
        """mido's background-thread callback.

        Every branch is wrapped in ``try``/``except`` because mido silently
        drops callback exceptions *and* can stop delivering subsequent
        messages for the same port — a dropped exception here is the kind
        of bug that looks from the outside exactly like "the server is not
        receiving any notes from MIDI".
        """
        try:
            if msg.type in self._NOISY_TYPES:
                log.debug("MIDI raw: %s", msg)
            else:
                log.info("MIDI raw: %s", msg)

            if msg.type != "note_on" or msg.velocity == 0:
                return
            event = MidiEvent(
                pitch=int(msg.note),
                velocity=int(msg.velocity),
                timestamp_ms=(self._loop.time() - self._start_time) * 1000.0,
            )
            self._loop.call_soon_threadsafe(self.events.put_nowait, event)
        except Exception:  # pragma: no cover - background thread safety net
            log.exception("MIDI callback crashed on message: %r", msg)
