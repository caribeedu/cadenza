import type { MidiPortsMessage, StatusMessage } from "@shared/types/messages";
import type { NotePlayed, ScoreTimeline } from "@shared/types/score";

export interface FingeringProgressState {
  done: number;
  hand: "left" | "right";
  total: number;
}

export interface PlaybackState {
  fingeringProgress: null | FingeringProgressState;
  latestNotePlayed: NotePlayed | null;
  midiOpen: boolean;
  midiPort: null | string;
  midiPorts: string[];
  score: null | ScoreTimeline;
  scoreLoaded: boolean;
  serverElapsedMs: null | number;
  serverPaused: boolean;
  serverPlaybackSpeed: number;
  serverPlaying: boolean;
  sessionRestartGeneration: number;
}

export type PlaybackAction =
  | { type: "connection_lost" }
  | { payload: FingeringProgressState; type: "fingering_progress" }
  | { payload: MidiPortsMessage; type: "midi_ports" }
  | { payload: NotePlayed; type: "note_played" }
  | { payload: ScoreTimeline; type: "score_timeline" }
  | { payload: StatusMessage; type: "status" }
  | { type: "session_restart" };

export const initialPlaybackState: PlaybackState = {
  fingeringProgress: null,
  latestNotePlayed: null,
  midiOpen: false,
  midiPort: null,
  midiPorts: [],
  score: null,
  scoreLoaded: false,
  serverElapsedMs: null,
  serverPaused: false,
  serverPlaybackSpeed: 1.0,
  serverPlaying: false,
  sessionRestartGeneration: 0,
};

export function playbackReducer(
  state: PlaybackState,
  action: PlaybackAction,
): PlaybackState {
  switch (action.type) {
    case "connection_lost":
      return {
        ...state,
        fingeringProgress: null,
        latestNotePlayed: null,
        midiOpen: false,
        midiPort: null,
        midiPorts: [],
        score: null,
        scoreLoaded: false,
        serverElapsedMs: null,
        serverPaused: false,
        serverPlaybackSpeed: 1.0,
        serverPlaying: false,
      };
    case "fingering_progress":
      return { ...state, fingeringProgress: action.payload };
    case "midi_ports":
      return { ...state, midiPorts: action.payload.ports ?? [] };
    case "note_played":
      return { ...state, latestNotePlayed: action.payload };
    case "score_timeline":
      return {
        ...state,
        fingeringProgress: null,
        score: action.payload,
      };
    case "session_restart":
      return {
        ...state,
        sessionRestartGeneration: state.sessionRestartGeneration + 1,
      };
    case "status": {
      const { payload } = action;
      const serverReportsScore = !!payload.score_loaded;
      return {
        ...state,
        midiOpen: !!payload.midi_open,
        midiPort: payload.midi_open ? payload.midi_port : null,
        score: serverReportsScore ? state.score : null,
        fingeringProgress: serverReportsScore ? state.fingeringProgress : null,
        scoreLoaded: serverReportsScore,
        serverElapsedMs:
          typeof payload.elapsed_ms === "number" &&
          (payload.playing || payload.paused)
            ? payload.elapsed_ms
            : null,
        serverPaused: !!payload.paused,
        serverPlaybackSpeed:
          typeof payload.playback_speed === "number"
            ? payload.playback_speed
            : state.serverPlaybackSpeed,
        serverPlaying: !!payload.playing,
      };
    }
    default:
      return state;
  }
}
