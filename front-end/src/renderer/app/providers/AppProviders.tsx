import type { ReactElement, ReactNode } from "react";

import { EventLogProvider } from "./EventLogProvider";
import { PlaybackProvider } from "./PlaybackProvider";
import { ScoreConfigProvider } from "./ScoreConfigProvider";
import { WebSocketProvider } from "./WebSocketProvider";

// Composition root for all cross-cutting context. The nesting order is
// deliberate:
//   EventLog → ScoreConfig → WebSocket → Playback
// so Playback (which reads all three) can assume the others are
// already mounted. WebSocket owns the network; Playback layers the
// state machine on top.
export function AppProviders({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <EventLogProvider>
      <ScoreConfigProvider>
        <WebSocketProvider>
          <PlaybackProvider>{children}</PlaybackProvider>
        </WebSocketProvider>
      </ScoreConfigProvider>
    </EventLogProvider>
  );
}
