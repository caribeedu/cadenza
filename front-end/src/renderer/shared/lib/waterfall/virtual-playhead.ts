/**
 * Virtual score-time clock: while playing, virtual ms advances as
 * ``(wallNow - startTimestamp) * speed``; while paused, it is held in
 * ``pausedElapsedMs``. Used by {@link WaterfallRenderer} in this package.
 */
export class VirtualPlayhead {
  startTimestamp: null | number = null;
  pausedElapsedMs: null | number = null;

  constructor(
    private _speed: number,
    private readonly _now: () => number = () => performance.now(),
  ) {}

  get speed(): number {
    return this._speed;
  }

  get isPaused(): boolean {
    return this.pausedElapsedMs != null;
  }

  /** Current virtual score-ms; ``0`` when stopped and never started. */
  getVirtualNowMs(): number {
    if (this.startTimestamp != null) {
      return (this._now() - this.startTimestamp) * this._speed;
    }
    if (this.pausedElapsedMs != null) {
      return this.pausedElapsedMs;
    }
    return 0;
  }

  pause(): void {
    if (this.startTimestamp == null) return;
    this.pausedElapsedMs =
      (this._now() - this.startTimestamp) * this._speed;
    this.startTimestamp = null;
  }

  resume(): void {
    if (this.pausedElapsedMs == null) return;
    this.startTimestamp =
      this._now() - this.pausedElapsedMs / this._speed;
    this.pausedElapsedMs = null;
  }

  stop(): void {
    this.startTimestamp = null;
    this.pausedElapsedMs = null;
  }

  start(): void {
    this.startTimestamp = this._now();
    this.pausedElapsedMs = null;
  }

  startAt(virtualMs: number): void {
    const safe = Number.isFinite(virtualMs) ? Math.max(0, virtualMs) : 0;
    this.startTimestamp = this._now() - safe / this._speed;
    this.pausedElapsedMs = null;
  }

  pauseAt(virtualMs: number): void {
    const safe = Number.isFinite(virtualMs) ? Math.max(0, virtualMs) : 0;
    this.pausedElapsedMs = safe;
    this.startTimestamp = null;
  }

  setPlaybackSpeed(nextSpeed: number, alignToVirtualMs?: number): void {
    if (!Number.isFinite(nextSpeed) || nextSpeed <= 0) return;

    if (
      typeof alignToVirtualMs === "number" &&
      Number.isFinite(alignToVirtualMs)
    ) {
      const virtualMs = Math.max(0, alignToVirtualMs);
      if (this.pausedElapsedMs != null) {
        this.pausedElapsedMs = virtualMs;
      } else {
        this.startTimestamp = this._now() - virtualMs / nextSpeed;
      }
      this._speed = nextSpeed;
      return;
    }

    if (this.startTimestamp != null) {
      const virtualNowMs =
        (this._now() - this.startTimestamp) * this._speed;
      this.startTimestamp = this._now() - virtualNowMs / nextSpeed;
    }
    this._speed = nextSpeed;
  }

  syncToElapsedMs(virtualMs: number): void {
    if (!Number.isFinite(virtualMs)) return;
    const safe = Math.max(0, virtualMs);
    if (this.pausedElapsedMs != null) {
      this.pausedElapsedMs = safe;
    } else if (this.startTimestamp != null) {
      this.startTimestamp = this._now() - safe / this._speed;
    }
  }
}
