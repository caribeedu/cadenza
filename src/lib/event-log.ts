export type EventLogEntry = {
  id: number;
  at: number;
  kind: "error" | "info" | "midi" | "playback" | "score" | "validation";
  text: string;
};

const MAX_ENTRIES = 80;

export function appendEventLog(
  entries: EventLogEntry[],
  kind: EventLogEntry["kind"],
  text: string,
): EventLogEntry[] {
  const next: EventLogEntry = {
    id: (entries[0]?.id ?? 0) + 1,
    at: Date.now(),
    kind,
    text,
  };
  return [next, ...entries].slice(0, MAX_ENTRIES);
}

export function formatEventTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
