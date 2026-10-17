import type { ApiErrorBody } from '@jaeng/shared/api';

export const ERRORS = {
  unauthorized: { status: 401, th: 'เข้าสู่ระบบก่อนนะ', en: 'Please sign in first.' },
  banned: { status: 403, th: 'บัญชีนี้ถูกระงับการใช้งาน', en: 'This account is suspended.' },
  report_not_found: { status: 404, th: 'ไม่พบเรื่องนี้ หรือเรื่องนี้ยังไม่เปิดให้เห็น', en: 'Report not found.' },
  report_resolved: { status: 409, th: 'เรื่องนี้แก้แล้ว กดเจอเหมือนกันไม่ได้แล้ว', en: 'This report is already resolved.' },
  invalid_body: { status: 400, th: 'ความคิดเห็นต้องยาว 1–500 ตัวอักษร', en: 'Comments must be 1–500 characters.' },
  invalid_request: { status: 400, th: 'ข้อมูลไม่ถูกต้อง', en: 'Invalid request.' },
  not_found: { status: 404, th: 'ไม่พบหน้านี้', en: 'Not found.' },
  internal: { status: 500, th: 'ระบบขัดข้อง ลองใหม่อีกครั้งนะ', en: 'Something went wrong. Please try again.' },
} as const;

export type ErrorCode = keyof typeof ERRORS;

export class ApiError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
    this.name = 'ApiError';
  }
}

export function errorBody(code: ErrorCode): ApiErrorBody {
  const e = ERRORS[code];
  return { error: { code, message_th: e.th, message_en: e.en } };
}
