// When the animated sea draws its next frame: at most 60 frames a second (rolling swell judders at
// 30), never with reduced motion or a hidden tab (the map then repaints only when it moves).

export const SEA_FRAME_MS = 1000 / 60;

export class SeaClock {
  private last = -Infinity;

  constructor(
    private reducedMotion: boolean,
    private now: () => number = () => performance.now(),
  ) {}

  /** Seconds for the shader; constant under reduced motion so the sea is a still picture. */
  time(): number {
    return this.reducedMotion ? 12.5 : (this.now() / 1000) % 3600;
  }

  /** Call once per drawn frame. */
  drew(): void {
    this.last = this.now();
  }

  /** Milliseconds until the next animation frame is due, or null when the sea should hold still. */
  nextFrameIn(hidden: boolean): number | null {
    if (this.reducedMotion || hidden) return null;
    return Math.max(0, SEA_FRAME_MS - (this.now() - this.last));
  }
}
