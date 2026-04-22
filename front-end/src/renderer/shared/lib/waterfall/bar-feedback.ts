import * as THREE from "three";

import { pendingNoteColorHex } from "../note-hand-colors";
import { setNoteBarFaceColor } from "./bar-material";
import { pendingColorForTheme } from "./fire-pending-color";
import {
  setLavaBarStatus,
  type LavaBarStatus,
} from "./lava-bar-material";
import {
  feedbackForTheme,
  type WaterfallTheme,
  visualThemeConfig,
} from "./visual-theme";

function pendingColour(
  theme: WaterfallTheme,
  staff: number,
  pitch: number,
): THREE.Color {
  if (visualThemeConfig(theme).pendingColorMode === "gradient") {
    return pendingColorForTheme(theme, pitch);
  }
  return new THREE.Color(pendingNoteColorHex(staff, pitch));
}

function feedbackColor(
  theme: WaterfallTheme,
  kind: "bad" | "good" | "neutral",
): THREE.Color {
  return feedbackForTheme(theme, kind);
}

export function applyBarPending(
  bar: THREE.Mesh,
  isLava: boolean,
  theme: WaterfallTheme,
  staff: number,
  pitch: number,
): void {
  if (isLava) {
    setLavaBarStatus(bar.material as THREE.ShaderMaterial, "pending");
    return;
  }
  setNoteBarFaceColor(
    bar.material as THREE.MeshStandardMaterial,
    pendingColour(theme, staff, pitch),
    "pending",
  );
}

export function applyBarFeedback(
  bar: THREE.Mesh,
  isLava: boolean,
  theme: WaterfallTheme,
  kind: "bad" | "good",
): void {
  if (isLava) {
    setLavaBarStatus(bar.material as THREE.ShaderMaterial, kind as LavaBarStatus);
    return;
  }
  setNoteBarFaceColor(
    bar.material as THREE.MeshStandardMaterial,
    feedbackColor(theme, kind),
    kind,
  );
}

export { feedbackColor, pendingColour };
