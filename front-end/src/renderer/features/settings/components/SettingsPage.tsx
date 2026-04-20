import type { ReactElement } from "react";

// Placeholder for the future settings page. The file exists so the
// router can point at it (and so the folder structure documents the
// intent without being empty), but the current release still lives
// entirely on one page with inline controls.
export function SettingsPage(): ReactElement {
  return (
    <main className="settings-page">
      <h1>Settings</h1>
      <p>
        Detailed configuration for MIDI, WebSocket, score tolerance,
        velocity, colours, and visualisation modes will land here.
      </p>
    </main>
  );
}
