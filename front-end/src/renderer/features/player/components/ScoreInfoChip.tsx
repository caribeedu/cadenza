import { usePlayback } from "@app/providers/PlaybackProvider";
import type { ReactElement } from "react";

// Inline "now playing" chip: shows the current score's title (from
// the plugin's ``meta.title``) and the total scored-note count. Kept
// intentionally read-only; user controls for the score live elsewhere
// (the plugin owns ingest, the hub owns playback state).
export function ScoreInfoChip(): ReactElement {
  const { score } = usePlayback();

  if (!score) {
    return (
      <span className="chip chip-off" title="No score has been ingested yet">
        Score: —
      </span>
    );
  }

  const rawTitle = score.title?.trim();
  const title = rawTitle && rawTitle.length > 0 ? rawTitle : "Untitled";
  const noteCount = score.notes.length;
  const suffix = noteCount === 1 ? "note" : "notes";

  return (
    <span
      className="chip chip-on"
      title={`${title} — ${noteCount} ${suffix}`}
    >
      <strong style={{ fontWeight: 600 }}>{title}</strong>
      <span style={{ opacity: 0.75, marginLeft: 8 }}>
        {noteCount} {suffix}
      </span>
    </span>
  );
}
