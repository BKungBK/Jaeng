import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PopoverController } from '@ionic/angular';
import { AuthService, Profile } from '../../core/auth.service';
import { ReportMenuComponent } from './report-menu.component';

function menu(profile: Profile | null) {
  const popovers = { dismiss: vi.fn().mockResolvedValue(true) };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { profile: signal(profile) } },
      { provide: PopoverController, useValue: popovers },
    ],
  });
  const fixture = TestBed.createComponent(ReportMenuComponent);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const rows = () => [...root.querySelectorAll<HTMLButtonElement>('button')];
  return { popovers, rows, labels: () => rows().map((b) => b.textContent?.trim()) };
}

describe('ReportMenuComponent', () => {
  it('a member sees copy link and report, not hide', () => {
    const { labels } = menu({ id: 'u', display_name: 'a', role: 'user', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' });
    expect(labels()).toEqual(['คัดลอกลิงก์', 'รายงานเนื้อหาไม่เหมาะสม']);
  });

  it('an admin also sees hide', () => {
    const { labels } = menu({ id: 'a', display_name: 'a', role: 'admin', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' });
    expect(labels()).toEqual(['คัดลอกลิงก์', 'รายงานเนื้อหาไม่เหมาะสม', 'ซ่อนเรื่องนี้']);
  });

  it('dismisses with the chosen role; rows are 44 px buttons with words', () => {
    const { rows, popovers } = menu({ id: 'a', display_name: 'a', role: 'admin', locale: 'th', avatar_path: null, onboarded_at: '2026-10-01T00:00:00Z' });
    rows()[0].click();
    rows()[1].click();
    rows()[2].click();
    expect(popovers.dismiss.mock.calls.map((c) => c[1])).toEqual(['copy', 'flag', 'hide']);
    expect(rows().every((b) => b.classList.contains('report-menu-item'))).toBe(true);
  });
});
