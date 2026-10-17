// Zoom rules for the toy map (spec 3.2, 4.4).

/** Toy layers are fully shown up to zoom 6 and gone at zoom 8. */
export const TOY_FADE = ['interpolate', ['linear'], ['zoom'], 6, 1, 8, 0] as const;

/** Clusters stop forming above this zoom. */
export const CLUSTER_MAX_ZOOM = 11;

/** From this zoom each report gets its full beam and label. */
export const BEAM_ZOOM = 12;

export function toyOpacity(zoom: number): number {
  return Math.max(0, Math.min(1, (8 - zoom) / 2));
}

/** The status line in the corner card: what the visitor is looking at and what to do next. */
export function zoomHint(zoom: number, shown: number, levelsOn: number): string {
  if (levelsOn === 0) return 'ปิดตัวกรองครบทุกระดับแล้ว แตะชิปด้านบนเพื่อดูเรื่องอีกครั้ง';
  if (shown === 0) return 'ยังไม่มีเรื่องตรงกับตัวกรองในบริเวณนี้';
  if (zoom < 6) return 'ภาพรวมประเทศ: วงตัวเลข = จำนวนเรื่องในพื้นที่ ซูมเข้าเพื่อดูแต่ละเรื่อง';
  if (zoom < 8) return 'ซูมต่อไป ภาพประกอบจะค่อยๆ กลายเป็นแผนที่ปกติ';
  if (zoom < BEAM_ZOOM) return 'แผนที่ปกติ: เรื่องที่อยู่ใกล้กันรวมเป็นวงตัวเลข';
  return 'ระดับย่าน: ลำแสงยิ่งสูง ยิ่งมีคนเจอเหมือนกันมาก';
}
