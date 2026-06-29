import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { LaneGeometry } from "../geometry";
import { pendingNoteColorHex } from "../note-hand-colors";
import { barHeightPx, isAccidental, noteMeshKey } from "../timeline";
import { createNoteBarMaterial } from "./bar-material";
import { pendingColorForTheme } from "./fire-pending-color";
import {
  createLavaBarMaterial,
  initLavaBarFeedbackUniforms,
} from "./lava-bar-material";
import {
  classifyNoteSpriteStack,
  fingerAndLabelSpriteYs,
  labelOnlySpriteY,
  resolveFingerDigit,
} from "./note-sprite-layout";
import type { NoteSpriteMaterialCache } from "./sprite-material-cache";
import type { WaterfallTheme } from "./theme";

export type NoteStatus = "bad" | "good" | "pending";

export interface NoteUserData {
  bar: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
  durationMs: number;
  id?: number;
  isLava: boolean;
  pitch: number;
  staff: number;
  startMs: number;
  status: NoteStatus;
}

export type ScoreNote = {
  id: number;
  pitch: number;
  start_ms: number;
  duration_ms: number;
  staff?: number;
  finger?: number | null;
};

function pendingFillColor(theme: WaterfallTheme, staff: number, pitch: number): THREE.Color {
  if (theme.pendingColorMode === "gradient") {
    return pendingColorForTheme(theme, pitch);
  }
  return new THREE.Color(pendingNoteColorHex(staff, pitch));
}

export function createNoteGroup(
  note: ScoreNote,
  laneGeometry: LaneGeometry,
  pxPerMs: number,
  spriteCache: NoteSpriteMaterialCache,
  theme: WaterfallTheme,
): { group: THREE.Group; key: string | null } {
  const bg = theme.noteBarGeometry;
  const sprites = theme.noteSprites;
  const laneWidth = laneGeometry.laneWidthPx(note.pitch);
  const width = Math.max(3, laneWidth * bg.laneWidthFactor);
  const height = barHeightPx(note.duration_ms, pxPerMs);
  const staff = note.staff ?? 0;
  const isBlack = isAccidental(note.pitch);
  const cornerRadius = Math.min(
    bg.cornerRadiusCap,
    width * bg.cornerRadiusWidthFactor,
    Math.max(bg.cornerRadiusHeightMin, height * bg.cornerRadiusHeightFactor),
  );

  const isLava = theme.lavaBars;
  const group = new THREE.Group();
  const geom = new RoundedBoxGeometry(width, height, bg.depth, 2, cornerRadius);
  const mat = isLava
    ? (() => {
        const m = createLavaBarMaterial(note.pitch, note.staff, theme);
        initLavaBarFeedbackUniforms(m, theme);
        return m;
      })()
    : createNoteBarMaterial(pendingFillColor(theme, staff, note.pitch));
  const bar = new THREE.Mesh(geom, mat);
  group.add(bar);
  group.renderOrder = isBlack ? 2 : 1;

  const fingerDigit = resolveFingerDigit(note.finger);
  const stack = classifyNoteSpriteStack(height, fingerDigit, sprites);

  if (stack === "finger_and_label" && fingerDigit != null) {
    const { yFinger, yName } = fingerAndLabelSpriteYs(height, sprites);
    const fSprite = makeFingerSprite(spriteCache, fingerDigit, sprites);
    fSprite.position.set(0, yFinger, 0);
    fSprite.renderOrder = 3;
    group.add(fSprite);

    const label = makeLabelSprite(spriteCache, note.pitch, sprites);
    label.position.set(0, yName, 0);
    label.renderOrder = 4;
    group.add(label);
  } else if (stack === "label_only") {
    const label = makeLabelSprite(spriteCache, note.pitch, sprites);
    label.position.set(0, labelOnlySpriteY(height, sprites), 0);
    label.renderOrder = 3;
    group.add(label);
  }

  const userData: NoteUserData = {
    bar,
    durationMs: note.duration_ms,
    id: note.id,
    isLava,
    pitch: note.pitch,
    staff,
    startMs: note.start_ms,
    status: "pending",
  };
  group.userData = userData;
  return { group, key: noteMeshKey(note) };
}

function makeFingerSprite(
  cache: NoteSpriteMaterialCache,
  digit: number,
  sprites: WaterfallTheme["noteSprites"],
): THREE.Sprite {
  const mat = cache.getFingerMaterial(String(digit), sprites);
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(sprites.fingerWidthPx, sprites.fingerHeightPx, 1);
  return sprite;
}

function makeLabelSprite(
  cache: NoteSpriteMaterialCache,
  pitch: number,
  sprites: WaterfallTheme["noteSprites"],
): THREE.Sprite {
  const mat = cache.getLabelMaterial(pitch, sprites);
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(sprites.labelWidthPx, sprites.labelHeightPx, 1);
  return sprite;
}
