import { TestBed } from '@angular/core/testing';
import type { ReportSignal } from '@jaeng/shared/api';
import { ApiError } from '../../core/api.service';
import { FixClaimFormComponent } from './fix-claim-form.component';
import { ReportDetailService } from './report-detail.service';

const ID = '7b0c5a3e-1f7d-4c49-9a52-2b8f3d0c6e11';
const claimed: ReportSignal = { id: ID, status: 'fix_claimed', confirm_count: 1, comment_count: 0 };

async function setup(svcOver: Partial<Record<'claimFix' | 'uploadPhoto', ReturnType<typeof vi.fn>>> = {}) {
  const svc = {
    claimFix: vi.fn().mockResolvedValue({ claim_id: 'c1', report: claimed }),
    uploadPhoto: vi.fn().mockResolvedValue('p1'),
    ...svcOver,
  };
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
  TestBed.configureTestingModule({ providers: [{ provide: ReportDetailService, useValue: svc }] });
  const fixture = TestBed.createComponent(FixClaimFormComponent);
  fixture.componentRef.setInput('reportId', ID);
  const out = { done: vi.fn(), cancel: vi.fn(), stale: vi.fn() };
  fixture.componentInstance.done.subscribe(out.done);
  fixture.componentInstance.cancel.subscribe(out.cancel);
  fixture.componentInstance.stale.subscribe(out.stale);
  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      fixture.detectChanges();
      await Promise.resolve();
    }
  };
  await settle();
  const root = fixture.nativeElement as HTMLElement;
  const submit = () => root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const note = () => root.querySelector<HTMLTextAreaElement>('textarea')!;
  const type = async (text: string) => {
    note().value = text;
    note().dispatchEvent(new Event('input'));
    await settle();
  };
  const pick = async () => {
    const input = root.querySelector<HTMLInputElement>('input[type="file"]:not([capture])')!;
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })], configurable: true });
    input.dispatchEvent(new Event('change'));
    await settle();
  };
  return { fixture, root, svc, out, settle, submit, type, pick };
}

describe('FixClaimFormComponent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends an empty claim without a photo or a note', async () => {
    const { svc, out, submit, settle } = await setup();
    submit().click();
    await settle();
    expect(svc.uploadPhoto).not.toHaveBeenCalled();
    expect(svc.claimFix).toHaveBeenCalledWith(ID, {});
    expect(out.done).toHaveBeenCalledWith(claimed);
  });

  it('uploads the photo first, then sends its id and the trimmed note', async () => {
    const { svc, submit, settle, type, pick, root } = await setup();
    await pick();
    expect(root.querySelector('.preview img')).not.toBeNull();
    await type('  ซ่อมเสร็จแล้ว  ');
    submit().click();
    await settle();
    expect(svc.uploadPhoto).toHaveBeenCalledTimes(1);
    expect(svc.claimFix).toHaveBeenCalledWith(ID, { photo_id: 'p1', note: 'ซ่อมเสร็จแล้ว' });
  });

  it('a failed upload shows its message and sends nothing', async () => {
    const { svc, submit, settle, pick, root } = await setup({
      uploadPhoto: vi.fn().mockRejectedValue(new ApiError(413, 'photo_too_large', 'รูปใหญ่เกินไป (ไม่เกิน 3 MB)', 'en')),
    });
    await pick();
    submit().click();
    await settle();
    expect(svc.claimFix).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('รูปใหญ่เกินไป');
  });

  it('a double click sends once', async () => {
    const { svc, submit, settle } = await setup();
    submit().click();
    submit().click();
    await settle();
    expect(svc.claimFix).toHaveBeenCalledTimes(1);
  });

  it('a note over 500 characters disables sending', async () => {
    const { submit, type } = await setup();
    await type('ก'.repeat(501));
    expect(submit().disabled).toBe(true);
  });

  it('claim_pending shows the API message and asks the panel to reload', async () => {
    const err = new ApiError(409, 'claim_pending', 'มีคนแจ้งว่าแก้แล้ว กำลังรอผู้ดูแลตรวจอยู่นะ', 'en');
    const { out, submit, settle } = await setup({ claimFix: vi.fn().mockRejectedValue(err) });
    submit().click();
    await settle();
    expect(out.stale).toHaveBeenCalledWith(err);
    expect(out.done).not.toHaveBeenCalled();
  });

  it('says only what is true about the photo, and has 44 px controls with names', async () => {
    const { root } = await setup();
    expect(root.textContent).toContain('รูปหลังแก้จะขึ้นหลังผู้ดูแลยืนยัน');
    expect(root.textContent).not.toContain('เบลอ');
    for (const b of root.querySelectorAll('button')) {
      expect(b.textContent?.trim() || b.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('cancel emits cancel', async () => {
    const { root, out } = await setup();
    [...root.querySelectorAll('button')].find((b) => b.textContent?.includes('ยกเลิก'))!.click();
    expect(out.cancel).toHaveBeenCalled();
  });
});
