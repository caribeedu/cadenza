import { usePlayback } from "@app/providers/PlaybackProvider";
import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/** Global shortcuts for hands-free control while playing. */
export function usePlaybackTransportHotkeys(): void {
  const { score, serverPaused, serverPlaying, start, togglePause } =
    usePlayback();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      const hasPlayableScore = (score?.notes?.length ?? 0) > 0;

      const isRKey =
        event.key === "r" ||
        event.key === "R" ||
        event.code === "KeyR";

      if (isRKey) {
        if (!hasPlayableScore) return;
        event.preventDefault();
        start();
        return;
      }

      if (event.key === "Enter") {
        const sessionActive = serverPlaying || serverPaused;
        if (!hasPlayableScore || !sessionActive) return;
        event.preventDefault();
        togglePause();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [score, serverPaused, serverPlaying, start, togglePause]);
}
