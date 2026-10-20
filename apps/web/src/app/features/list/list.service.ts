import { inject, Injectable } from '@angular/core';
import type { PublicStatus } from '@jaeng/shared/api';
import type { CategorySlug } from '@jaeng/shared/categories';
import type { DangerLevel } from '@jaeng/shared/levels';
import type { LngLat } from '../../core/device.service';
import { SupabaseService } from '../../core/supabase.service';
import { en } from '../../i18n/en';
import type { Locale } from '../../i18n/keys';
import { th } from '../../i18n/th';
import type { Bbox, ReportProps } from '../map/report';

export type ListSort = 'near' | 'new' | 'confirms' | 'oldest';
export const LIST_SORTS: readonly ListSort[] = ['near', 'new', 'confirms', 'oldest'];
export const LIST_PAGE = 50;

export type ListRow = ReportProps & {
  place_name: string | null;
  approved_at: string;
  resolved_at: string | null;
  distance_m: number | null;
};

export type ListQuery = {
  bbox: Bbox;
  levels: readonly DangerLevel[];
  categories: readonly CategorySlug[];
  statuses: readonly PublicStatus[];
  includeOld: boolean;
  sort: ListSort;
  near: LngLat | null;
  offset: number;
};

/** /list's rows from list_reports (supabase/migrations/20261020000100_experience.sql), 50 a page. */
@Injectable({ providedIn: 'root' })
export class ListService {
  private supabase = inject(SupabaseService);

  async page(q: ListQuery): Promise<ListRow[]> {
    if (q.levels.length === 0 || q.statuses.length === 0) return [];
    const [min_lng, min_lat, max_lng, max_lat] = q.bbox;
    const client = await this.supabase.client();
    const { data, error } = await client.rpc('list_reports', {
      min_lng,
      min_lat,
      max_lng,
      max_lat,
      levels: [...q.levels],
      categories: q.categories.length ? [...q.categories] : undefined,
      statuses: [...q.statuses],
      include_old_resolved: q.includeOld,
      sort: q.sort,
      near_lng: q.near?.lng,
      near_lat: q.near?.lat,
      p_limit: LIST_PAGE,
      p_offset: q.offset,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as ListRow[];
  }
}

const UNITS: Record<Locale, { m: string; km: string }> = {
  th: { m: th.list.unitM, km: th.list.unitKm },
  en: { m: en.list.unitM, km: en.list.unitKm },
};

/** "350 ม." / "350 m" under a kilometre, else one decimal: "1.2 กม." / "1.2 km". */
export function formatDistance(m: number, locale: Locale): string {
  const u = UNITS[locale];
  return m < 1000 ? `${Math.round(m)} ${u.m}` : `${(m / 1000).toFixed(1)} ${u.km}`;
}
