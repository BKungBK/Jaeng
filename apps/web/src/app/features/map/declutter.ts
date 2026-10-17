export type Rect = { left: number; top: number; right: number; bottom: number };

const overlaps = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Which labels to show: in order, a label stays visible when it touches no obstacle and no
 *  label already kept. Zero-size rects (off screen or hidden) are never shown. */
export function declutter(labels: readonly Rect[], obstacles: readonly Rect[]): boolean[] {
  const kept: Rect[] = [];
  return labels.map((l) => {
    const visible = l.right > l.left && !obstacles.some((o) => overlaps(l, o)) && !kept.some((k) => overlaps(l, k));
    if (visible) kept.push(l);
    return visible;
  });
}
