import { toyLabelOpacity, toyOpacity, zoomHint } from './toy';
import { PROVINCE_LABELS } from './toy-places';

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

describe('toyLabelOpacity', () => {
  it('hands names over to the street map by zoom 7', () => {
    expect(toyLabelOpacity(6)).toBe(1);
    expect(toyLabelOpacity(6.5)).toBeCloseTo(0.5);
    expect(toyLabelOpacity(7)).toBe(0);
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
    [3, 'มุมมองโลก: ซูมเข้าหาประเทศไทยเพื่อดูสัญญาณไฟ'],
    [5, 'ภาพรวมประเทศ: วงตัวเลข = จำนวนเรื่องในพื้นที่ ซูมเข้าเพื่อดูแต่ละเรื่อง'],
    [7, 'ซูมต่อไป ภาพประกอบจะค่อยๆ กลายเป็นแผนที่ปกติ'],
    [10, 'แผนที่ปกติ: เรื่องที่อยู่ใกล้กันรวมเป็นวงตัวเลข'],
    [14, 'ระดับย่าน: ลำแสงยิ่งสูง ยิ่งมีคนเจอเหมือนกันมาก'],
  ])('zoom %d', (zoom, hint) => {
    expect(zoomHint(zoom, 5, 4)).toBe(hint);
  });
});

describe('PROVINCE_LABELS', () => {
  it('names the 15 provinces of spec 3.2.1', () => {
    expect(PROVINCE_LABELS.map((l) => l.name)).toEqual([
      'เชียงใหม่',
      'พิษณุโลก',
      'นครสวรรค์',
      'ขอนแก่น',
      'นครราชสีมา',
      'อุบลราชธานี',
      'พระนครศรีอยุธยา',
      'กรุงเทพฯ',
      'กาญจนบุรี',
      'ชลบุรี',
      'ระยอง',
      'สุราษฎร์ธานี',
      'ภูเก็ต',
      'สงขลา',
      'ปัตตานี',
    ]);
  });
});
