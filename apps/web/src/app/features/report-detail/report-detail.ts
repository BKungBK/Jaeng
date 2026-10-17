// A public report with everything the detail panel shows (the `public_reports` view).
import type { CategorySlug } from '@jaeng/shared/categories';
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

/** Same names as the `categories` table (base migration); plan 6 moves UI text into translation files. */
export const CATEGORY_TH: Record<CategorySlug, string> = {
  road: 'ถนน/ทางเท้า',
  light: 'ไฟฟ้า/ไฟส่องสว่าง',
  water: 'น้ำประปา/ท่อระบาย',
  flood: 'น้ำท่วม',
  waste: 'ขยะ',
  tree: 'ต้นไม้',
  hazard: 'จุดเสี่ยง/ความปลอดภัย',
  other: 'อื่นๆ',
};

export const PHOTO_KIND_TH: Record<ReportPhoto['kind'], string> = { before: 'ก่อนแก้', after: 'หลังแก้' };

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
