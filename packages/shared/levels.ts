// Danger levels and report statuses (spec 3.3, 5.1). Keep in sync with the database checks.

export type DangerLevel = 0 | 1 | 2 | 3;

export type LevelInfo = {
  level: DangerLevel;
  nameTh: string;
  nameEn: string;
  color: string;
  symbol: string;
  pulse: string;
  rings: 1 | 2;
};

export const LEVELS: readonly LevelInfo[] = [
  { level: 0, nameTh: 'ทั่วไป', nameEn: 'Minor', color: '#8FD3B6', symbol: '●', pulse: '3s', rings: 1 },
  { level: 1, nameTh: 'ควรระวัง', nameEn: 'Caution', color: '#F6D983', symbol: '▲', pulse: '2.4s', rings: 1 },
  { level: 2, nameTh: 'อันตราย', nameEn: 'Danger', color: '#F4A582', symbol: '◆', pulse: '1.6s', rings: 2 },
  { level: 3, nameTh: 'วิกฤต', nameEn: 'Critical', color: '#E57373', symbol: '⚠', pulse: '1s', rings: 2 },
];

export const REPORT_STATUSES = ['pending_review', 'open', 'fix_claimed', 'resolved', 'rejected', 'hidden'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
