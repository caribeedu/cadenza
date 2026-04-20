"""Unit tests for the pause/resume timing contract on :class:`MidiInput`.

We intentionally avoid opening a real MIDI port — the loop clock is the
only behaviour under test here. ``asyncio.get_event_loop`` returns a new
loop in each test so clock readings are deterministic.
"""

from __future__ import annotations

import asyncio
import logging
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from cadenza_server.midi_input import MidiInput


@pytest.fixture
def loop_with_fake_clock():
    """An asyncio event loop whose ``time()`` we can drive manually.

    Patching ``time()`` on the loop (rather than ``time.monotonic``) keeps
    the test resilient to whatever clock the production ``mark_time_zero``
    path reads from.
    """

    loop = asyncio.new_event_loop()
    current = {"t": 0.0}

    def fake_time() -> float:
        return current["t"]

    with patch.object(loop, "time", fake_time):
        yield loop, current
    loop.close()


class TestMidiInputPauseResume:
    def test_pause_records_current_elapsed(self, loop_with_fake_clock) -> None:
        loop, clock = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()  # t0 = 0.0
        clock["t"] = 3.0

        midi.pause()

        assert midi.is_paused is True
        # Internally we store elapsed seconds; verify via the public
        # resume() side-effect below rather than reaching into privates.

    def test_resume_continues_from_paused_elapsed(self, loop_with_fake_clock) -> None:
        loop, clock = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()  # t0 = 0.0
        clock["t"] = 3.0
        midi.pause()            # elapsed at pause = 3.0 s

        clock["t"] = 10.0       # simulate 7 s of wall-clock drift while paused
        midi.resume()

        # After resume, the logical clock should read 3.0 s, not 10.0 s.
        assert midi.is_paused is False
        # _start_time adjusted so that (now - start) == paused_elapsed.
        # Use loop.time() - _start_time rather than touching _start_time
        # to keep coupling to one attribute.
        elapsed_after_resume = loop.time() - midi._start_time  # noqa: SLF001
        assert elapsed_after_resume == pytest.approx(3.0)

        # And one second later, the elapsed value should be 4.0 s —
        # demonstrating the timeline continues from where it was paused.
        clock["t"] = 11.0
        elapsed_plus_one = loop.time() - midi._start_time  # noqa: SLF001
        assert elapsed_plus_one == pytest.approx(4.0)

    def test_pause_is_idempotent(self, loop_with_fake_clock) -> None:
        loop, clock = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()
        clock["t"] = 2.0
        midi.pause()
        clock["t"] = 5.0
        midi.pause()            # second call must not overwrite the stored elapsed

        clock["t"] = 100.0
        midi.resume()

        elapsed = loop.time() - midi._start_time  # noqa: SLF001
        assert elapsed == pytest.approx(2.0), (
            "Second pause clobbered the first — users would skip forward "
            "in the score on resume instead of continuing in place."
        )

    def test_resume_without_pause_is_noop(self, loop_with_fake_clock) -> None:
        loop, _ = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()
        start_before = midi._start_time  # noqa: SLF001

        midi.resume()

        assert midi._start_time == start_before  # noqa: SLF001
        assert midi.is_paused is False

class TestMidiInputCallbackResilience:
    """The mido background thread silently swallows exceptions raised by
    ``_on_message`` and may stop delivering messages after one. We wrap the
    body in a try/except so a single bad message can't kill the pipeline.
    These tests cover the two contract points: (1) note_on messages still
    enqueue an event after an unrelated exception path, and (2) exceptions
    are logged, not propagated."""

    def test_note_on_enqueues_a_midi_event(self, loop_with_fake_clock) -> None:
        loop, clock = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()
        clock["t"] = 0.5  # 500 ms after start

        msg = SimpleNamespace(type="note_on", note=60, velocity=80)

        midi._on_message(msg)  # noqa: SLF001 - exercising the thread callback

        # _on_message schedules via call_soon_threadsafe; drain it.
        loop.run_until_complete(asyncio.sleep(0))
        event = midi.events.get_nowait()

        assert event.pitch == 60
        assert event.velocity == 80
        assert event.timestamp_ms == pytest.approx(500.0)

    def test_note_on_velocity_zero_is_treated_as_note_off(
        self, loop_with_fake_clock
    ) -> None:
        loop, _ = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()

        msg = SimpleNamespace(type="note_on", note=60, velocity=0)
        midi._on_message(msg)  # noqa: SLF001

        loop.run_until_complete(asyncio.sleep(0))
        assert midi.events.empty(), "velocity-0 note_on must not enqueue an event"

    def test_callback_swallows_exceptions_and_logs_them(
        self, loop_with_fake_clock, caplog
    ) -> None:
        """Regression: an attribute error inside the callback used to kill
        the mido delivery thread silently. The try/except around
        ``_on_message`` must turn that into a logged error while keeping
        the callback returning normally."""
        loop, _ = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()

        # A malformed object that'll raise AttributeError on `.type`.
        bad_msg = object()

        with caplog.at_level(logging.ERROR, logger="cadenza_server.midi_input"):
            # Must not raise — the thread would crash if it did.
            midi._on_message(bad_msg)  # noqa: SLF001

        assert any(
            "MIDI callback crashed" in rec.message for rec in caplog.records
        ), "Expected an ERROR log when the callback handles a bad message"

    def test_non_note_messages_are_logged_but_not_enqueued(
        self, loop_with_fake_clock
    ) -> None:
        loop, _ = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()

        midi._on_message(  # noqa: SLF001
            SimpleNamespace(type="control_change", control=64, value=127)
        )
        midi._on_message(SimpleNamespace(type="clock"))  # noqa: SLF001
        midi._on_message(SimpleNamespace(type="active_sensing"))  # noqa: SLF001

        loop.run_until_complete(asyncio.sleep(0))
        assert midi.events.empty()


class TestListInputPortsAsync:
    """Regression suite for TD-01 — the async wrapper must keep the event
    loop live even when the underlying blocking call stalls, and must
    raise :class:`MidiCallTimeout` on timeout."""

    def test_fast_path_returns_ports(self) -> None:
        from cadenza_server.midi_input import list_input_ports_async

        with patch(
            "cadenza_server.midi_input.mido.get_input_names",
            return_value=["Fake Piano"],
        ):
            result = asyncio.run(list_input_ports_async(timeout_s=1.0))

        assert result == ["Fake Piano"]

    def test_timeout_surfaces_as_MidiCallTimeout(self) -> None:
        # Simulate a wedged backend: the sync call sleeps for longer
        # than the wrapper's timeout. ``asyncio.to_thread`` runs it in
        # a worker; ``asyncio.wait_for`` should raise before the sleep
        # returns.
        import time

        from cadenza_server.midi_input import (
            MidiCallTimeout,
            list_input_ports_async,
        )

        def slow_enumerate() -> list[str]:
            time.sleep(2.0)
            return ["never reached"]

        with patch(
            "cadenza_server.midi_input.mido.get_input_names",
            side_effect=slow_enumerate,
        ):
            with pytest.raises(MidiCallTimeout):
                asyncio.run(list_input_ports_async(timeout_s=0.05))

    def test_event_loop_stays_responsive_during_blocking_call(self) -> None:
        """The whole point of TD-01: while the blocking MIDI call is
        in-flight, *other* coroutines scheduled on the same loop must
        keep running. If we regressed to a direct call, this test would
        time out because the loop would be blocked."""
        import time

        from cadenza_server.midi_input import list_input_ports_async

        def slow_enumerate() -> list[str]:
            time.sleep(0.3)
            return ["slow"]

        async def scenario() -> tuple[list[str], int]:
            # A lightweight "heartbeat" coroutine that ticks while the
            # MIDI call is supposedly in-flight. If the event loop were
            # blocked, the ticks would pile up at the end instead of
            # being interleaved.
            ticks = 0

            async def heartbeat() -> None:
                nonlocal ticks
                for _ in range(10):
                    await asyncio.sleep(0.02)
                    ticks += 1

            hb = asyncio.create_task(heartbeat())
            ports = await list_input_ports_async(timeout_s=1.0)
            await hb
            return ports, ticks

        with patch(
            "cadenza_server.midi_input.mido.get_input_names",
            side_effect=slow_enumerate,
        ):
            ports, ticks = asyncio.run(scenario())

        assert ports == ["slow"]
        assert ticks == 10, (
            f"Heartbeat only managed {ticks}/10 ticks — the event loop "
            "was blocked while the MIDI call was in-flight. TD-01 has "
            "regressed."
        )


class TestMidiInputOpenAsync:
    """Open-path mirror of ``TestListInputPortsAsync``."""

    def test_open_async_invokes_open_with_port_name(self) -> None:
        loop = asyncio.new_event_loop()
        try:
            midi = MidiInput(loop)
            with patch.object(MidiInput, "open", autospec=True) as mock_open:
                loop.run_until_complete(
                    midi.open_async("Fake Piano", timeout_s=1.0)
                )
            mock_open.assert_called_once_with(midi, "Fake Piano")
        finally:
            loop.close()

    def test_open_async_timeout_raises_MidiCallTimeout(self) -> None:
        import time

        from cadenza_server.midi_input import MidiCallTimeout

        loop = asyncio.new_event_loop()
        try:
            midi = MidiInput(loop)

            def slow_open(self: MidiInput, name: str) -> None:
                time.sleep(2.0)

            with patch.object(MidiInput, "open", slow_open):
                with pytest.raises(MidiCallTimeout):
                    loop.run_until_complete(
                        midi.open_async("Wedged Backend", timeout_s=0.05)
                    )
        finally:
            loop.close()


class TestMidiInputMarkTimeZero:
    def test_mark_time_zero_clears_pause_state(self, loop_with_fake_clock) -> None:
        loop, clock = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()
        clock["t"] = 4.0
        midi.pause()

        # A fresh Start re-arms the clock from zero and should *not* retain
        # the previous pause offset, otherwise pressing Start after Pause
        # would immediately jump the user forward.
        clock["t"] = 9.0
        midi.mark_time_zero()

        assert midi.is_paused is False
        assert (loop.time() - midi._start_time) == pytest.approx(0.0)  # noqa: SLF001
