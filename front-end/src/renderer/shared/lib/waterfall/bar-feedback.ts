import * as THREE from "three";

import { pendingNoteColorHex } from "../note-hand-colors";
import { setNoteBarFaceColor } from "./bar-material";
import { firePendingColorForPitch } from "./fire-pending-color";
import {
  setLavaBarStatus,
  type LavaBarStatus,
} from "./lava-bar-material";
import { FEEDBACK, type WaterfallTheme } from "./visual-theme";

function pendingColour(
  theme: WaterfallTheme,
  staff: number,
  pitch: number,
): THREE.Color {
  if (theme === "fire") {
    return firePendingColorForPitch(pitch);
  }
  return new THREE.Color(pendingNoteColorHex(staff, pitch));
}

function feedbackColor(kind: "bad" | "good" | "neutral"): THREE.Color {
  if (kind === "good") return FEEDBACK.good;
  if (kind === "bad") return FEEDBACK.bad;
  return FEEDBACK.neutral;
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
  kind: "bad" | "good",
): void {
  if (isLava) {
    setLavaBarStatus(bar.material as THREE.ShaderMaterial, kind as LavaBarStatus);
    return;
  }
  setNoteBarFaceColor(
    bar.material as THREE.MeshStandardMaterial,
    feedbackColor(kind),
    kind,
  );
}

export { feedbackColor, pendingColour };
