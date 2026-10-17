import { clampCenter, MAP_BOUNDS, THAILAND_BOUNDS } from './map-factory';
import { toyOpacity, zoomHint } from './toy';

describe('toyOpacity', () => {
  it.each([
    [5, 1],
    [6, 1],
    [7, 0.5],
    [8, 0],
    [12, 0],
  ])('zoom %d → %d', (zoom, opacity) => {
    expect(toyOpacity(zoom)).toBeCloseTo(opacity);
  });
});

describe('zoomHint', () => {
  it('says the filters are all off', () => {
    expect(zoomHint(5, 0, 0)).toBe('ปิดตัวกรองครบทุกระดับแล้ว แตะชิปด้านบนเพื่อดูเรื่องอีกครั้ง');
  });

  it('says nothing matches here', () => {
    expect(zoomHint(5, 0, 4)).toBe('ยังไม่มีเรื่องตรงกับตัวกรองในบริเวณนี้');
  });

  it.each([
    [3, 'ภาพรวมประเทศ: วงตัวเลข = จำนวนเรื่องในพื้นที่ ซูมเข้าเพื่อดูแต่ละเรื่อง'],
    [5,'ภาพรวมประเทศ: วงตัวเลข = จำนวนเรื่องในพื้นที่ ซูมเข้าเพื่อดูแต่ละเรื่อง'],
    [7, 'ซูมต่อไป ภาพประกอบจะค่อยๆ กลายเป็นแผนที่ปกติ'],
    [10, 'แผนที่ปกติ: เรื่องที่อยู่ใกล้กันรวมเป็นวงตัวเลข'],
    [14, 'ระดับย่าน: ลำแสงยิ่งสูง ยิ่งมีคนเจอเหมือนกันมาก'],
  ])('zoom %d', (zoom, hint) => {
    expect(zoomHint(zoom, 5, 4)).toBe(hint);
  });
});

describe('MAP_BOUNDS', () => {
  it('holds Thailand with at least 1.5 degrees to spare on every side', () => {
    const [w, s, e, n] = THAILAND_BOUNDS;
    const [W, S, E, N] = MAP_BOUNDS;
    expect([w - W, s - S, E - e, N - n].every((d) => d >= 1.5)).toBe(true);
  });

  it('pulls a centre over another country back to the edge and leaves Thailand alone', () => {
    expect(clampCenter([90, 28])).toEqual([95.5, 22.5]);
    expect(clampCenter([100.5, 13.75])).toEqual([100.5, 13.75]);
  });
});
