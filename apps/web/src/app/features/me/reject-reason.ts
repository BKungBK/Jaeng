import type { MyReport, REJECT_REASONS } from '@jaeng/shared/report';
import type { IconName } from '../map/icons';

type Status = MyReport['status'];

export const REJECT_REASON_TH: Record<(typeof REJECT_REASONS)[number], string> = {
  duplicate: 'ซ้ำกับเรื่องที่มีอยู่แล้ว',
  not_public: 'ไม่ใช่ปัญหาสาธารณะ',
  inappropriate: 'เนื้อหาไม่เหมาะสม',
  insufficient: 'ข้อมูลไม่พอ',
  other: 'อื่นๆ',
};

export const MSG_NO_REASON = 'ผู้ดูแลไม่ได้ระบุเหตุผล';

/** A known key becomes its Thai label, the admin's own words stay as written, nothing becomes a sentence. */
export function rejectReasonText(reason: string | null): string {
  if (!reason) return MSG_NO_REASON;
  return Object.hasOwn(REJECT_REASON_TH, reason) ? REJECT_REASON_TH[reason as keyof typeof REJECT_REASON_TH] : reason;
}

/** Six statuses, six different words: a status is never told by colour alone. */
export const STATUS_TH: Record<Status, string> = {
  pending_review: 'รอผู้ดูแลตรวจ',
  open: 'เปิดอยู่',
  fix_claimed: 'รอตรวจว่าแก้แล้ว',
  resolved: 'แก้แล้ว',
  rejected: 'ไม่ผ่านการตรวจ',
  hidden: 'ถูกซ่อน',
};

/** ...and six different Lucide shapes beside the words. */
export const STATUS_ICON: Record<Status, IconName> = {
  pending_review: 'clock',
  open: 'eye',
  fix_claimed: 'wrench',
  resolved: 'circleCheck',
  rejected: 'circleX',
  hidden: 'eyeOff',
};

/** Only these are on the public map, so only these have a page to open. */
export const PUBLIC_STATUS: readonly Status[] = ['open', 'fix_claimed', 'resolved'];
