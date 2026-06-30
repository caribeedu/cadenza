import { createMemo, createSignal, Show } from "solid-js";
import { useAppStore } from "../AppProvider";
import { EventLog } from "../../components/EventLog";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Slider } from "../../components/ui/Slider";
import { ThemeGrid } from "../../components/ui/ThemeCard";
import {
  WATERFALL_THEME_IDS,
  type WaterfallThemeId,
} from "../../lib/waterfall/theme";
import "./SettingsOverlay.css";

const THEME_IDS: WaterfallThemeId[] = [
  WATERFALL_THEME_IDS.LavaStage,
  WATERFALL_THEME_IDS.AuroraIce,
];

type Props = {
  onClose: () => void;
  onBackToMenu: () => void;
};

export function SettingsOverlay(props: Props) {
  const store = useAppStore();
  const [advancedOpen, setAdvancedOpen] = createSignal(false);

  const midiOptions = createMemo(() => [
    { value: "", label: "Select device…" },
    ...store.midiPorts().map((port) => ({ value: port, label: port })),
  ]);

  return (
    <>
      <div class="overlay-backdrop" onClick={() => props.onClose()} role="presentation" />
      <aside class="overlay-panel settings-panel" role="dialog" aria-label="Settings">
        <header class="overlay-panel__header">
          <h2>Settings</h2>
          <Button variant="ghost" size="icon" onClick={() => props.onClose()} aria-label="Close">
            ✕
          </Button>
        </header>

        <div class="overlay-panel__body">
          <section class="overlay-panel__section">
            <h3>Playback</h3>
            <Slider
              label="Speed"
              value={store.status()?.speed ?? 1}
              displayValue={`${(store.status()?.speed ?? 1).toFixed(2)}×`}
              min={0.25}
              max={2}
              step={0.05}
              onChange={(v) => void store.setSpeed(v)}
            />
            <Slider
              label="Tolerance"
              value={store.status()?.toleranceMs ?? 130}
              displayValue={`${Math.round(store.status()?.toleranceMs ?? 130)} ms`}
              min={50}
              max={300}
              step={5}
              onChange={(v) => void store.setTolerance(v)}
            />
          </section>

          <section class="overlay-panel__section">
            <h3>Theme</h3>
            <ThemeGrid
              ids={THEME_IDS}
              selected={store.waterfallThemeId()}
              compact
              onSelect={(id) => store.setTheme(id)}
            />
          </section>

          <section class="overlay-panel__section">
            <h3>MIDI device</h3>
            <div class="settings-midi-row">
              <Select
                value={store.selectedMidi()}
                options={midiOptions()}
                onChange={(port) => {
                  void store.selectMidi(port).catch((err) => store.log("error", String(err)));
                }}
              />
              <Button variant="ghost" size="sm" onClick={() => void store.refreshMidiPorts()}>
                Refresh
              </Button>
            </div>
          </section>

          <section class="overlay-panel__section settings-advanced">
            <button
              type="button"
              class="collapsible__trigger"
              onClick={() => setAdvancedOpen((o) => !o)}
              aria-expanded={advancedOpen()}
            >
              Advanced
              <span>{advancedOpen() ? "▾" : "▸"}</span>
            </button>
            <Show when={advancedOpen()}>
              <div class="collapsible__body">
                <EventLog entries={store.eventLog()} embedded />
              </div>
            </Show>
          </section>

          <Button variant="ghost" class="settings-back-menu" onClick={() => props.onBackToMenu()}>
            ← Back to menu
          </Button>
        </div>
      </aside>
    </>
  );
}
