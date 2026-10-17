import { expect, test } from 'bun:test';
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

test('ApiError carries its code', () => {
  const e = new ApiError('report_not_found');
  expect(e).toBeInstanceOf(Error);
  expect(e.code).toBe('report_not_found');
});
