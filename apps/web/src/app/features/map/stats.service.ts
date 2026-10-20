import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import type { Bbox } from './report';

/** The encouragement numbers for a map area (spec 3.2): fixed this Thai calendar month, still open. */
export type Stats = { resolved_this_month: number; open_count: number };

@Injectable({ providedIn: 'root' })
export class StatsService {
  private supabase = inject(SupabaseService);

  async inBbox(bbox: Bbox): Promise<Stats> {
    const [min_lng, min_lat, max_lng, max_lat] = bbox;
    const client = await this.supabase.client();
    const { data, error } = await client.rpc('stats_in_bbox', { min_lng, min_lat, max_lng, max_lat });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as Stats | undefined;
    return { resolved_this_month: row?.resolved_this_month ?? 0, open_count: row?.open_count ?? 0 };
  }
}
