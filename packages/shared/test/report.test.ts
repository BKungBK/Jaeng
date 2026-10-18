import { expect, test } from 'bun:test';
import {
  DUPLICATE_RADIUS_M,
  HAZARD_FUZZ_M,
  PHOTO_MAX_BYTES,
  REJECT_REASONS,
  THAILAND_BBOX,
  inThailand,
  normalizeTag,
  thumbPath,
} from '../report';

test('normalizeTag strips leading hashes, trims and lowercases', () => {
  expect(normalizeTag('  ##หน้าโรงเรียน ')).toBe('หน้าโรงเรียน');
  expect(normalizeTag('#ABC')).toBe('abc');
});

test('normalizeTag rejects empty and over-long tags', () => {
  expect(normalizeTag('# ')).toBeNull();
  expect(normalizeTag('ก'.repeat(31))).toBeNull();
  expect(normalizeTag('ก'.repeat(30))).toBe('ก'.repeat(30));
});

test('inThailand checks the bounding box', () => {
  expect(inThailand(100.5, 13.7)).toBe(true);
  expect(inThailand(0, 0)).toBe(false);
  expect(inThailand(100.5, 25)).toBe(false);
  expect(THAILAND_BBOX).toEqual([97.3, 5.6, 105.7, 20.5]);
});

test('thumbPath inserts _thumb before the extension', () => {
  expect(thumbPath('u/p.webp')).toBe('u/p_thumb.webp');
  expect(thumbPath('a/b.c/d.webp')).toBe('a/b.c/d_thumb.webp');
});

test('constants match the spec', () => {
  expect(REJECT_REASONS.length).toBe(5);
  expect(PHOTO_MAX_BYTES).toBe(3145728);
  expect(DUPLICATE_RADIUS_M).toBe(50);
  expect(HAZARD_FUZZ_M).toBe(150);
});
