export type Rect = { left: number; top: number; right: number; bottom: number };

const overlaps = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Where to put each label: in order, the first candidate offset that touches no obstacle and
 *  no label already placed, trying below and above before the sides. null = hide it. */
export function placeLabels(labels: readonly Rect[], obstacles: readonly Rect[]): ([number, number] | null)[] {
  const kept: Rect[] = [];
  return labels.map((l) => {
    if (l.right <= l.left) return null;
    const w = l.right - l.left;
    const h = l.bottom - l.top;
    const candidates: [number, number][] = [
      [0, 0],
      [0, h + 14],
      [0, -(h + 14)],
      [0, 2 * h + 18],
      [0, -(2 * h + 18)],
      [w / 2 + 36, 0],
      [-(w / 2 + 36), 0],
    ];
    for (const [dx, dy] of candidates) {
      const moved = { left: l.left + dx, right: l.right + dx, top: l.top + dy, bottom: l.bottom + dy };
      if (!obstacles.some((o) => overlaps(moved, o)) && !kept.some((k) => overlaps(moved, k))) {
        kept.push(moved);
        return [dx, dy];
      }
    }
    return null;
  });
}

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
