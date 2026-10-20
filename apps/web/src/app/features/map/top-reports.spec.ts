import type { ReportProps } from './report';
import { topReports } from './top-reports';

const r = (id: string, o: Partial<ReportProps>) =>
  ({ id, status: 'open', danger_level: 0, confirm_count: 0, days_open: 0, ...o }) as ReportProps;

describe('topReports', () => {
  it('puts unresolved first, then higher level, more me-too, longer wait', () => {
    const out = topReports(
      [
        r('done', { status: 'resolved', danger_level: 3 }),
        r('a', { danger_level: 1, confirm_count: 9 }),
        r('b', { danger_level: 3, confirm_count: 1 }),
        r('c', { danger_level: 3, confirm_count: 5 }),
        r('d', { danger_level: 3, confirm_count: 5, days_open: 12 }),
      ],
      3,
    );
    expect(out.map((p) => p.id)).toEqual(['d', 'c', 'b']);
  });

  it('counts a claimed fix as still unresolved', () => {
    const out = topReports([r('done', { status: 'resolved', danger_level: 3 }), r('claimed', { status: 'fix_claimed' })], 2);
    expect(out.map((p) => p.id)).toEqual(['claimed', 'done']);
  });

  it('does not reorder the input and copes with fewer than n', () => {
    const items = [r('low', { danger_level: 0 }), r('high', { danger_level: 3 })];
    expect(topReports(items.slice(0, 1), 3).map((p) => p.id)).toEqual(['low']);
    expect(topReports(items, 3).map((p) => p.id)).toEqual(['high', 'low']);
    expect(items.map((p) => p.id)).toEqual(['low', 'high']);
  });
});
