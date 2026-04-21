import type { FingeringProgressMessage } from "../types/messages";

/** Session chip label while the backend assigns automatic fingerings. */
export function formatFingeringProgressLabel(
  p: Pick<FingeringProgressMessage, "done" | "hand" | "total">,
): string {
  const z = Math.max(1, Math.round(p.total));
  const y = Math.min(z, Math.max(0, Math.round(p.done)));
  const pct = Math.min(100, Math.round((y / z) * 100));
  const side = p.hand === "left" ? "left" : "right";
  return `Assigning ${side} hand fingers ${pct}% (${y} of ${z})`;
}
