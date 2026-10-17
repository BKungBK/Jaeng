import { declutter, Rect } from './declutter';

const r = (left: number, top: number, w = 40, h = 20): Rect => ({ left, top, right: left + w, bottom: top + h });

describe('declutter', () => {
  it('hides a label under an obstacle', () => {
    expect(declutter([r(0, 0)], [r(10, 5)])).toEqual([false]);
  });

  it('keeps a label clear of obstacles', () => {
    expect(declutter([r(0, 0)], [r(100, 100)])).toEqual([true]);
  });

  it('keeps the first of two overlapping labels', () => {
    expect(declutter([r(0, 0), r(20, 10), r(200, 0)], [])).toEqual([true, false, true]);
  });

  it('ignores labels that are not on screen (zero size)', () => {
    expect(declutter([{ left: 0, top: 0, right: 0, bottom: 0 }, r(0, 0)], [])).toEqual([false, true]);
  });
});
