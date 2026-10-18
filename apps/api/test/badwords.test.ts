import { describe, expect, test } from 'bun:test';
import { BAD_WORDS, containsBadWord } from '../src/moderation/badwords';

describe('containsBadWord', () => {
  test.each([
    ['ไอ้เหี้ยนี่'],
    ['what the FUCK'],
    ['sh1t road'],
    ['fu​ck'],
    ['shit!'],
    ['FUUUCK this'],
  ])('catches %p', (text) => {
    expect(containsBadWord(text)).toBe(true);
  });

  test.each([
    ['ค้นหาที่จอดรถ'],
    ['ห่างไกลมาก'],
    ['ถนนพังหน้าโรงเรียน'],
    ['class assassin'],
    ['Scunthorpe'],
    ['grassy'],
    ['ถนนเป็นหลุมใหญ่ ช่วยดูหน่อย'],
    [''],
  ])('does not flag %p', (text) => {
    expect(containsBadWord(text)).toBe(false);
  });

  test('lists are populated', () => {
    expect(BAD_WORDS.th.length).toBeGreaterThanOrEqual(20);
    expect(BAD_WORDS.en.length).toBeGreaterThanOrEqual(20);
  });

  test.each([...BAD_WORDS.th, ...BAD_WORDS.en])('every listed word is caught alone: %s', (word) => {
    expect(containsBadWord(word)).toBe(true);
    expect(containsBadWord(`  ${word}  `)).toBe(true);
  });
});
