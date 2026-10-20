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

/** A public status, or 'hidden' for a report that just left the public map (broadcast only). */
export type LiveStatus = PublicStatus | 'hidden';
/** Broadcast payload: a ReportSignal, or a report that just left the public map. */
export type LiveSignal = Omit<ReportSignal, 'status'> & { status: LiveStatus };

export type PublicComment = {
  id: string;
  report_id: string;
  body: string;
  /** null when the report's author hid their name and wrote this comment */
  author_name: string | null;
  by_reporter: boolean;
  created_at: string;
  photo_path: string | null;
};

export type DemoWho = 'reporter' | 'neighbor1' | 'admin';
export type DemoUser = { who: DemoWho; label_th: string; label_en: string };

/** Every error code the web app can see: the API's codes, plus 'network' (web only: the request never got an answer). */
export type ErrorCode =
  | 'unauthorized'
  | 'banned'
  | 'report_not_found'
  | 'report_resolved'
  | 'invalid_body'
  | 'invalid_request'
  | 'not_found'
  | 'internal'
  | 'rate_limited'
  | 'profanity'
  | 'invalid_photo'
  | 'photo_too_large'
  | 'invalid_photos'
  | 'invalid_report'
  | 'invalid_location'
  | 'invalid_display_name'
  | 'forbidden'
  | 'invalid_state'
  | 'item_not_found'
  | 'claim_pending'
  | 'already_resolved'
  | 'cannot_ban_admin'
  | 'invalid_note'
  | 'network';

/** The codes the API itself sends. */
export type ServerErrorCode = Exclude<ErrorCode, 'network'>;

/** One wording for "something broke on our side", on both the API and the web app. */
export const MSG_INTERNAL_TH = 'ระบบขัดข้อง ลองใหม่อีกครั้งนะ';
export const MSG_INTERNAL_EN = 'Something went wrong. Please try again.';

export type ApiErrorBody = { error: { code: ErrorCode; message_th: string; message_en: string } };

export const COMMENT_MAX = 500;
