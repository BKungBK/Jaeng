import type { PublicComment, ReportSignal } from '@jaeng/shared/api';

export type Member = { id: string; role: 'user' | 'admin'; banned: boolean };

// Interface only; the Supabase implementation arrives with the routes.
export type Store = {
  member(id: string): Promise<Member | null>;
  toggleConfirmation(reportId: string, userId: string): Promise<{ confirmed: boolean; report: ReportSignal }>;
  addComment(reportId: string, userId: string, body: string): Promise<{ comment: PublicComment; report: ReportSignal }>;
};
