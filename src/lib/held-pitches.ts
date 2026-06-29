export function addHeldPitch(pitches: readonly number[], pitch: number): number[] {
  if (pitches.includes(pitch)) return [...pitches];
  return [...pitches, pitch].sort((a, b) => a - b);
}

export function removeHeldPitch(pitches: readonly number[], pitch: number): number[] {
  if (!pitches.includes(pitch)) return [...pitches];
  return pitches.filter((p) => p !== pitch);
}
