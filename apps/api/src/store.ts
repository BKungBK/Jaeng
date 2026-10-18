import type { PublicComment, ReportSignal } from '@jaeng/shared/api';
import type { CategorySlug } from '@jaeng/shared/categories';
import type { DuplicateCandidate } from '@jaeng/shared/report';

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
};
