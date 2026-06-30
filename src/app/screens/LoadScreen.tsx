import { Show } from "solid-js";
import { useAppStore } from "../AppProvider";
import { IsometricStage } from "../../components/decor/IsometricStage";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ScreenLayout } from "../../components/ui/ScreenLayout";
import "./LoadScreen.css";

const STEPS = [
  "Open your score in MuseScore 4",
  "Run Plugins → Cadenza Sender",
  "Keep this app open while the score sends",
];

type Props = {
  onBack: () => void;
  onGoHome: () => void;
};

export function LoadScreen(props: Props) {
  const store = useAppStore();

  return (
    <ScreenLayout>
      <div class="load-header">
        <Button variant="ghost" size="sm" onClick={() => props.onBack()}>
          ← Back
        </Button>
      </div>

      <IsometricStage variant="load" />

      <h1 class="load-title">Load your music</h1>
      <p class="load-subtitle">Send a score from MuseScore to start practicing</p>

      <Show when={store.scoreJustLoaded()}>
        <div class="toast toast--success load-flash">Score loaded — starting session…</div>
      </Show>

      <Card class="load-steps" glow>
        <ol class="load-steps__list">
          {STEPS.map((step, i) => (
            <li class="load-steps__item">
              <span class="load-steps__num">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      <div class="load-listening">
        <span class="chip chip--live">● Listening on 127.0.0.1:8765</span>
      </div>

      <p class="load-hint">
        Need the plugin?{" "}
        <button type="button" class="load-link" onClick={() => props.onGoHome()}>
          Install from Home
        </button>
      </p>
    </ScreenLayout>
  );
}
