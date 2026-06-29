import * as THREE from "three";
import { isAccidental, nameForPitch } from "../timeline";
import type { NoteSpritesDims } from "./theme";

const LABEL_FONT_SCALE = 1.05;
const FINGER_FONT_SCALE = 1.2;

export class NoteSpriteMaterialCache {
  private readonly labelMaterials = new Map<string, THREE.SpriteMaterial>();
  private readonly fingerMaterials = new Map<string, THREE.SpriteMaterial>();

  dispose() {
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

  getLabelMaterial(
    pitch: number,
    sprites: NoteSpritesDims,
  ): THREE.SpriteMaterial {
    const text = nameForPitch(pitch);
    const key = `${text}:${sprites.labelWidthPx}x${sprites.labelHeightPx}`;
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
    const cx = cw / 2;
    const cy = ch / 2 + 1;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = Math.max(4, Math.floor(ch * 0.24));
    ctx.shadowOffsetY = Math.max(1, Math.floor(ch * 0.08));
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillText(text, cx, cy);
    ctx.restore();

    ctx.lineWidth = strokeW;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(8,10,20,0.96)";
    ctx.strokeText(text, cx, cy);
    ctx.fillStyle = isAccidental(pitch)
      ? "rgba(242,246,255,0.92)"
      : "rgba(255,255,255,1)";
    ctx.fillText(text, cx, cy);

    const mat = new THREE.SpriteMaterial({
      depthTest: false,
      depthWrite: false,
      map: makeTexture(canvas),
      transparent: true,
    });
    this.labelMaterials.set(key, mat);
    return mat;
  }

  getFingerMaterial(digit: string, sprites: NoteSpritesDims): THREE.SpriteMaterial {
    const key = `${digit}:${sprites.fingerWidthPx}x${sprites.fingerHeightPx}`;
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
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.62)";
    ctx.shadowBlur = Math.max(3, Math.floor(ch * 0.22));
    ctx.shadowOffsetY = Math.max(1, Math.floor(ch * 0.08));
    ctx.strokeStyle = "rgba(6,8,16,0.55)";
    ctx.lineWidth = strokeW + 5;
    ctx.strokeText(digit, cx, cy);
    ctx.restore();

    ctx.strokeStyle = "rgba(8,10,20,0.97)";
    ctx.lineWidth = strokeW;
    ctx.strokeText(digit, cx, cy);
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.fillText(digit, cx, cy);

    const mat = new THREE.SpriteMaterial({
      depthTest: false,
      depthWrite: false,
      map: makeTexture(canvas),
      transparent: true,
    });
    this.fingerMaterials.set(key, mat);
    return mat;
  }
}

function makeTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}
