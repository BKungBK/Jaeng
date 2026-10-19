import { REJECT_REASONS } from '@jaeng/shared/report';
import { REJECT_REASON_TH, rejectReasonText, STATUS_ICON, STATUS_TH } from './reject-reason';

const STATUSES = ['pending_review', 'open', 'fix_claimed', 'resolved', 'rejected', 'hidden'] as const;

describe('rejectReasonText', () => {
  it('turns a known key into its Thai label', () => {
    expect(rejectReasonText('duplicate')).toBe('ซ้ำกับเรื่องที่มีอยู่แล้ว');
    expect(rejectReasonText('not_public')).toBe('ไม่ใช่ปัญหาสาธารณะ');
    expect(rejectReasonText('inappropriate')).toBe('เนื้อหาไม่เหมาะสม');
    expect(rejectReasonText('insufficient')).toBe('ข้อมูลไม่พอ');
    expect(rejectReasonText('other')).toBe('อื่นๆ');
  });

  it('keeps free text as it is', () => {
    expect(rejectReasonText('พิกัดไม่ชัด')).toBe('พิกัดไม่ชัด');
  });

  it('says so when the admin gave no reason', () => {
    expect(rejectReasonText(null)).toBe('ผู้ดูแลไม่ได้ระบุเหตุผล');
    expect(rejectReasonText('')).toBe('ผู้ดูแลไม่ได้ระบุเหตุผล');
  });

  it('does not treat Object.prototype names as keys', () => {
    expect(rejectReasonText('toString')).toBe('toString');
  });

  it('covers every reason the API knows', () => {
    expect(Object.keys(REJECT_REASON_TH).sort()).toEqual([...REJECT_REASONS].sort());
  });
});

describe('STATUS_TH', () => {
  it('has a word for all six statuses', () => {
    expect(Object.keys(STATUS_TH).sort()).toEqual([...STATUSES].sort());
    expect(STATUS_TH.pending_review).toBe('รอผู้ดูแลตรวจ');
    expect(STATUS_TH.open).toBe('เปิดอยู่');
    expect(STATUS_TH.fix_claimed).toBe('รอตรวจว่าแก้แล้ว');
    expect(STATUS_TH.resolved).toBe('แก้แล้ว');
    expect(STATUS_TH.rejected).toBe('ไม่ผ่านการตรวจ');
    expect(STATUS_TH.hidden).toBe('ถูกซ่อน');
  });

  it('never repeats a word, so every status reads without colour', () => {
    expect(new Set(Object.values(STATUS_TH)).size).toBe(STATUSES.length);
  });

  it('gives every status its own icon too', () => {
    expect(new Set(Object.values(STATUS_ICON)).size).toBe(STATUSES.length);
  });
});
