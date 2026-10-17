import { declutter, placeLabels, Rect } from './declutter';

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

describe('placeLabels', () => {
  it('leaves a clear label where it is', () => {
    expect(placeLabels([r(0, 0)], [r(200, 200)])).toEqual([[0, 0]]);
  });

  it('moves a covered label below the obstacle before hiding it', () => {
    // a 52px cluster disc centred on the label's point
    const [offset] = placeLabels([r(80, 90)], [r(74, 74, 52, 52)]);
    expect(offset).not.toBeNull();
    const [dx, dy] = offset!;
    const moved = r(80 + dx, 90 + dy);
    expect(declutter([moved], [r(74, 74, 52, 52)])).toEqual([true]);
  });

  it('hides a label only when every position is blocked', () => {
    expect(placeLabels([r(80, 90)], [r(0, 0, 400, 400)])).toEqual([null]);
  });

  it('places later labels around earlier ones', () => {
    const [a, b] = placeLabels([r(0, 0), r(10, 0)], []);
    expect(a).toEqual([0, 0]);
    expect(b).not.toBeNull();
    expect(b).not.toEqual([0, 0]);
  });
});
