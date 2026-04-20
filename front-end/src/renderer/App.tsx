import type { ReactElement } from "react";

import { AppProviders } from "@app/providers/AppProviders";
import { PlayerPage } from "@features/player/components/PlayerPage";

// Top-level composition. Routing is intentionally absent today — the
// player is the only page — but adding react-router here is the
// zero-friction extension path when the settings page lands.
export function App(): ReactElement {
  return (
    <AppProviders>
      <PlayerPage />
    </AppProviders>
  );
}
