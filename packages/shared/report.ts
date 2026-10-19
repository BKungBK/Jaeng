// Report-flow constants and types shared by the API and the web app (plan 4).
import type { CategorySlug } from './categories';

export const PHOTOS_PER_REPORT_MAX = 4;
/** Spec 6.3: enforced by the browser and again by the API. */
export const PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const PHOTO_MAX_SIDE = 1600;
export const THUMB_SIDE = 400;

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 1000;
export const TAGS_MAX = 5;
export const TAG_MAX = 30;
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 30;

export const DUPLICATE_RADIUS_M = 50;
export const HAZARD_FUZZ_M = 150;

/** Thailand's extent: [west, south, east, north]. One number set for the whole app. */
export const THAILAND_BBOX: readonly [west: number, south: number, east: number, north: number] = [97.3, 5.6, 105.7, 20.5];

export function inThailand(lng: number, lat: number): boolean {
  const [west, south, east, north] = THAILAND_BBOX;
  return lng >= west && lng <= east && lat >= south && lat <= north;
}

/** NFC, trim, strip any number of leading '#', trim again, lowercase. null when empty or over TAG_MAX code points. */
export function normalizeTag(raw: string): string | null {
  const tag = raw.normalize('NFC').trim().replace(/^#+/, '').trim().toLowerCase();
  if (tag.length === 0 || [...tag].length > TAG_MAX) return null;
  return tag;
}

/** 'a/b.webp' -> 'a/b_thumb.webp' */
export function thumbPath(path: string): string {
  const dot = path.lastIndexOf('.');
  const slash = path.lastIndexOf('/');
  if (dot <= slash) return `${path}_thumb`;
  return `${path.slice(0, dot)}_thumb${path.slice(dot)}`;
}

export const REJECT_REASONS = ['duplicate', 'not_public', 'inappropriate', 'insufficient', 'other'] as const;

export type NewReportBody = {
  category: CategorySlug;
  lng: number;
  lat: number;
  photo_ids: string[];
  title?: string;
  description?: string;
  danger_level?: 0 | 1 | 2 | 3;
  tags?: string[];
  hide_author?: boolean;
};

export type PhotoUploaded = { photo_id: string; width: number; height: number };

export type DuplicateCandidate = {
  id: string;
  title: string;
  category: CategorySlug;
  status: 'open' | 'fix_claimed';
  danger_level: number;
  confirm_count: number;
  cover_photo_path: string | null;
};

export type MyReport = {
  id: string;
  title: string;
  category: CategorySlug;
  danger_level: number;
  status: 'pending_review' | 'open' | 'fix_claimed' | 'resolved' | 'rejected' | 'hidden';
  reject_reason: string | null;
  place_name: string | null;
  confirm_count: number;
  comment_count: number;
  created_at: string;
  thumb_url: string | null;
};
