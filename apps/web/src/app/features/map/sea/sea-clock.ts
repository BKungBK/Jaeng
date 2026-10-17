// When the animated sea draws its next frame: at most 30 frames a second (each one repaints the
// whole map, and the sea only drifts slowly, so 60 cost a lot for nothing), never in a hidden tab
// (the map then repaints only when it moves). The sea always moves: the owner ruled out honouring
// prefers-reduced-motion (2026-10-17).

export const SEA_FRAME_MS = 1000 / 30;

export class SeaClock {
  private last = -Infinity;

  constructor(private now: () => number = () => performance.now()) {}

  /** Seconds for the shader. */
  time(): number {
    return (this.now() / 1000) % 3600;
  }

  /** Call once per drawn frame. */
  drew(): void {
    this.last = this.now();
  }

  /** Milliseconds until the next animation frame is due, or null while the tab is hidden. */
  nextFrameIn(hidden: boolean): number | null {
    if (hidden) return null;
    return Math.max(0, SEA_FRAME_MS - (this.now() - this.last));
  }
}
