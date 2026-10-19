import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { LogEntry } from '@jaeng/shared/admin';
import { AdminService } from './admin.service';
import { LogTabComponent } from './log-tab.component';

const entry = (id: number, over: Partial<LogEntry> = {}): LogEntry => ({
  id,
  created_at: '2026-10-19T08:00:00Z',
  action: 'approve_report',
  target_type: 'report',
  target_id: 'r1',
  detail: {},
  admin_name: 'ผู้ดูแลแจ้ง',
  target_name: null,
  ...over,
});

async function setup(pages: LogEntry[][]) {
  const log = vi.fn();
  for (const p of pages) log.mockResolvedValueOnce(p);
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AdminService, useValue: { log } }] });
  const fixture = TestBed.createComponent(LogTabComponent);
  const settle = async () => {
    for (let i = 0; i < 8; i++) {
      fixture.detectChanges();
      await Promise.resolve();
    }
  };
  await settle();
  const root = fixture.nativeElement as HTMLElement;
  return { root, log, settle, rows: () => [...root.querySelectorAll('.entry')] };
}

describe('LogTabComponent', () => {
  it('says each action in Thai, the system for a null admin, unknown actions as stored', async () => {
    const { rows } = await setup([[entry(3), entry(2, { action: 'auto_hide', admin_name: null }), entry(1, { action: 'mystery' })]]);
    expect(rows()[0].textContent).toContain('อนุมัติเรื่อง');
    expect(rows()[0].textContent).toContain('ผู้ดูแลแจ้ง');
    expect(rows()[1].textContent).toContain('ระบบ');
    expect(rows()[2].textContent).toContain('mystery');
  });

  it('names who or what the action was about', async () => {
    const { rows } = await setup([[entry(2, { action: 'ban', target_type: 'user', target_id: 'u1', target_name: 'สมชาย' })]]);
    expect(rows()[0].textContent).toContain('สมชาย');
  });

  it('links a report target to its page', async () => {
    const { rows } = await setup([[entry(3)]]);
    expect(rows()[0].querySelector('a')?.getAttribute('href')).toBe('/r/r1');
  });

  it('loads older entries after the last id and appends them; hides the button on a short page', async () => {
    const full = Array.from({ length: 50 }, (_, i) => entry(100 - i));
    const { root, log, settle, rows } = await setup([full, [entry(40)]]);
    expect(log).toHaveBeenCalledWith(null);
    root.querySelector<HTMLButtonElement>('button.more')!.click();
    await settle();
    expect(log).toHaveBeenLastCalledWith(51);
    expect(rows().length).toBe(51);
    expect(root.querySelector('button.more')).toBeNull();
  });

  it('no more button when the first page is short', async () => {
    const { root } = await setup([[entry(1)]]);
    expect(root.querySelector('button.more')).toBeNull();
  });

  it('shows known detail keys as text', async () => {
    const { rows } = await setup([[entry(1, { action: 'reject_report', detail: { reason: 'other', note: '<i>x</i>' } })]]);
    expect(rows()[0].querySelector('i')).toBeNull();
    expect(rows()[0].textContent).toContain('<i>x</i>');
  });
});
