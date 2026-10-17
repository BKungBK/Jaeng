// Lets a per-render job run only when its inputs changed. The map repaints 30 times a second for
// the animated sea; the beacon sync (DOM writes, layout reads) must not follow it while idle.

export class SyncGate {
  private last = '';
  private version = 0;

  /** Call when the data behind the job changed (new source data, tiles loaded). */
  dataChanged(): void {
    this.version++;
  }

  /** True when the view or data differ from the last time this returned true. */
  changed(view: Record<string, number>): boolean {
    const key = `${this.version}|${Object.entries(view)
      .map(([k, v]) => `${k}=${v}`)
      .join(',')}`;
    if (key === this.last) return false;
    this.last = key;
    return true;
  }
}
