import type { LocationMode, LOG_ACTIONS } from '@jaeng/shared/admin';
import type { IconName } from '../map/icons';

export const ADMIN_TABS = ['reports', 'claims', 'flags', 'users', 'log'] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

export const TAB_TH: Record<AdminTab, string> = {
  reports: 'รอตรวจ',
  claims: 'แจ้งว่าแก้แล้ว',
  flags: 'ถูกรายงาน',
  users: 'ผู้ใช้',
  log: 'บันทึก',
};

export const TAB_ICON: Record<AdminTab, IconName> = {
  reports: 'inbox',
  claims: 'wrench',
  flags: 'flag',
  users: 'users',
  log: 'history',
};

export const LOCATION_MODE_TH: Record<LocationMode, string> = {
  keep: 'ใช้ตำแหน่งเดิม',
  exact: 'ตำแหน่งจริง (ไม่เลื่อน)',
  fuzz: 'สุ่มเลื่อนใหม่ไม่เกิน 150 ม.',
  point: 'ปักหมุดเอง',
};

export const LOG_ACTION_TH: Record<(typeof LOG_ACTIONS)[number], string> = {
  approve_report: 'อนุมัติเรื่อง',
  reject_report: 'ปฏิเสธเรื่อง',
  approve_claim: 'ยืนยันว่าแก้แล้ว',
  reject_claim: 'ส่งกลับเป็นยังไม่แก้',
  hide: 'ซ่อน',
  restore: 'คืน',
  auto_hide: 'ซ่อนอัตโนมัติ (รายงานครบ 3 คน)',
  dismiss_flags: 'ยกเลิกรายงาน',
  ban: 'แบนผู้ใช้',
  unban: 'ยกเลิกแบน',
};
