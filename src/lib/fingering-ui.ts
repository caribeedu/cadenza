export type FingeringProgress = {
  done: number;
  total: number;
  hand: string;
};

export function formatFingeringProgressLabel(p: FingeringProgress): string {
  const z = Math.max(1, Math.round(p.total));
  const y = Math.min(z, Math.max(0, Math.round(p.done)));
  const pct = Math.min(100, Math.round((y / z) * 100));
  const side = p.hand === "left" ? "left" : "right";
  return `Assigning ${side} hand fingers ${pct}% (${y} of ${z})`;
}
