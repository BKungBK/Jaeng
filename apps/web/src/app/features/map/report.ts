// Shape of a public report as returned by reports_in_bbox (supabase/migrations/*_public_api.sql).
import type { CategorySlug } from '@jaeng/shared/categories';
import type { DangerLevel } from '@jaeng/shared/levels';
import type { PublicStatus } from '@jaeng/shared/api';
import type { FeatureCollection, Point } from 'geojson';

export type { PublicStatus } from '@jaeng/shared/api';

export type ReportProps = {
  id: string;
  title: string;
  category: CategorySlug;
  icon: string;
  danger_level: DangerLevel;
  status: PublicStatus;
  confirm_count: number;
  comment_count: number;
  days_open: number;
  cover_photo_path: string | null;
};

export type ReportCollection = FeatureCollection<Point, ReportProps>;

/** [minLng, minLat, maxLng, maxLat] */
export type Bbox = [number, number, number, number];

export const PUBLIC_STATUSES: readonly PublicStatus[] = ['open', 'fix_claimed', 'resolved'];

export const EMPTY_COLLECTION: ReportCollection = { type: 'FeatureCollection', features: [] };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Map bounds → a bbox Postgres accepts: inside ±180/±85, and all longitudes when the view wraps. */
export function toBbox(b: { west: number; south: number; east: number; north: number }): Bbox {
  const wraps = b.west < -180 || b.east > 180 || b.east - b.west >= 360;
  return [
    wraps ? -180 : b.west,
    clamp(b.south, -85, 85),
    wraps ? 180 : b.east,
    clamp(b.north, -85, 85),
  ];
}

export function coverPhotoUrl(path: string): string {
  return `${location.origin}/sb/storage/v1/object/public/photos-public/${path}`;
}
