// Types and constants shared by the API and the web app (auth, report detail, realtime).
export type PublicStatus = 'open' | 'fix_claimed' | 'resolved';

export const REPORTS_CHANNEL = 'reports';
export const REPORT_EVENT = 'report';

/** Realtime Broadcast payload (spec 7.2) and the `report` field of write responses. */
export type ReportSignal = {
  id: string;
  status: PublicStatus;
  confirm_count: number;
  comment_count: number;
};

export type PublicComment = {
  id: string;
  report_id: string;
  body: string;
  /** null when the report's author hid their name and wrote this comment */
  author_name: string | null;
  by_reporter: boolean;
  created_at: string;
};

export type DemoWho = 'reporter' | 'neighbor1' | 'admin';
export type DemoUser = { who: DemoWho; label_th: string };

export type ApiErrorBody = { error: { code: string; message_th: string; message_en: string } };

export const COMMENT_MAX = 500;
