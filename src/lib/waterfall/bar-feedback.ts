import * as THREE from "three";
import { pendingNoteColorHex } from "../note-hand-colors";
import { pendingColorForTheme } from "./fire-pending-color";
import { setLavaBarStatus } from "./lava-bar-material";
import { setNoteBarFaceColor } from "./bar-material";
import { feedbackColor, type WaterfallTheme } from "./theme";

function pendingColour(theme: WaterfallTheme, staff: number, pitch: number): THREE.Color {
  if (theme.pendingColorMode === "gradient") {
    return pendingColorForTheme(theme, pitch);
  }
  return new THREE.Color(pendingNoteColorHex(staff, pitch));
}

export function applyBarPending(
  bar: THREE.Mesh,
  isLava: boolean,
  theme: WaterfallTheme,
  staff: number,
  pitch: number,
) {
  if (isLava) {
    setLavaBarStatus(bar.material as THREE.ShaderMaterial, "pending");
    return;
  }
  setNoteBarFaceColor(bar.material as THREE.MeshStandardMaterial, pendingColour(theme, staff, pitch), "pending");
}

export function applyBarFeedback(
  bar: THREE.Mesh,
  isLava: boolean,
  theme: WaterfallTheme,
  kind: "bad" | "good",
) {
  if (isLava) {
    setLavaBarStatus(bar.material as THREE.ShaderMaterial, kind);
    return;
  }
  setNoteBarFaceColor(
    bar.material as THREE.MeshStandardMaterial,
    new THREE.Color(feedbackColor(theme, kind)),
    kind,
  );
}
