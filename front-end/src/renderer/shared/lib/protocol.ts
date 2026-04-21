// JSON message helpers that mirror `back-end/cadenza_server/core/protocol.py`.

export const MSG_HELLO = "hello";
export const MSG_SCORE = "score";
export const MSG_LIST_MIDI = "list_midi";
export const MSG_SELECT_MIDI = "select_midi";
export const MSG_START = "start";
export const MSG_PAUSE = "pause";
export const MSG_RESUME = "resume";
export const MSG_STOP = "stop";
export const MSG_SET_TOLERANCE = "set_tolerance";
export const MSG_SET_PLAYBACK_SPEED = "set_playback_speed";

export const MSG_STATUS = "status";
export const MSG_MIDI_PORTS = "midi_ports";
export const MSG_SCORE_TIMELINE = "score_timeline";
export const MSG_NOTE_TRIGGER = "note_trigger";
export const MSG_NOTE_PLAYED = "note_played";
export const MSG_FINGERING_PROGRESS = "fingering_progress";
export const MSG_ERROR = "error";

// Accept any serialisable shape on the way out — the strongly-typed
// union lives in ``shared/types/messages`` and is re-exported for
// consumers that want discriminated access.
export function encode(message: unknown): string {
  return JSON.stringify(message);
}

export interface DecodedMessage {
  [key: string]: unknown;
  type?: string;
}

export function decode(raw: string): DecodedMessage {
  const data: unknown = JSON.parse(raw);
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Expected a JSON object at the top level");
  }
  return data as DecodedMessage;
}
