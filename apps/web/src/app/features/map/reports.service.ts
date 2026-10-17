import { inject, Injectable } from '@angular/core';
import type { DangerLevel } from '@jaeng/shared/levels';
import { SupabaseService } from '../../core/supabase.service';
import { Bbox, EMPTY_COLLECTION, PUBLIC_STATUSES, ReportCollection } from './report';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private supabase = inject(SupabaseService);

  async inBbox(bbox: Bbox, levels: readonly DangerLevel[]): Promise<ReportCollection> {
    if (levels.length === 0) return EMPTY_COLLECTION;
    const [min_lng, min_lat, max_lng, max_lat] = bbox;
    const client = await this.supabase.client();
    const { data, error } = await client.rpc('reports_in_bbox', {
      min_lng,
      min_lat,
      max_lng,
      max_lat,
      levels: [...levels],
      statuses: [...PUBLIC_STATUSES],
    });
    if (error) throw new Error(error.message);
    return data as ReportCollection;
  }
}
