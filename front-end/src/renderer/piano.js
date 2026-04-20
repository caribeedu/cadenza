// Interactive SVG piano keyboard that sits below the waterfall. Owns the
// source of truth for lane geometry — the waterfall asks the piano where
// each pitch's lane sits so the falling bars line up exactly with the
// visible keys (black keys narrower than whites, etc.).
//
// The class is intentionally thin: all geometry lives in `piano-layout.js`
// so it can be unit-tested without a DOM. This file only does DOM work.

import { computeKeyboardLayout, isBlackKey } from "./piano-layout.js";
import { octaveForPitch } from "./timeline.js";

const SVG_NS = "http://www.w3.org/2000/svg";

const CLASS_WHITE = "key-white";
const CLASS_BLACK = "key-black";
const CLASS_LABEL = "key-label";
const STATE_CLASSES = [
  "key-pressed-good",
  "key-pressed-bad",
  "key-pressed-neutral",
  "key-target",
];

const DEFAULT_LOW = 36;   // C2
const DEFAULT_HIGH = 96;  // C7

/**
 * Emits a `resize` CustomEvent when the host element changes size. Consumers
 * (the waterfall) re-query lane positions on that event.
 */
export class PianoKeyboard extends EventTarget {
  constructor(host, { low = DEFAULT_LOW, high = DEFAULT_HIGH } = {}) {
    super();
    if (!host) throw new Error("PianoKeyboard requires a host element");

    this.host = host;
    this.low = low;
    this.high = high;

    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.setAttribute("preserveAspectRatio", "none");
    this.svg.setAttribute("role", "img");
    this.svg.setAttribute("aria-label", "Piano keyboard");
    host.replaceChildren(this.svg);

    this.keyNodes = new Map();
    this._flashTimers = new Map();
    this.layoutData = null;

    this._resizeObs = new ResizeObserver(() => this.layout());
    this._resizeObs.observe(host);
    this.layout();
  }

  destroy() {
    this._resizeObs.disconnect();
    for (const t of this._flashTimers.values()) clearTimeout(t);
    this._flashTimers.clear();
    this.svg.remove();
  }

  /** Re-read host size and re-render the SVG. Safe to call repeatedly. */
  layout() {
    const w = this.host.clientWidth || 0;
    const h = this.host.clientHeight || 0;
    if (w === 0 || h === 0) return;

    this.layoutData = computeKeyboardLayout({
      low: this.low,
      high: this.high,
      totalWidthPx: w,
    });
    this._render(w, h);
    this.dispatchEvent(new CustomEvent("resize", { detail: { width: w, height: h } }));
  }

  /** Horizontal centre (in host-local pixels) of the lane for `pitch`. */
  laneCenterPx(pitch) {
    return this.layoutData ? this.layoutData.laneCenterPx(pitch) : 0;
  }

  /** Width (in host-local pixels) of the lane for `pitch`. */
  laneWidthPx(pitch) {
    return this.layoutData ? this.layoutData.laneWidthPx(pitch) : 0;
  }

  totalWidthPx() {
    return this.layoutData?.totalWidthPx ?? 0;
  }

  /**
   * Persistent highlight until `clear(pitch)` is called.
   * Returns `true` if a key was actually painted, `false` if the pitch is
   * outside the keyboard's rendered range — useful for callers that want
   * to log a diagnostic instead of silently dropping feedback.
   */
  highlight(pitch, kind = "target") {
    const node = this.keyNodes.get(pitch);
    if (!node) return false;
    this._clearStateClasses(node);
    node.classList.add(cssClassForKind(kind));
    return true;
  }

  clear(pitch) {
    const node = this.keyNodes.get(pitch);
    if (!node) return false;
    this._clearStateClasses(node);
    return true;
  }

  /**
   * Transient highlight that auto-clears after `durationMs`.
   * Same return semantics as `highlight` so callers can detect
   * out-of-range pitches.
   */
  flash(pitch, kind = "good", durationMs = 300) {
    const painted = this.highlight(pitch, kind);
    if (!painted) return false;
    const existing = this._flashTimers.get(pitch);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      this.clear(pitch);
      this._flashTimers.delete(pitch);
    }, durationMs);
    this._flashTimers.set(pitch, t);
    return true;
  }

  /** True if the given pitch has a rendered key in this keyboard. */
  hasKey(pitch) {
    return this.keyNodes.has(pitch);
  }

  /** Range currently rendered by this keyboard. */
  get range() {
    return { low: this.low, high: this.high };
  }

  _render(w, h) {
    this.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    this.svg.setAttribute("width", String(w));
    this.svg.setAttribute("height", String(h));
    this.svg.replaceChildren();
    this.keyNodes.clear();

    const blackHeight = Math.round(h * 0.62);
    const labelY = h - 6;
    const { whites, blacks, whiteWidth } = this.layoutData;

    // Whites first so blacks (drawn next) overlap them correctly.
    for (const { pitch, xLeft } of whites) {
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("class", CLASS_WHITE);
      rect.setAttribute("x", String(xLeft));
      rect.setAttribute("y", "0");
      rect.setAttribute("width", String(whiteWidth));
      rect.setAttribute("height", String(h));
      rect.setAttribute("rx", "3");
      rect.setAttribute("ry", "3");
      rect.dataset.pitch = String(pitch);
      this.svg.appendChild(rect);
      this.keyNodes.set(pitch, rect);

      if (pitch % 12 === 0) {
        const label = document.createElementNS(SVG_NS, "text");
        label.setAttribute("class", CLASS_LABEL);
        label.setAttribute("x", String(xLeft + whiteWidth / 2));
        label.setAttribute("y", String(labelY));
        label.setAttribute("text-anchor", "middle");
        label.textContent = `C${octaveForPitch(pitch)}`;
        this.svg.appendChild(label);
      }
    }

    for (const { pitch, xLeft, width } of blacks) {
      if (!isBlackKey(pitch)) continue;
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("class", CLASS_BLACK);
      rect.setAttribute("x", String(xLeft));
      rect.setAttribute("y", "0");
      rect.setAttribute("width", String(width));
      rect.setAttribute("height", String(blackHeight));
      rect.setAttribute("rx", "2");
      rect.setAttribute("ry", "2");
      rect.dataset.pitch = String(pitch);
      this.svg.appendChild(rect);
      this.keyNodes.set(pitch, rect);
    }
  }

  _clearStateClasses(node) {
    for (const cls of STATE_CLASSES) node.classList.remove(cls);
  }
}

function cssClassForKind(kind) {
  if (kind === "good") return "key-pressed-good";
  if (kind === "bad") return "key-pressed-bad";
  if (kind === "neutral") return "key-pressed-neutral";
  return "key-target";
}
