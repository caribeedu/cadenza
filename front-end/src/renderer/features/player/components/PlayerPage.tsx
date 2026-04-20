import type { ReactElement } from "react";

import { LogPanel } from "@shared/components/LogPanel";

import { TopBar } from "./TopBar";
import { Waterfall } from "./Waterfall";
import "./PlayerPage.css";

// Main page: top bar with controls, the waterfall/piano surface, and
// the diagnostic log side-panel. Future visualisation modes (staff,
// piano-roll) slot into the center column via ``visualizationMode``
// without touching the surrounding chrome.
export function PlayerPage(): ReactElement {
  return (
    <>
      <TopBar />
      <main className="player-layout">
        <Waterfall />
        <LogPanel />
      </main>
    </>
  );
}
