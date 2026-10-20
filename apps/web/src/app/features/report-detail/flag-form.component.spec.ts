import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../core/api.service';
import { FlagFormComponent } from './flag-form.component';
import { ReportDetailService } from './report-detail.service';

async function setup(target: { type: 'report' | 'comment'; id: string }, flag = vi.fn().mockResolvedValue({ flag_id: 'f1', hidden: true })) {
  TestBed.configureTestingModule({ providers: [{ provide: ReportDetailService, useValue: { flag } }] });
  const fixture = TestBed.createComponent(FlagFormComponent);
  fixture.componentRef.setInput('target', target);
  const out = { done: vi.fn(), cancel: vi.fn() };
  fixture.componentInstance.done.subscribe(out.done);
  fixture.componentInstance.cancel.subscribe(out.cancel);
  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      fixture.detectChanges();
      await Promise.resolve();
    }
  };
  await settle();
  const root = fixture.nativeElement as HTMLElement;
  const submit = () => root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const choose = async (word: string) => {
    [...root.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((b) => b.textContent?.includes(word))!.click();
    await settle();
  };
  return { root, out, flag, settle, submit, choose };
}

describe('FlagFormComponent', () => {
  it('cannot be sent before a reason is chosen', async () => {
    const { submit, root } = await setup({ type: 'report', id: 'r1' });
    expect(submit().disabled).toBe(true);
    expect(root.querySelectorAll('[role="radio"]').length).toBe(5);
    expect(root.querySelector('h3')?.textContent).toContain('รายงานเรื่องนี้');
  });

  it('sends the reason and note for a comment, then thanks without saying it was hidden', async () => {
    const { submit, choose, settle, flag, out, root } = await setup({ type: 'comment', id: 'c1' });
    expect(root.querySelector('h3')?.textContent).toContain('รายงานความคิดเห็นนี้');
    await choose('สแปมหรือโฆษณา');
    expect(root.querySelector('[aria-checked="true"]')?.textContent).toContain('สแปม');
    const ta = root.querySelector('textarea')!;
    ta.value = ' ขายของ ';
    ta.dispatchEvent(new Event('input'));
    await settle();
    submit().click();
    await settle();
    expect(flag).toHaveBeenCalledWith({ target_type: 'comment', target_id: 'c1', reason: 'spam', note: 'ขายของ' });
    expect(out.done).toHaveBeenCalledTimes(1);
    expect(root.textContent).not.toContain('ซ่อน');
  });

  it('shows the API message on error', async () => {
    const err = new ApiError(429, 'rate_limited', 'วันนี้ทำรายการนี้ครบโควตาแล้ว พรุ่งนี้ลองใหม่นะ', 'en');
    const { submit, choose, settle, root, out } = await setup({ type: 'report', id: 'r1' }, vi.fn().mockRejectedValue(err));
    await choose('อื่นๆ');
    submit().click();
    await settle();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('ครบโควตา');
    expect(out.done).not.toHaveBeenCalled();
  });
});
