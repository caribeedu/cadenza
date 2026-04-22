import type { NoteSpritesDims } from "@app/theme/ui-theme";
import * as THREE from "three";

import { isAccidental } from "../timeline";
import { midiFromName } from "./pitch-name";

const LABEL_FONT_SCALE = 0.78;
const FINGER_FONT_SCALE = 0.82;

/**
 * Canvas-backed sprite materials for pitch labels and finger digits.
 * Textures are cached by string key to avoid redundant GPU uploads.
 */
export class NoteSpriteMaterialCache {
  private readonly labelMaterials = new Map<string, THREE.SpriteMaterial>();
  private readonly fingerMaterials = new Map<string, THREE.SpriteMaterial>();

  private fingerCacheKey(digit: string, s: NoteSpritesDims): string {
    return `${digit}:${s.fingerWidthPx}x${s.fingerHeightPx}`;
  }

  private labelCacheKey(text: string, s: NoteSpritesDims): string {
    return `${text}:${s.labelWidthPx}x${s.labelHeightPx}`;
  }

  dispose(): void {
    for (const mat of this.labelMaterials.values()) {
      mat.map?.dispose();
      mat.dispose();
    }
    this.labelMaterials.clear();
    for (const mat of this.fingerMaterials.values()) {
      mat.map?.dispose();
      mat.dispose();
    }
    this.fingerMaterials.clear();
  }

  getLabelMaterial(text: string, sprites: NoteSpritesDims): THREE.SpriteMaterial {
    const key = this.labelCacheKey(text, sprites);
    const cached = this.labelMaterials.get(key);
    if (cached) return cached;

    const dpr = Math.ceil((window.devicePixelRatio || 1) * 2);
    const cw = sprites.labelWidthPx * dpr;
    const ch = sprites.labelHeightPx * dpr;

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    ctx.clearRect(0, 0, cw, ch);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.floor(ch * LABEL_FONT_SCALE)}px system-ui, -apple-system, "Segoe UI", sans-serif`;

    const strokeW = Math.max(3, Math.floor(ch * 0.22));
    ctx.lineWidth = strokeW;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = "rgba(8,10,20,0.96)";
    ctx.strokeText(text, cw / 2, ch / 2 + 1);
    ctx.fillStyle = isAccidental(midiFromName(text))
      ? "rgba(242,246,255,0.92)"
      : "rgba(255,255,255,1)";
    ctx.fillText(text, cw / 2, ch / 2 + 1);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;

    const mat = new THREE.SpriteMaterial({
      depthTest: false,
      depthWrite: false,
      map: tex,
      transparent: true,
    });
    this.labelMaterials.set(key, mat);
    return mat;
  }

  getFingerMaterial(digit: string, sprites: NoteSpritesDims): THREE.SpriteMaterial {
    const key = this.fingerCacheKey(digit, sprites);
    const cached = this.fingerMaterials.get(key);
    if (cached) return cached;

    const dpr = Math.ceil((window.devicePixelRatio || 1) * 2);
    const cw = sprites.fingerWidthPx * dpr;
    const ch = sprites.fingerHeightPx * dpr;

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    ctx.clearRect(0, 0, cw, ch);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${Math.floor(ch * FINGER_FONT_SCALE)}px system-ui, -apple-system, "Segoe UI", sans-serif`;

    const cx = cw / 2;
    const cy = ch / 2 + 1;
    const strokeW = Math.max(4, Math.floor(ch * 0.3));

    ctx.lineJoin = "round";
    ctx.miterLimit = 2;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.88)";
    ctx.shadowBlur = Math.max(5, Math.floor(ch * 0.38));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(1, Math.floor(ch * 0.12));
    ctx.strokeStyle = "rgba(6,8,16,0.55)";
    ctx.lineWidth = strokeW + 5;
    ctx.strokeText(digit, cx, cy);
    ctx.restore();

    ctx.strokeStyle = "rgba(8,10,20,0.97)";
    ctx.lineWidth = strokeW;
    ctx.strokeText(digit, cx, cy);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.fillText(digit, cx, cy);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;

    const mat = new THREE.SpriteMaterial({
      depthTest: false,
      depthWrite: false,
      map: tex,
      transparent: true,
    });
    this.fingerMaterials.set(key, mat);
    return mat;
  }
}
