import type { FlagReason } from '@jaeng/shared/admin';

/** Words for the content-report reasons (members choose them, admins read them). */
export const FLAG_REASON_TH: Record<FlagReason, string> = {
  spam: 'สแปมหรือโฆษณา',
  false: 'ข้อมูลไม่จริง',
  personal_attack: 'ว่าร้ายหรือโจมตีบุคคล',
  privacy: 'เปิดเผยข้อมูลส่วนตัว',
  other: 'อื่นๆ',
};
