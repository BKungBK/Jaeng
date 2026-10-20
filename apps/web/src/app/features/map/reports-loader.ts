import type { Bbox, ReportCollection } from './report';

export type LoadResult = { data: ReportCollection } | { error: Error };

/** Runs report fetches so that only the latest request's answer is used. */
export class ReportsLoader<F = unknown> {
  private latest = 0;

  constructor(private fetch: (bbox: Bbox, filter: F) => Promise<ReportCollection>) {}

  /** Resolves to null when a newer load started before this one settled. */
  async load(bbox: Bbox, filter: F): Promise<LoadResult | null> {
    const id = ++this.latest;
    let result: LoadResult;
    try {
      result = { data: await this.fetch(bbox, filter) };
    } catch (e) {
      result = { error: e instanceof Error ? e : new Error(String(e)) };
    }
    return id === this.latest ? result : null;
  }
}
