import { expect, test } from 'bun:test';
import { FLAG_HIDE_AT, FLAG_REASONS, LOCATION_MODES, LOG_ACTIONS, NOTE_MAX, POINT_MAX_SHIFT_M, REJECT_NOTE_MAX } from '../admin';

test('flag reasons match the flags.reason check constraint', () => {
  expect(FLAG_REASONS).toEqual(['spam', 'false', 'personal_attack', 'privacy', 'other']);
});

test('location modes are keep, exact, fuzz and point', () => {
  expect(LOCATION_MODES.length).toBe(4);
  expect(LOCATION_MODES).toEqual(['keep', 'exact', 'fuzz', 'point']);
});

test('moderation limits', () => {
  expect(NOTE_MAX).toBe(500);
  expect(REJECT_NOTE_MAX).toBe(200);
  expect(FLAG_HIDE_AT).toBe(3);
  expect(POINT_MAX_SHIFT_M).toBe(1000);
});

test('log actions are unique and complete', () => {
  expect(new Set(LOG_ACTIONS).size).toBe(LOG_ACTIONS.length);
  expect(LOG_ACTIONS.length).toBe(10);
});
