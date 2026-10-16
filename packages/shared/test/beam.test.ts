import { expect, test } from 'bun:test';
import { beamHeight } from '../beam';

test('beam height follows the log curve from the spec', () => {
  expect([0, 1, 3, 10, 40].map(beamHeight)).toEqual([60, 96, 132, 185, 253]);
});

test('beam height is capped at 260', () => {
  expect(beamHeight(1000)).toBe(260);
});

test('negative counts are treated as zero', () => {
  expect(beamHeight(-5)).toBe(60);
});
