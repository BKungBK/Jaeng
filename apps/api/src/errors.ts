import { MSG_INTERNAL_TH, type ApiErrorBody, type ServerErrorCode } from '@jaeng/shared/api';

type Entry = { status: number; th: string; en: string };

export const ERRORS = {
  unauthorized: { status: 401, th: 'เข้าสู่ระบบก่อนนะ', en: 'Please sign in first.' },
  banned: { status: 403, th: 'บัญชีนี้ถูกระงับการใช้งาน', en: 'This account is suspended.' },
  report_not_found: { status: 404, th: 'ไม่พบเรื่องนี้ หรือเรื่องนี้ยังไม่เปิดให้เห็น', en: 'Report not found.' },
  report_resolved: { status: 409, th: 'เรื่องนี้แก้แล้ว กดเจอเหมือนกันไม่ได้แล้ว', en: 'This report is already resolved.' },
  invalid_body: { status: 400, th: 'ความคิดเห็นต้องยาว 1–500 ตัวอักษร', en: 'Comments must be 1–500 characters.' },
  invalid_request: { status: 400, th: 'ข้อมูลไม่ถูกต้อง', en: 'Invalid request.' },
  not_found: { status: 404, th: 'ไม่พบหน้านี้', en: 'Not found.' },
  rate_limited: { status: 429, th: 'วันนี้ทำรายการนี้ครบโควตาแล้ว พรุ่งนี้ลองใหม่นะ', en: 'Daily limit reached. Please try again tomorrow.' },
  profanity: { status: 422, th: 'ข้อความมีคำที่ไม่เหมาะสม ลองเรียบเรียงใหม่นะ', en: 'The text contains inappropriate words. Please rephrase it.' },
  invalid_photo: { status: 415, th: 'ไฟล์นี้ไม่ใช่รูปที่ใช้ได้ ลองเลือกรูปอื่นนะ', en: 'This file is not a usable image. Please choose another.' },
  photo_too_large: { status: 413, th: 'รูปใหญ่เกินไป (ไม่เกิน 3 MB)', en: 'The photo is too large (3 MB max).' },
  invalid_photos: { status: 400, th: 'รูปที่แนบไม่ถูกต้อง หรือถูกใช้ไปแล้ว', en: 'The attached photos are invalid or already used.' },
  invalid_report: { status: 400, th: 'ข้อมูลเรื่องที่แจ้งไม่ถูกต้อง', en: 'The report details are invalid.' },
  invalid_location: { status: 400, th: 'ตำแหน่งต้องอยู่ในประเทศไทย', en: 'The location must be in Thailand.' },
  invalid_display_name: { status: 400, th: 'ชื่อที่แสดงต้องยาว 2–30 ตัวอักษร', en: 'The display name must be 2–30 characters.' },
  forbidden: { status: 403, th: 'หน้านี้สำหรับผู้ดูแลเท่านั้น', en: 'This page is for moderators only.' },
  invalid_state: { status: 409, th: 'รายการนี้ถูกจัดการไปแล้ว ลองโหลดใหม่นะ', en: 'This item was already handled. Please reload.' },
  item_not_found: { status: 404, th: 'ไม่พบรายการนี้ อาจถูกจัดการไปแล้ว', en: 'Item not found. It may have been handled already.' },
  claim_pending: { status: 409, th: 'มีคนแจ้งว่าแก้แล้ว กำลังรอผู้ดูแลตรวจอยู่นะ', en: 'Someone already reported this fixed; a moderator is checking.' },
  already_resolved: { status: 409, th: 'เรื่องนี้แก้แล้ว ขอบคุณที่ช่วยดูนะ', en: 'This report is already resolved. Thanks for checking.' },
  cannot_ban_admin: { status: 409, th: 'แบนบัญชีผู้ดูแลไม่ได้', en: 'Moderator accounts cannot be banned.' },
  invalid_note: { status: 400, th: 'ข้อความยาวได้ไม่เกิน 500 ตัวอักษร', en: 'The note can be at most 500 characters.' },
  internal: { status: 500, th: MSG_INTERNAL_TH, en: 'Something went wrong. Please try again.' },
} as const satisfies Record<ServerErrorCode, Entry>;

export type ErrorCode = ServerErrorCode;

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
