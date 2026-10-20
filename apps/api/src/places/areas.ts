import type { Place } from '@jaeng/shared/places';

/** A row of the search_areas RPC (supabase/migrations/20261020000100_experience.sql). */
export type AreaRow = {
  level: number;
  name_th: string;
  name_en: string;
  province_th: string;
  province_en: string | null;
  lng: number;
  lat: number;
  min_lng: number;
  min_lat: number;
  max_lng: number;
  max_lat: number;
};

/** A district reads "district · province"; a province stands alone. */
export function areaToPlace(a: AreaRow, lang: 'th' | 'en'): Place {
  const en = lang === 'en';
  return {
    name: en ? a.name_en : a.name_th,
    detail: a.level === 1 ? null : en ? (a.province_en ?? a.province_th) : a.province_th,
    lng: a.lng,
    lat: a.lat,
    bbox: [a.min_lng, a.min_lat, a.max_lng, a.max_lat],
    source: 'local',
  };
}
