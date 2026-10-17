import type { DangerLevel } from '@jaeng/shared/levels';
import type { Bbox, ReportCollection } from './report';

export type LoadResult = { data: ReportCollection } | { error: Error };

/** Runs report fetches so that only the latest request's answer is used. */
export class ReportsLoader {
  private latest = 0;

  constructor(private fetch: (bbox: Bbox, levels: readonly DangerLevel[]) => Promise<ReportCollection>) {}

  /** Resolves to null when a newer load started before this one settled. */
  async load(bbox: Bbox, levels: readonly DangerLevel[]): Promise<LoadResult | null> {
    const id = ++this.latest;
    let result: LoadResult;
    try {
      result = { data: await this.fetch(bbox, levels) };
    } catch (e) {
      result = { error: e instanceof Error ? e : new Error(String(e)) };
    }
    return id === this.latest ? result : null;
  }
}
