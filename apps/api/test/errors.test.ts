import { expect, test } from 'bun:test';
import { MSG_INTERNAL_TH } from '@jaeng/shared/api';
import { ApiError, ERRORS, errorBody } from '../src/errors';

test('errorBody builds the bilingual body', () => {
  expect(errorBody('banned')).toEqual({
    error: { code: 'banned', message_th: 'บัญชีนี้ถูกระงับการใช้งาน', message_en: 'This account is suspended.' },
  });
});

test('every code has a status and both messages', () => {
  for (const [code, e] of Object.entries(ERRORS)) {
    expect(e.status).toBeGreaterThanOrEqual(400);
    expect(e.th.length).toBeGreaterThan(0);
    expect(e.en.length).toBeGreaterThan(0);
    expect(errorBody(code as keyof typeof ERRORS).error.code).toBe(code);
  }
});

test('plan 4 codes have their status and wording', () => {
  expect(errorBody('rate_limited').error.message_th).toBe('วันนี้ทำรายการนี้ครบโควตาแล้ว พรุ่งนี้ลองใหม่นะ');
  expect(ERRORS.rate_limited.status).toBe(429);
  expect(ERRORS.profanity.status).toBe(422);
  expect(ERRORS.invalid_photo.status).toBe(415);
  expect(ERRORS.photo_too_large.status).toBe(413);
  expect(ERRORS.photo_too_large.th).toBe('รูปใหญ่เกินไป (ไม่เกิน 3 MB)');
  expect(ERRORS.invalid_photos.status).toBe(400);
  expect(ERRORS.invalid_report.status).toBe(400);
  expect(ERRORS.invalid_location.th).toBe('ตำแหน่งต้องอยู่ในประเทศไทย');
  expect(ERRORS.invalid_display_name.th).toBe('ชื่อที่แสดงต้องยาว 2–30 ตัวอักษร');
});

test('plan 5 codes have their status and wording', () => {
  expect(errorBody('invalid_state')).toEqual({
    error: { code: 'invalid_state', message_th: 'รายการนี้ถูกจัดการไปแล้ว ลองโหลดใหม่นะ', message_en: 'This item was already handled. Please reload.' },
  });
  expect(ERRORS.forbidden.status).toBe(403);
  expect(ERRORS.item_not_found.status).toBe(404);
  expect(ERRORS.claim_pending.status).toBe(409);
  expect(ERRORS.already_resolved.status).toBe(409);
  expect(ERRORS.cannot_ban_admin.status).toBe(409);
  expect(ERRORS.invalid_note.status).toBe(400);
  expect(ERRORS.invalid_note.th).toBe('ข้อความยาวได้ไม่เกิน 500 ตัวอักษร');
  expect(ERRORS.forbidden.th).toBe('หน้านี้สำหรับผู้ดูแลเท่านั้น');
});

test('the internal message is the shared wording the web app also uses', () => {
  expect(ERRORS.internal.th).toBe(MSG_INTERNAL_TH);
  expect(MSG_INTERNAL_TH).toBe('ระบบขัดข้อง ลองใหม่อีกครั้งนะ');
});

test('ApiError carries its code', () => {
  const e = new ApiError('report_not_found');
  expect(e).toBeInstanceOf(Error);
  expect(e.code).toBe('report_not_found');
});
