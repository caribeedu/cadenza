import type { ReactElement } from "react";

import { useEventLog } from "@app/providers/EventLogProvider";

import "./LogPanel.css";

const KIND_CLASS: Record<string, string> = {
  dim: "dim",
  err: "err",
  ok: "ok",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString();
}

export function LogPanel(): ReactElement {
  const { entries } = useEventLog();
  return (
    <aside aria-label="Event log" className="log-panel">
      {entries.map(({ id, kind, message, timestamp }) => (
        <div className={KIND_CLASS[kind] ?? ""} key={id}>
          {`${formatTime(timestamp)}  ${message}`}
        </div>
      ))}
    </aside>
  );
}
