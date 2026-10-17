import { EMPTY_COLLECTION, ReportCollection } from './report';
import { ReportsLoader } from './reports-loader';

const fc = (n: number): ReportCollection => ({ ...EMPTY_COLLECTION, features: Array(n).fill(null) });

describe('ReportsLoader', () => {
  it('drops a slow response that a newer request overtook', async () => {
    let releaseSlow!: (v: ReportCollection) => void;
    const slow = new Promise<ReportCollection>((r) => (releaseSlow = r));
    const fetch = vi.fn().mockReturnValueOnce(slow).mockResolvedValueOnce(fc(2));
    const loader = new ReportsLoader(fetch);

    const a = loader.load([0, 0, 1, 1], [0]);
    const b = loader.load([0, 0, 2, 2], [0]);
    expect(await b).toEqual({ data: fc(2) });
    releaseSlow(fc(1));
    expect(await a).toBeNull();
  });

  it('turns a failure into an error result', async () => {
    const loader = new ReportsLoader(() => Promise.reject(new Error('offline')));
    const result = await loader.load([0, 0, 1, 1], [0]);
    expect(result && 'error' in result && result.error.message).toBe('offline');
  });
});
