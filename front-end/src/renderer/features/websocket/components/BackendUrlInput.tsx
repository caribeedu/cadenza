import { useWebSocket } from "@app/providers/WebSocketProvider";
import { type ReactElement, useCallback, useEffect, useState } from "react";

// Small form input bound to the WebSocket provider. Kept as a
// controlled component so the value can be edited without committing
// to a reconnect until the user blurs/submits. Committing via the
// ``change`` event matches the platform conventions for text inputs.
export function BackendUrlInput(): ReactElement {
  const { backendUrl, reconnect } = useWebSocket();
  const [draft, setDraft] = useState(backendUrl);

  useEffect(() => setDraft(backendUrl), [backendUrl]);

  const commit = useCallback(() => {
    const next = draft.trim();
    if (!next || next === backendUrl) return;
    reconnect(next);
  }, [draft, backendUrl, reconnect]);

  return (
    <label className="field">
      <span>Backend</span>
      <input
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        type="text"
        value={draft}
      />
    </label>
  );
}
