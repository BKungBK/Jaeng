// A public report with everything the detail panel shows (the `public_reports` view).
import type { ReportProps } from '../map/report';

export type ReportPhoto = { path: string; kind: 'before' | 'after'; width: number | null; height: number | null };

export type ReportDetail = ReportProps & {
  description: string | null;
  lng: number;
  lat: number;
  place_name: string | null;
  author_name: string | null;
  tags: string[];
  photos: ReportPhoto[];
  created_at: string;
  approved_at: string;
  resolved_at: string | null;
};

export const DETAIL_COLUMNS =
  'id, category, icon, danger_level, title, description, status, lng, lat, place_name, confirm_count, comment_count, ' +
  'days_open, author_name, cover_photo_path, tags, approved_at, resolved_at, photos, created_at';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
