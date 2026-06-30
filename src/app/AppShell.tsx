import { createEffect, createSignal, Show } from "solid-js";
import { useAppStore } from "./AppProvider";
import { continueTarget, type AppScreen } from "./navigation";
import { HomeScreen } from "./screens/HomeScreen";
import { LoadScreen } from "./screens/LoadScreen";
import { PlayerScreen } from "./screens/PlayerScreen";
import { SettingsOverlay } from "./screens/SettingsOverlay";
import "./AppShell.css";

export function AppShell() {
  const store = useAppStore();
  const [screen, setScreen] = createSignal<AppScreen>("home");
  const [settingsOpen, setSettingsOpen] = createSignal(false);

  createEffect(() => {
    if (store.scoreJustLoaded()) {
      setScreen("player");
    }
  });

  function handleContinue() {
    setScreen(continueTarget(store.hasScore()));
  }

  async function handleBackToMenu() {
    setSettingsOpen(false);
    await store.stop();
    setScreen("home");
  }

  return (
    <div class="app-shell">
      <Show when={screen() === "home"}>
        <HomeScreen onContinue={handleContinue} />
      </Show>

      <Show when={screen() === "load"}>
        <LoadScreen onBack={() => setScreen("home")} onGoHome={() => setScreen("home")} />
      </Show>

      <Show when={screen() === "player"}>
        <PlayerScreen onOpenSettings={() => setSettingsOpen(true)} />
      </Show>

      <Show when={settingsOpen() && screen() === "player"}>
        <SettingsOverlay
          onClose={() => setSettingsOpen(false)}
          onBackToMenu={() => void handleBackToMenu()}
        />
      </Show>
    </div>
  );
}
