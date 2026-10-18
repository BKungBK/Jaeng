import type { PublicComment, ReportSignal } from '@jaeng/shared/api';

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
  /** `limit`: comments per user per 24 h, enforced by the database. */
  addComment(reportId: string, userId: string, body: string, limit?: number): Promise<{ comment: PublicComment; report: ReportSignal }>;
};
