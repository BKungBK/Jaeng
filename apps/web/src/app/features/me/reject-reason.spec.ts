import { TestBed } from '@angular/core/testing';
import { REJECT_REASONS } from '@jaeng/shared/report';
import { I18nService } from '../../core/i18n.service';
import type { MessageKey } from '../../i18n/keys';
import { rejectReasonText, STATUS_ICON, statusKey } from './reject-reason';

const STATUSES = ['pending_review', 'open', 'fix_claimed', 'resolved', 'rejected', 'hidden'] as const;
const i18n = () => TestBed.inject(I18nService);
const t = (k: MessageKey) => i18n().t(k);

describe('rejectReasonText', () => {
  it('turns a known key into its words', () => {
    expect(rejectReasonText('duplicate', t)).toBe('ซ้ำกับเรื่องที่มีอยู่แล้ว');
    expect(rejectReasonText('not_public', t)).toBe('ไม่ใช่ปัญหาสาธารณะ');
    expect(rejectReasonText('inappropriate', t)).toBe('เนื้อหาไม่เหมาะสม');
    expect(rejectReasonText('insufficient', t)).toBe('ข้อมูลไม่พอ');
    expect(rejectReasonText('other', t)).toBe('อื่นๆ');
    i18n().setLocale('en');
    expect(rejectReasonText('duplicate', t)).toBe('Already reported');
  });

  it("keeps the admin's free text as it is", () => {
    expect(rejectReasonText('พิกัดไม่ชัด', t)).toBe('พิกัดไม่ชัด');
  });

  it('says so when the admin gave no reason', () => {
    expect(rejectReasonText(null, t)).toBe('ผู้ดูแลไม่ได้ระบุเหตุผล');
    expect(rejectReasonText('', t)).toBe('ผู้ดูแลไม่ได้ระบุเหตุผล');
  });

  it('does not treat Object.prototype names as keys', () => {
    expect(rejectReasonText('toString', t)).toBe('toString');
  });

  it('words every reason the API knows', () => {
    for (const r of REJECT_REASONS) expect(rejectReasonText(r, t)).not.toBe(r);
  });
});

describe('status words', () => {
  it('has a word for all six statuses', () => {
    const words = STATUSES.map((s) => t(statusKey(s)));
    expect(words).toEqual(['รอผู้ดูแลตรวจ', 'เปิดอยู่', 'รอตรวจว่าแก้แล้ว', 'แก้แล้ว', 'ไม่ผ่านการตรวจ', 'ถูกซ่อน']);
  });

  it('never repeats a word in either language, so every status reads without colour', () => {
    expect(new Set(STATUSES.map((s) => t(statusKey(s)))).size).toBe(STATUSES.length);
    i18n().setLocale('en');
    expect(new Set(STATUSES.map((s) => t(statusKey(s)))).size).toBe(STATUSES.length);
  });

  it('gives every status its own icon too', () => {
    expect(new Set(Object.values(STATUS_ICON)).size).toBe(STATUSES.length);
  });
});
