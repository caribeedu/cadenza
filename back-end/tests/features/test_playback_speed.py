"""Regression suite for the replay-speed feature.

We cover the three invariants that keep the playhead honest:

1. At ``speed == 1.0`` every other behaviour (timestamping, pause/resume
   rebasing) is byte-identical to the pre-feature code.
2. A live :meth:`MidiInput.set_speed` call does **not** teleport the
   virtual playhead — the user's bar stays where it was on screen.
3. Invalid inputs (non-positive, NaN, ``bool``) raise ``ValueError`` so
   the hub can surface a structured error rather than silently
   corrupting timing.

Note: :meth:`MidiInput._on_message` enqueues via
``loop.call_soon_threadsafe`` (because mido's callback runs on a
background thread in production). In tests we pump the loop once with
``run_until_complete(asyncio.sleep(0))`` before draining the queue —
same pattern as the pre-existing ``test_midi_input`` suite.
"""

from __future__ import annotations

import asyncio
import math
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from cadenza_server.features.midi import DEFAULT_PLAYBACK_SPEED, MidiEvent, MidiInput


@pytest.fixture
def loop_with_fake_clock():
    loop = asyncio.new_event_loop()
    current = {"t": 0.0}

    def fake_time() -> float:
        return current["t"]

    with patch.object(loop, "time", fake_time):
        yield loop, current
    loop.close()


def _drain_event(loop: asyncio.AbstractEventLoop, midi: MidiInput) -> MidiEvent:
    """Pump the loop once so ``call_soon_threadsafe`` callbacks land."""
    loop.run_until_complete(asyncio.sleep(0))
    return midi.events.get_nowait()


class TestMidiInputSpeedTimestamping:
    def test_default_speed_is_one(self, loop_with_fake_clock) -> None:
        loop, _ = loop_with_fake_clock
        midi = MidiInput(loop)
        assert midi.speed == DEFAULT_PLAYBACK_SPEED == 1.0

    def test_half_speed_halves_event_timestamp(self, loop_with_fake_clock) -> None:
        loop, clock = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()
        midi.set_speed(0.5)

        clock["t"] = 2.0
        midi._on_message(SimpleNamespace(type="note_on", note=60, velocity=80))

        event = _drain_event(loop, midi)
        assert event.timestamp_ms == pytest.approx(1000.0), (
            "At 0.5x speed, two wall-seconds should register as one "
            "score-second — otherwise the validator's tolerance check "
            "would compare against the wrong scored note time."
        )

    def test_double_speed_doubles_event_timestamp(self, loop_with_fake_clock) -> None:
        loop, clock = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()
        midi.set_speed(2.0)

        clock["t"] = 0.5
        midi._on_message(SimpleNamespace(type="note_on", note=60, velocity=80))

        event = _drain_event(loop, midi)
        assert event.timestamp_ms == pytest.approx(1000.0)


class TestMidiInputSpeedRebase:
    """Live speed changes must preserve the virtual playhead."""

    def test_set_speed_while_playing_preserves_virtual_time(self, loop_with_fake_clock) -> None:
        loop, clock = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()

        # Play at 1x for 2 s → virtual 2000 ms.
        clock["t"] = 2.0
        midi._on_message(SimpleNamespace(type="note_on", note=60, velocity=80))
        assert _drain_event(loop, midi).timestamp_ms == pytest.approx(2000.0)

        # Switch to 0.5x mid-song.
        midi.set_speed(0.5)

        # Zero extra wall time: virtual should still be ~2000 ms.
        midi._on_message(SimpleNamespace(type="note_on", note=62, velocity=80))
        assert _drain_event(loop, midi).timestamp_ms == pytest.approx(2000.0), (
            "Speed change teleported the playhead — the user would see "
            "their falling bar jump to a different position."
        )

        # Advance wall clock by 1 s at 0.5x → +500 ms virtual.
        clock["t"] = 3.0
        midi._on_message(SimpleNamespace(type="note_on", note=64, velocity=80))
        assert _drain_event(loop, midi).timestamp_ms == pytest.approx(2500.0)

    def test_set_speed_while_paused_does_not_shift_stored_position(
        self, loop_with_fake_clock
    ) -> None:
        loop, clock = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()

        clock["t"] = 3.0
        midi.pause()

        # Change speed during pause; the stored virtual elapsed must not move.
        midi.set_speed(0.25)

        # Resume 100 wall-seconds later; virtual continues from 3 s.
        clock["t"] = 103.0
        midi.resume()

        # One more wall-second at 0.25x → +250 ms virtual → 3250 ms total.
        clock["t"] = 104.0
        midi._on_message(SimpleNamespace(type="note_on", note=60, velocity=80))
        assert _drain_event(loop, midi).timestamp_ms == pytest.approx(3250.0)

    def test_pause_resume_identity_at_speed_one(self, loop_with_fake_clock) -> None:
        """At the default speed this is the pre-feature behaviour."""
        loop, clock = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()

        clock["t"] = 4.0
        midi.pause()
        clock["t"] = 9.0
        midi.resume()

        assert (loop.time() - midi._start_time) == pytest.approx(4.0)


class TestMidiInputVirtualElapsedMs:
    """``virtual_elapsed_ms`` is the authoritative clock the status
    broadcaster ships to every frontend so it can realign its renderer
    without drifting. These tests pin the four invariants that make
    the alignment safe: starts at zero, advances at the speed-scaled
    wall rate, freezes across pause/resume, and is byte-identical to
    the timestamp stamped on a concurrent ``note_on``.
    """

    def test_reports_zero_right_after_mark_time_zero(self, loop_with_fake_clock) -> None:
        loop, _ = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()
        assert midi.virtual_elapsed_ms == pytest.approx(0.0)

    def test_advances_with_speed_scaling(self, loop_with_fake_clock) -> None:
        loop, clock = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()
        midi.set_speed(0.25)

        clock["t"] = 4.0
        assert midi.virtual_elapsed_ms == pytest.approx(1000.0), (
            "4 wall-seconds at 0.25x must read as 1000 virtual-ms. "
            "Drift between this property and the note-on timestamp "
            "would show up as systematically off deltas."
        )

    def test_matches_note_on_timestamp(self, loop_with_fake_clock) -> None:
        loop, clock = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()
        midi.set_speed(0.5)

        clock["t"] = 3.0
        expected = midi.virtual_elapsed_ms
        midi._on_message(SimpleNamespace(type="note_on", note=60, velocity=80))
        event = _drain_event(loop, midi)

        assert event.timestamp_ms == pytest.approx(expected), (
            "The status broadcaster and the validator must see the same "
            "clock: divergence here would be the same class of bug the "
            "status-sync machinery exists to prevent."
        )

    def test_freezes_under_pause(self, loop_with_fake_clock) -> None:
        loop, clock = loop_with_fake_clock
        midi = MidiInput(loop)
        midi.mark_time_zero()

        clock["t"] = 2.0
        midi.pause()
        frozen = midi.virtual_elapsed_ms

        clock["t"] = 100.0
        assert midi.virtual_elapsed_ms == pytest.approx(frozen), (
            "A paused session must not keep reporting wall-advancing "
            "elapsed — late-joining clients would realign to a point in "
            "the future."
        )


class TestMidiInputSpeedValidation:
    def test_zero_is_rejected(self, loop_with_fake_clock) -> None:
        loop, _ = loop_with_fake_clock
        with pytest.raises(ValueError):
            MidiInput(loop).set_speed(0.0)

    def test_negative_is_rejected(self, loop_with_fake_clock) -> None:
        loop, _ = loop_with_fake_clock
        with pytest.raises(ValueError):
            MidiInput(loop).set_speed(-1.0)

    def test_nan_is_rejected(self, loop_with_fake_clock) -> None:
        loop, _ = loop_with_fake_clock
        with pytest.raises(ValueError):
            MidiInput(loop).set_speed(math.nan)
