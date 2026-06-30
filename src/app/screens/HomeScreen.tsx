import { createMemo, createSignal, Show } from "solid-js";
import { useAppStore } from "../AppProvider";
import { IsometricStage } from "../../components/decor/IsometricStage";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ScreenLayout } from "../../components/ui/ScreenLayout";
import { Select } from "../../components/ui/Select";
import { ThemeGrid } from "../../components/ui/ThemeCard";
import {
  WATERFALL_THEME_IDS,
  type WaterfallThemeId,
} from "../../lib/waterfall/theme";
import "./HomeScreen.css";

const THEME_IDS: WaterfallThemeId[] = [
  WATERFALL_THEME_IDS.LavaStage,
  WATERFALL_THEME_IDS.AuroraIce,
];

type Props = {
  onContinue: () => void;
};

export function HomeScreen(props: Props) {
  const store = useAppStore();
  const [installError, setInstallError] = createSignal<string | null>(null);

  const midiOptions = createMemo(() => [
    { value: "", label: "Select device…" },
    ...store.midiPorts().map((port) => ({ value: port, label: port })),
  ]);

  async function handleInstall() {
    setInstallError(null);
    try {
      await store.installPlugin();
    } catch (e) {
      setInstallError(String(e));
    }
  }

  return (
    <ScreenLayout footer="Cadenza v0.1.0 · Runs entirely on your machine">
      <div class="home-hero">
        <IsometricStage variant="home" />
        <h1 class="home-title">Cadenza</h1>
        <p class="home-tagline">Practice piano with live score validation</p>
      </div>

      <Card class="home-section" glow>
        <h3>Visual theme</h3>
        <p class="home-hint">Choose the look of your waterfall stage</p>
        <ThemeGrid
          ids={THEME_IDS}
          selected={store.waterfallThemeId()}
          onSelect={(id) => store.setTheme(id)}
        />
      </Card>

      <Card class="home-section">
        <h3>MIDI keyboard</h3>
        <p class="home-hint">Connect your instrument for live note validation</p>
        <div class="home-midi-row">
          <Select
            label="Device"
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
        <Show when={store.selectedMidi()}>
          <span class="chip chip--success">Connected</span>
        </Show>
      </Card>

      <Card class="home-section">
        <h3>MuseScore plugin</h3>
        <Show
          when={store.pluginStatus()?.upToDate}
          fallback={
            <>
              <p class="home-hint">
                Installs <code>Cadenza.qml</code> to your MuseScore 4 plugins folder. Restart MuseScore,
                then run <strong>Plugins → Cadenza Sender</strong>.
              </p>
              <Button variant="ghost" onClick={() => void handleInstall()}>
                {store.pluginStatus()?.installed ? "Update plugin" : "Install plugin"}
              </Button>
            </>
          }
        >
          <span class="chip chip--success">Plugin installed</span>
          <p class="home-hint home-hint--chip-follow">
            Restart MuseScore if needed, then run <strong>Plugins → Cadenza Sender</strong>.
          </p>
        </Show>
        <Show when={store.pluginMessage()}>
          <p class="home-status home-status--ok">{store.pluginMessage()}</p>
        </Show>
        <Show when={installError()}>
          <p class="home-status home-status--err">{installError()}</p>
        </Show>
      </Card>

      <Button variant="primary" size="lg" class="home-continue" onClick={() => props.onContinue()}>
        Continue
      </Button>
    </ScreenLayout>
  );
}
