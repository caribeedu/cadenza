export interface ScoreNote {
  duration_ms: number;
  id: number;
  pitch: number;
  start_ms: number;
  track?: number;
}

export interface ScoreTimeline {
  bpm: number;
  duration_ms: number;
  notes: ScoreNote[];
}

// Payload for MSG_NOTE_PLAYED / MSG_NOTE_TRIGGER. ``correct`` is
// ``null`` when the press could not be validated (e.g. no score loaded,
// session paused) so the UI can render a neutral flash with a reason
// hint rather than a red "miss" indicator.
export interface NotePlayed {
  correct: boolean | null;
  delta_ms: null | number;
  expected_id: null | number;
  expected_pitch: null | number;
  expected_time_ms: null | number;
  played_pitch: number;
  played_time_ms: number;
  reason?: string;
}
