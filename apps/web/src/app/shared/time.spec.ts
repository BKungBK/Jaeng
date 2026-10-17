import { formatAgo, formatDate } from './time';

describe('formatAgo', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');

  it('says "just now" under a minute', () => {
    expect(formatAgo('2026-10-17T11:59:30Z', now)).toBe('เมื่อสักครู่');
  });

  it('counts days in Thai', () => {
    expect(formatAgo('2026-10-14T12:00:00Z', now)).toBe('3 วันที่แล้ว');
  });

  it('counts minutes and hours', () => {
    expect(formatAgo('2026-10-17T11:55:00Z', now)).toBe('5 นาทีที่แล้ว');
    expect(formatAgo('2026-10-17T09:00:00Z', now)).toBe('3 ชั่วโมงที่แล้ว');
    expect(formatAgo('2026-10-16T11:00:00Z', now)).toBe('เมื่อวาน');
  });

  it('treats a time slightly in the future (clock skew) as just now', () => {
    expect(formatAgo('2026-10-17T12:00:20Z', now)).toBe('เมื่อสักครู่');
  });
});

describe('formatDate', () => {
  it('uses the Buddhist year', () => {
    expect(formatDate('2026-10-17T00:00:00Z')).toContain('2569');
  });
});
