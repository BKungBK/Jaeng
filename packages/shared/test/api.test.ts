import { expect, test } from 'bun:test';
import { COMMENT_MAX, REPORT_EVENT, REPORTS_CHANNEL } from '../api';

test('realtime channel and event names are shared by API and web', () => {
  expect(REPORTS_CHANNEL).toBe('reports');
  expect(REPORT_EVENT).toBe('report');
});

test('comment length limit is 500', () => {
  expect(COMMENT_MAX).toBe(500);
});
