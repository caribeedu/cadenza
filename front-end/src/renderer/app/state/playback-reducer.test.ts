import type { StatusMessage } from "@shared/types/messages";
import { MSG_STATUS } from "@shared/lib/protocol";
import { describe, expect, it } from "vitest";

import { initialPlaybackState, playbackReducer } from "./playback-reducer";

const SAMPLE_SCORE = {
  bpm: 120,
  duration_ms: 1000,
  notes: [{ duration_ms: 500, id: 0, pitch: 60, start_ms: 0 }],
};

function status(partial: Partial<StatusMessage>): StatusMessage {
  return {
    elapsed_ms: 0,
    midi_open: false,
    midi_port: null,
    paused: false,
    playback_speed: 1,
    playing: false,
    score_loaded: false,
    tolerance_ms: 100,
    type: MSG_STATUS,
    ...partial,
  };
}

describe("playbackReducer", () => {
  describe("regression: WebSocket disconnect vs Start/Restart", () => {
    it("does not increment sessionRestartGeneration on connection_lost (avoids startAt(0) clock drift)", () => {
      const afterStart = playbackReducer(initialPlaybackState, {
        type: "session_restart",
      });
      expect(afterStart.sessionRestartGeneration).toBe(1);

      const afterDisconnect = playbackReducer(afterStart, {
        type: "connection_lost",
      });
      expect(afterDisconnect.sessionRestartGeneration).toBe(1);
    });

    it("still increments sessionRestartGeneration only for session_restart", () => {
      let s = playbackReducer(initialPlaybackState, { type: "session_restart" });
      expect(s.sessionRestartGeneration).toBe(1);
      s = playbackReducer(s, { type: "session_restart" });
      expect(s.sessionRestartGeneration).toBe(2);
    });
  });

  describe("connection_lost", () => {
    it("clears score, MIDI snapshot, and server session fields while preserving generation", () => {
      const loaded = playbackReducer(initialPlaybackState, {
        payload: SAMPLE_SCORE,
        type: "score_timeline",
      });
      const withMidi = playbackReducer(loaded, {
        payload: { ports: ["Device A"], type: "midi_ports" },
        type: "midi_ports",
      });
      const withSession = playbackReducer(withMidi, {
        payload: status({
          elapsed_ms: 5000,
          midi_open: true,
          midi_port: "Device A",
          playing: true,
          score_loaded: true,
        }),
        type: "status",
      });
      const withGen = playbackReducer(withSession, { type: "session_restart" });

      const cleared = playbackReducer(withGen, { type: "connection_lost" });

      expect(cleared.score).toBeNull();
      expect(cleared.scoreLoaded).toBe(false);
      expect(cleared.midiPorts).toEqual([]);
      expect(cleared.midiOpen).toBe(false);
      expect(cleared.midiPort).toBeNull();
      expect(cleared.serverPlaying).toBe(false);
      expect(cleared.serverPaused).toBe(false);
      expect(cleared.serverElapsedMs).toBeNull();
      expect(cleared.serverPlaybackSpeed).toBe(1);
      expect(cleared.fingeringProgress).toBeNull();
      expect(cleared.latestNotePlayed).toBeNull();
      expect(cleared.heldMidiPitches).toEqual([]);
      expect(cleared.sessionRestartGeneration).toBe(1);
    });
  });

  describe("heldMidiPitches (note on/off)", () => {
    it("adds a pitch on note_played and removes it on note_off", () => {
      const n = {
        correct: true,
        delta_ms: 0,
        expected_id: 0,
        expected_pitch: 60,
        expected_time_ms: 0,
        played_pitch: 60,
        played_time_ms: 0,
      };
      const afterOn = playbackReducer(initialPlaybackState, {
        payload: n,
        type: "note_played",
      });
      expect(afterOn.heldMidiPitches).toEqual([60]);

      const afterOff = playbackReducer(afterOn, { payload: 60, type: "note_off" });
      expect(afterOff.heldMidiPitches).toEqual([]);
    });

    it("clears held pitches on session_restart", () => {
      const n = {
        correct: true,
        delta_ms: 0,
        expected_id: 0,
        expected_pitch: 60,
        expected_time_ms: 0,
        played_pitch: 60,
        played_time_ms: 0,
      };
      const withHeld = playbackReducer(initialPlaybackState, { payload: n, type: "note_played" });
      const restarted = playbackReducer(withHeld, { type: "session_restart" });
      expect(restarted.heldMidiPitches).toEqual([]);
    });
  });

  describe("score_timeline after reconnect", () => {
    it("can load a new timeline without bumping sessionRestartGeneration", () => {
      const disconnected = playbackReducer(
        playbackReducer(
          playbackReducer(initialPlaybackState, {
            payload: SAMPLE_SCORE,
            type: "score_timeline",
          }),
          { type: "session_restart" },
        ),
        { type: "connection_lost" },
      );

      const nextScore = {
        ...SAMPLE_SCORE,
        bpm: 99,
        notes: [
          { duration_ms: 400, id: 0, pitch: 48, start_ms: 0 },
        ],
      };
      const reloaded = playbackReducer(disconnected, {
        payload: nextScore,
        type: "score_timeline",
      });

      expect(reloaded.score?.bpm).toBe(99);
      expect(reloaded.score?.notes[0]?.pitch).toBe(48);
      expect(reloaded.sessionRestartGeneration).toBe(1);
    });
  });
});
