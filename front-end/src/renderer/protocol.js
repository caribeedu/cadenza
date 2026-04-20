// JSON message helpers that mirror `back-end/server/src/cadenza_server/protocol.py`.
// Lives separately from the WebSocket client so it can be unit-tested.

export const MSG_HELLO = "hello";
export const MSG_SCORE = "score";
export const MSG_LIST_MIDI = "list_midi";
export const MSG_SELECT_MIDI = "select_midi";
export const MSG_START = "start";
export const MSG_PAUSE = "pause";
export const MSG_RESUME = "resume";
export const MSG_STOP = "stop";
export const MSG_SET_TOLERANCE = "set_tolerance";

export const MSG_STATUS = "status";
export const MSG_MIDI_PORTS = "midi_ports";
export const MSG_SCORE_TIMELINE = "score_timeline";
export const MSG_NOTE_TRIGGER = "note_trigger";
export const MSG_NOTE_PLAYED = "note_played";
export const MSG_ERROR = "error";

export function encode(message) {
  return JSON.stringify(message);
}

export function decode(raw) {
  const data = JSON.parse(raw);
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Expected a JSON object at the top level");
  }
  return data;
}
