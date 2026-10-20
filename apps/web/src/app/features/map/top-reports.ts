import type { ReportProps } from './report';

const unresolved = (p: ReportProps) => (p.status === 'resolved' ? 0 : 1);

/** The reports the desktop side panel lists first (plan 6b decision 7): still unresolved, then the
 *  higher level, then more "me too", then the longer wait. From the loaded view, so no extra request. */
export function topReports(items: readonly ReportProps[], n: number): ReportProps[] {
  return [...items]
    .sort(
      (a, b) =>
        unresolved(b) - unresolved(a) ||
        b.danger_level - a.danger_level ||
        b.confirm_count - a.confirm_count ||
        b.days_open - a.days_open,
    )
    .slice(0, n);
}
