// Zoom rules for the toy map (spec 3.2, 4.4).

/** Toy layers are fully shown up to zoom 6 and gone at zoom 8. */
export const TOY_FADE = ['interpolate', ['linear'], ['zoom'], 6, 1, 8, 0] as const;

/** Clusters stop forming above this zoom. */
export const CLUSTER_MAX_ZOOM = 11;

/** From this zoom each report gets its full beam and label. */
export const BEAM_ZOOM = 12;

/** Landmark sticker diameter in CSS px at each zoom stop (size 1); linear between, clamped outside. */
export const LANDMARK_PX: readonly (readonly [number, number])[] = [
  [4, 28],
  [6, 36],
  [8, 44],
];

/** The sticker images are drawn at this many CSS px; icon-size scales from it. */
export const STICKER_PX = 96;

export function landmarkPx(zoom: number): number {
  const stops = LANDMARK_PX;
  if (zoom <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [z1, p1] = stops[i];
    const [z0, p0] = stops[i - 1];
    if (zoom <= z1) return p0 + ((zoom - z0) / (z1 - z0)) * (p1 - p0);
  }
  return stops[stops.length - 1][1];
}

export function toyOpacity(zoom: number): number {
  return Math.max(0, Math.min(1, (8 - zoom) / 2));
}

/** Toy province names leave first (zoom 6–7), so they never double with the street map's names. */
export function toyLabelOpacity(zoom: number): number {
  return Math.max(0, Math.min(1, 7 - zoom));
}

/** The status line in the corner card: what the visitor is looking at and what to do next. */
export function zoomHint(zoom: number, shown: number, levelsOn: number): string {
  if (levelsOn === 0) return 'ปิดตัวกรองครบทุกระดับแล้ว แตะชิปด้านบนเพื่อดูเรื่องอีกครั้ง';
  if (shown === 0) return 'ยังไม่มีเรื่องตรงกับตัวกรองในบริเวณนี้';
  if (zoom < 4) return 'มุมมองโลก: ซูมเข้าหาประเทศไทยเพื่อดูสัญญาณไฟ';
  if (zoom < 6) return 'ภาพรวมประเทศ: วงตัวเลข = จำนวนเรื่องในพื้นที่ ซูมเข้าเพื่อดูแต่ละเรื่อง';
  if (zoom < 8) return 'ซูมต่อไป ภาพประกอบจะค่อยๆ กลายเป็นแผนที่ปกติ';
  if (zoom < BEAM_ZOOM) return 'แผนที่ปกติ: เรื่องที่อยู่ใกล้กันรวมเป็นวงตัวเลข';
  return 'ระดับย่าน: ลำแสงยิ่งสูง ยิ่งมีคนเจอเหมือนกันมาก';
}
