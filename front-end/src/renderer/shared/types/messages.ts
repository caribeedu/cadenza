// Wire-format types shared between the Electron renderer and the
// Python backend. Literal constants live in ``shared/lib/protocol.ts``
// so they remain a single source of truth; the types below discriminate
// on ``type`` so the dispatcher can exhaustively branch without casts.

import type {
  MSG_ERROR,
  MSG_HELLO,
  MSG_LIST_MIDI,
  MSG_MIDI_PORTS,
  MSG_NOTE_PLAYED,
  MSG_NOTE_TRIGGER,
  MSG_PAUSE,
  MSG_RESUME,
  MSG_SCORE,
  MSG_SCORE_TIMELINE,
  MSG_SELECT_MIDI,
  MSG_SET_PLAYBACK_SPEED,
  MSG_SET_TOLERANCE,
  MSG_START,
  MSG_STATUS,
  MSG_STOP,
} from "../lib/protocol";
import type { NotePlayed, ScoreTimeline } from "./score";

export interface HelloMessage {
  role: "frontend" | "plugin";
  type: typeof MSG_HELLO;
}

export interface ListMidiMessage {
  type: typeof MSG_LIST_MIDI;
}

export interface SelectMidiMessage {
  port: string;
  type: typeof MSG_SELECT_MIDI;
}

export interface StartMessage {
  type: typeof MSG_START;
}

export interface PauseMessage {
  type: typeof MSG_PAUSE;
}

export interface ResumeMessage {
  type: typeof MSG_RESUME;
}

export interface StopMessage {
  type: typeof MSG_STOP;
}

export interface SetToleranceMessage {
  tolerance_ms: number;
  type: typeof MSG_SET_TOLERANCE;
}

export interface SetPlaybackSpeedMessage {
  playback_speed: number;
  type: typeof MSG_SET_PLAYBACK_SPEED;
}

export interface ScoreMessage {
  [key: string]: unknown;
  type: typeof MSG_SCORE;
}

export type ClientMessage =
  | HelloMessage
  | ListMidiMessage
  | PauseMessage
  | ResumeMessage
  | ScoreMessage
  | SelectMidiMessage
  | SetPlaybackSpeedMessage
  | SetToleranceMessage
  | StartMessage
  | StopMessage;

export interface StatusMessage {
  midi_open: boolean;
  midi_port: null | string;
  paused: boolean;
  playback_speed?: number;
  playing: boolean;
  score_loaded: boolean;
  tolerance_ms?: number;
  type: typeof MSG_STATUS;
}

export interface MidiPortsMessage {
  ports: string[];
  type: typeof MSG_MIDI_PORTS;
}

export interface ScoreTimelineMessage extends ScoreTimeline {
  type: typeof MSG_SCORE_TIMELINE;
}

export interface NoteTriggerMessage extends NotePlayed {
  type: typeof MSG_NOTE_TRIGGER;
}

export interface NotePlayedMessage extends NotePlayed {
  type: typeof MSG_NOTE_PLAYED;
}

export interface ErrorMessage {
  error: string;
  type: typeof MSG_ERROR;
}

export type ServerMessage =
  | ErrorMessage
  | MidiPortsMessage
  | NotePlayedMessage
  | NoteTriggerMessage
  | ScoreTimelineMessage
  | StatusMessage;

export type AnyMessage = ClientMessage | ServerMessage;
