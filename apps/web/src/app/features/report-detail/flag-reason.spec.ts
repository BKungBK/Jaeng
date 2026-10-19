import { FLAG_REASONS } from '@jaeng/shared/admin';
import { FLAG_REASON_TH } from './flag-reason';

describe('FLAG_REASON_TH', () => {
  it('names all five reasons once each', () => {
    expect(Object.keys(FLAG_REASON_TH).sort()).toEqual([...FLAG_REASONS].sort());
    const words = Object.values(FLAG_REASON_TH);
    expect(new Set(words).size).toBe(5);
    expect(FLAG_REASON_TH.spam).toBe('สแปมหรือโฆษณา');
    expect(FLAG_REASON_TH.other).toBe('อื่นๆ');
  });
});
