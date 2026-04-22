"""Unit tests for :class:`MidiInput` and the async enumeration wrapper.

We intentionally avoid opening a real MIDI port — the loop clock and
callback pipeline are the only behaviours under test here.
"""

from __future__ import annotations

import asyncio
import logging
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from cadenza_server.features.midi import MidiInput


@pytest.fixture
def loop_with_fake_clock():
    """An asyncio event loop whose ``time()`` we can drive manually."""

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
        midi.mark_time_zero()
        clock["t"] = 3.0

        midi.pause()

        assert midi.is_paused is True

    def test_resume_continues_from_paused_elapsed(self, loop_with_fake_clock) -> None:
        loop, clock = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()
        clock["t"] = 3.0
        midi.pause()

        clock["t"] = 10.0
        midi.resume()

        assert midi.is_paused is False
        elapsed_after_resume = loop.time() - midi._start_time
        assert elapsed_after_resume == pytest.approx(3.0)

        clock["t"] = 11.0
        elapsed_plus_one = loop.time() - midi._start_time
        assert elapsed_plus_one == pytest.approx(4.0)

    def test_pause_is_idempotent(self, loop_with_fake_clock) -> None:
        loop, clock = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()
        clock["t"] = 2.0
        midi.pause()
        clock["t"] = 5.0
        midi.pause()

        clock["t"] = 100.0
        midi.resume()

        elapsed = loop.time() - midi._start_time
        assert elapsed == pytest.approx(2.0), (
            "Second pause clobbered the first — users would skip forward "
            "in the score on resume instead of continuing in place."
        )

    def test_resume_without_pause_is_noop(self, loop_with_fake_clock) -> None:
        loop, _ = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()
        start_before = midi._start_time

        midi.resume()

        assert midi._start_time == start_before
        assert midi.is_paused is False


class TestMidiInputCallbackResilience:
    def test_note_on_enqueues_a_midi_event(self, loop_with_fake_clock) -> None:
        loop, clock = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()
        clock["t"] = 0.5

        msg = SimpleNamespace(type="note_on", note=60, velocity=80)

        midi._on_message(msg)

        loop.run_until_complete(asyncio.sleep(0))
        event = midi.events.get_nowait()

        assert event.pitch == 60
        assert event.velocity == 80
        assert event.timestamp_ms == pytest.approx(500.0)
        assert event.on is True

    def test_note_on_velocity_zero_enqueues_note_off(self, loop_with_fake_clock) -> None:
        loop, _ = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()

        msg = SimpleNamespace(type="note_on", note=60, velocity=0)
        midi._on_message(msg)

        loop.run_until_complete(asyncio.sleep(0))
        event = midi.events.get_nowait()
        assert event.pitch == 60
        assert event.velocity == 0
        assert event.on is False

    def test_note_off_enqueues_off_event(self, loop_with_fake_clock) -> None:
        loop, _ = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()

        msg = SimpleNamespace(type="note_off", note=62, velocity=0)
        midi._on_message(msg)

        loop.run_until_complete(asyncio.sleep(0))
        event = midi.events.get_nowait()
        assert event.pitch == 62
        assert event.on is False

    def test_callback_swallows_exceptions_and_logs_them(self, loop_with_fake_clock, caplog) -> None:
        loop, _ = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()

        bad_msg = object()

        with caplog.at_level(logging.ERROR, logger="cadenza_server.features.midi.input"):
            midi._on_message(bad_msg)

        assert any("MIDI callback crashed" in rec.message for rec in caplog.records)

    def test_non_note_messages_are_logged_but_not_enqueued(self, loop_with_fake_clock) -> None:
        loop, _ = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()

        midi._on_message(SimpleNamespace(type="control_change", control=64, value=127))
        midi._on_message(SimpleNamespace(type="clock"))
        midi._on_message(SimpleNamespace(type="active_sensing"))

        loop.run_until_complete(asyncio.sleep(0))
        assert midi.events.empty()


class TestListInputPortsAsync:
    """Regression suite for TD-01 — the async wrapper must keep the event
    loop live even when the underlying blocking call stalls, and must
    raise :class:`MidiCallTimeout` on timeout."""

    def test_fast_path_returns_ports(self) -> None:
        from cadenza_server.features.midi import list_input_ports_async

        with patch(
            "cadenza_server.features.midi.input.mido.get_input_names",
            return_value=["Fake Piano"],
        ):
            result = asyncio.run(list_input_ports_async(timeout_s=1.0))

        assert result == ["Fake Piano"]

    def test_timeout_surfaces_as_midi_call_timeout(self) -> None:
        import time

        from cadenza_server.features.midi import (
            MidiCallTimeout,
            list_input_ports_async,
        )

        def slow_enumerate() -> list[str]:
            time.sleep(2.0)
            return ["never reached"]

        with (
            patch(
                "cadenza_server.features.midi.input.mido.get_input_names",
                side_effect=slow_enumerate,
            ),
            pytest.raises(MidiCallTimeout),
        ):
            asyncio.run(list_input_ports_async(timeout_s=0.05))

    def test_event_loop_stays_responsive_during_blocking_call(self) -> None:
        import time

        from cadenza_server.features.midi import list_input_ports_async

        def slow_enumerate() -> list[str]:
            time.sleep(0.3)
            return ["slow"]

        async def scenario() -> tuple[list[str], int]:
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
            "cadenza_server.features.midi.input.mido.get_input_names",
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
    def test_open_async_invokes_open_with_port_name(self) -> None:
        loop = asyncio.new_event_loop()
        try:
            midi = MidiInput(loop)
            with patch.object(MidiInput, "open", autospec=True) as mock_open:
                loop.run_until_complete(midi.open_async("Fake Piano", timeout_s=1.0))
            mock_open.assert_called_once_with(midi, "Fake Piano")
        finally:
            loop.close()

    def test_open_async_timeout_raises_midi_call_timeout(self) -> None:
        import time

        from cadenza_server.features.midi import MidiCallTimeout

        loop = asyncio.new_event_loop()
        try:
            midi = MidiInput(loop)

            def slow_open(self: MidiInput, name: str) -> None:
                time.sleep(2.0)

            with patch.object(MidiInput, "open", slow_open), pytest.raises(MidiCallTimeout):
                loop.run_until_complete(midi.open_async("Wedged Backend", timeout_s=0.05))
        finally:
            loop.close()


class TestMidiInputMarkTimeZero:
    def test_mark_time_zero_clears_pause_state(self, loop_with_fake_clock) -> None:
        loop, clock = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()
        clock["t"] = 4.0
        midi.pause()

        clock["t"] = 9.0
        midi.mark_time_zero()

        assert midi.is_paused is False
        assert (loop.time() - midi._start_time) == pytest.approx(0.0)
