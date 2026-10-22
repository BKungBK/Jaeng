// Moderation types and constants shared by the API and the web app (plan 5).
import type { LiveSignal } from './api';
import type { CategorySlug } from './categories';
import type { MyReport, REJECT_REASONS } from './report';

/** Same list as the check constraint on flags.reason (plan 1 schema). */
export const FLAG_REASONS = ['spam', 'false', 'personal_attack', 'privacy', 'other'] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];
export type FlagTarget = 'report' | 'comment';
export type FlagAction = 'dismiss' | 'hide' | 'ban';

export const LOCATION_MODES = ['keep', 'exact', 'fuzz', 'point'] as const;
export type LocationMode = (typeof LOCATION_MODES)[number];
export type RejectReason = (typeof REJECT_REASONS)[number];

export const NOTE_MAX = 500;
export const REJECT_NOTE_MAX = 200;
/** Distinct members reporting the same target before it hides itself (spec 6.2). */
export const FLAG_HIDE_AT = 3;
/** How far an admin may move a pin away from the true point when approving. */
export const POINT_MAX_SHIFT_M = 1000;

/** What a moderation call changed for the public: a realtime signal and the files to move between buckets. */
export type ModerationEffect = {
  report: LiveSignal | null;
  promote: { from: string; to: string }[];
  demote: string[];
};

export type FixClaimBody = { note?: string; photo_id?: string };
export type FlagBody = { target_type: FlagTarget; target_id: string; reason: FlagReason; note?: string };
export type ApproveBody = {
  category?: CategorySlug;
  danger_level?: 0 | 1 | 2 | 3;
  title?: string;
  location: LocationMode;
  lng?: number;
  lat?: number;
};
export type RejectBody = { reason: RejectReason; note?: string };

export type PhotoRef = { path: string; width: number | null; height: number | null };
export type AdminPhoto = PhotoRef & { url: string; thumb_url: string };
export type AdminCounts = { reports: number; claims: number; flags: number };
export type Person = {
  id: string;
  display_name: string;
  email: string | null;
  role: 'user' | 'admin';
  banned: boolean;
  avatar_path: string | null;
};

export type QueueReport<P = AdminPhoto> = {
  id: string;
  title: string;
  description: string | null;
  category: CategorySlug;
  danger_level: number;
  created_at: string;
  place_name: string | null;
  hide_author: boolean;
  profanity_flag: boolean;
  tags: string[];
  /** Admin only: the true point and the published one. */
  lng: number;
  lat: number;
  public_lng: number;
  public_lat: number;
  author: Person;
  photos: P[];
};

export type QueueClaim<P = AdminPhoto> = {
  id: string;
  note: string | null;
  created_at: string;
  claimant: Person;
  photo: P | null;
  report: { id: string; title: string; category: CategorySlug; danger_level: number; place_name: string | null; days_open: number; photos: P[] };
};

export type QueueFlag<P = AdminPhoto> = {
  /** The oldest open flag; resolving acts on every open flag of the target. */
  flag_id: string;
  target_type: FlagTarget;
  target_id: string;
  hidden: boolean;
  flags: { reason: FlagReason; note: string | null; reporter_name: string; created_at: string }[];
  report: { id: string; title: string; status: MyReport['status']; category: CategorySlug; danger_level: number; photo: P | null };
  comment: { id: string; body: string; photo: P | null } | null;
  /** Owner of the target (report author or comment author). */
  author: Person;
};

export type HiddenItem<P = AdminPhoto> = {
  target_type: FlagTarget;
  target_id: string;
  report: { id: string; title: string; category: CategorySlug; danger_level: number; photo: P | null };
  comment: { id: string; body: string } | null;
};

export type AdminUser = {
  id: string;
  display_name: string;
  email: string | null;
  role: 'user' | 'admin';
  banned_at: string | null;
  avatar_path: string | null;
  created_at: string;
  report_count: number;
  comment_count: number;
};

export type LogEntry = {
  id: number;
  created_at: string;
  action: string;
  target_type: string;
  target_id: string | null;
  detail: Record<string, unknown>;
  /** null for the system (auto-hide). */
  admin_name: string | null;
  /** Who or what: the user's name, or the report's title (for a comment, its report's). */
  target_name: string | null;
};

export const LOG_ACTIONS = [
  'approve_report', 'reject_report', 'approve_claim', 'reject_claim', 'hide', 'restore',
  'auto_hide', 'dismiss_flags', 'ban', 'unban', 'remove_avatar',
] as const;
