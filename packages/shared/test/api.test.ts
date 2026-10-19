import { expect, test } from 'bun:test';
import { COMMENT_MAX, REPORT_EVENT, REPORTS_CHANNEL } from '../api';
import type { LiveSignal } from '../api';

test('a live signal may carry the hidden status', () => {
  const s = { id: 'r1', status: 'hidden', confirm_count: 0, comment_count: 0 } satisfies LiveSignal;
  expect(s.status).toBe('hidden');
});

test('realtime channel and event names are shared by API and web', () => {
  expect(REPORTS_CHANNEL).toBe('reports');
  expect(REPORT_EVENT).toBe('report');
});

test('comment length limit is 500', () => {
  expect(COMMENT_MAX).toBe(500);
});
