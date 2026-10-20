import { inject, Injectable } from '@angular/core';
import { THAILAND_BBOX } from '@jaeng/shared/report';
import type { ReportFilter } from '../../core/filter-state.service';
import { SupabaseService } from '../../core/supabase.service';
import { Bbox, EMPTY_COLLECTION, PUBLIC_STATUSES, ReportCollection, type ReportProps } from './report';

const SEARCH_MAX = 5;

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private supabase = inject(SupabaseService);

  async inBbox(bbox: Bbox, f: ReportFilter & { q?: string }): Promise<ReportCollection> {
    if (f.levels.length === 0 || f.statuses.length === 0) return EMPTY_COLLECTION;
    const [min_lng, min_lat, max_lng, max_lat] = bbox;
    const args: Record<string, unknown> = {
      min_lng,
      min_lat,
      max_lng,
      max_lat,
      levels: [...f.levels],
      statuses: [...f.statuses],
      categories: f.categories.length ? [...f.categories] : null,
    };
    if (f.q) args['q'] = f.q;
    return this.rpc(args);
  }

  /** Reports anywhere in Thailand whose title or tag holds q (the map's own 30-day rule applies). */
  async search(q: string, limit = SEARCH_MAX): Promise<ReportProps[]> {
    const [min_lng, min_lat, max_lng, max_lat] = THAILAND_BBOX;
    const fc = await this.rpc({ min_lng, min_lat, max_lng, max_lat, statuses: [...PUBLIC_STATUSES], q });
    return fc.features.slice(0, limit).map((f) => f.properties);
  }

  private async rpc(args: Record<string, unknown>): Promise<ReportCollection> {
    const client = await this.supabase.client();
    const { data, error } = await client.rpc('reports_in_bbox', args as never);
    if (error) throw new Error(error.message);
    return data as ReportCollection;
  }
}
