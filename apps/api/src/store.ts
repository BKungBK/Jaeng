import type { FlagReason, FlagTarget, ModerationEffect } from '@jaeng/shared/admin';
import type { PublicComment, ReportSignal } from '@jaeng/shared/api';
import type { CategorySlug } from '@jaeng/shared/categories';
import type { DuplicateCandidate, MyReport } from '@jaeng/shared/report';

export type Member = { id: string; role: 'user' | 'admin'; banned: boolean };

// Interface only; the Supabase implementation arrives with the routes.
export type Store = {
  member(id: string): Promise<Member | null>;
  toggleConfirmation(reportId: string, userId: string): Promise<{ confirmed: boolean; report: ReportSignal }>;
  /** Creates the unattached photo row; throws ApiError('rate_limited') over `limit` uploads per 24 h. */
  registerPhoto(
    p: { id: string; uploaderId: string; path: string; width: number; height: number; blurred: boolean },
    limit: number,
  ): Promise<void>;
  /** Rolls back a registerPhoto whose files could not be stored. */
  deletePhoto(id: string): Promise<void>;
  /** Up to 3 published open reports of the category within 50 m (hazards: of the shifted point). */
  findDuplicates(lng: number, lat: number, category: CategorySlug): Promise<DuplicateCandidate[]>;
  /** Throws ApiError rate_limited / invalid_photos / invalid_report, all decided by the database. */
  createReport(input: {
    userId: string;
    category: CategorySlug;
    lng: number;
    lat: number;
    photoIds: string[];
    title: string | null;
    description: string | null;
    danger: number | null;
    tags: string[];
    hideAuthor: boolean;
    flagged: boolean;
    limit: number;
  }): Promise<{ id: string; status: 'pending_review' }>;
  /** `limit`: comments per user per 24 h, enforced by the database. */
  addComment(reportId: string, userId: string, body: string, limit?: number): Promise<{ comment: PublicComment; report: ReportSignal }>;
  /** Confirm (never toggles off) plus a photo comment, atomically. `moved` lists the files to promote. */
  mergeDuplicate(
    reportId: string,
    userId: string,
    photoIds: string[],
    limit: number,
  ): Promise<{ confirmed: boolean; comment: PublicComment; report: ReportSignal; moved: { from: string; to: string }[] }>;
  /** Own reports, newest first, at most 100. No coordinates. */
  myReports(userId: string): Promise<(Omit<MyReport, 'thumb_url'> & { cover_path: string | null })[]>;
  /** Returns the stored display_name. */
  renameMember(userId: string, name: string): Promise<string>;
  /** Deletes unattached photo rows older than the age and returns them (deleting is the claim). */
  deleteOrphanPhotos(olderThanHours: number): Promise<{ id: string; path: string }[]>;
  /** "It's fixed": the report waits for an admin; the photo stays private until approved. */
  createFixClaim(i: {
    reportId: string;
    userId: string;
    note: string | null;
    photoId: string | null;
    limit: number;
  }): Promise<{ claimId: string; effect: ModerationEffect }>;
  /** One open flag per member and target; the third distinct member hides the target. */
  createFlag(i: {
    userId: string;
    targetType: FlagTarget;
    targetId: string;
    reason: FlagReason;
    note: string | null;
    limit: number;
  }): Promise<{ flagId: string; hidden: boolean; effect: ModerationEffect }>;
};
