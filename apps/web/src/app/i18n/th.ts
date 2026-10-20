// Thai is the source dictionary (spec 3.12): every key lives here first, and `en.ts` must match its shape.
// Placeholders are `{name}`; user-written content is never translated.
import { MSG_INTERNAL_TH } from '@jaeng/shared/api';

export const th = {
  app: {
    title: 'แจ้ง',
  },
  common: {
    close: 'ปิด',
    back: 'กลับ',
    cancel: 'ยกเลิก',
    retry: 'ลองใหม่',
    reportCount: '{n} เรื่อง',
  },
  errors: {
    internal: MSG_INTERNAL_TH,
    network: 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้งนะ',
    unauthorized: 'เข้าสู่ระบบก่อนนะ',
    photoTooLarge: 'รูปใหญ่เกินไป (ไม่เกิน 3 MB)',
    draftCleared: 'ร่างถูกล้างเพราะเปลี่ยนผู้ใช้ เริ่มใหม่ได้เลยนะ',
  },
  time: {
    justNow: 'เมื่อสักครู่',
  },
} as const;
