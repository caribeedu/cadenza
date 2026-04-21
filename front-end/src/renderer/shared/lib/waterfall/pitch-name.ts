/** Map pitch-class letter (A…G / accidentals) to MIDI pitch-class 0–11 (C=0). */
export const NAME_TO_PITCH_CLASS: Record<string, number> = {
  A: 9,
  "A♯": 10,
  B: 11,
  C: 0,
  "C♯": 1,
  D: 2,
  "D♯": 3,
  E: 4,
  F: 5,
  "F♯": 6,
  G: 7,
  "G♯": 8,
};

export function midiFromName(text: string): number {
  return NAME_TO_PITCH_CLASS[text] ?? 0;
}
