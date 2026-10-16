// Beam height in px for a report's "เจอเหมือนกัน" count (spec 3.3).
// Log curve so the first few confirmations visibly raise the beam; capped at 260.
export function beamHeight(confirmCount: number): number {
  const n = Math.max(0, confirmCount);
  return Math.round(Math.min(260, 60 + 36 * Math.log2(1 + n)));
}
