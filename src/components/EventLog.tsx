import { For, Show } from "solid-js";
import { formatEventTime, type EventLogEntry } from "../lib/event-log";
import "./EventLog.css";

type Props = {
  entries: EventLogEntry[];
};

export function EventLog(props: Props) {
  return (
    <section class="panel event-log-panel">
      <h2>Event log</h2>
      <Show
        when={props.entries.length > 0}
        fallback={<p class="event-log-empty">Events appear here as you play.</p>}
      >
        <ul class="event-log-list">
          <For each={props.entries}>
            {(entry) => (
              <li class={`event-log-item event-log-${entry.kind}`}>
                <time datetime={String(entry.at)}>{formatEventTime(entry.at)}</time>
                <span>{entry.text}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
}
