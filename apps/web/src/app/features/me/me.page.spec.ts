import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import type { MyReport } from '@jaeng/shared/report';
import { ApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { MapReturnService } from '../report-new/map-return.service';
import { ReportDraftService } from '../report-new/report-draft.service';
import { MePage } from './me.page';
import { MeService } from './me.service';
import { STATUS_ICON, STATUS_TH } from './reject-reason';

const STATUSES = ['pending_review', 'open', 'fix_claimed', 'resolved', 'rejected', 'hidden'] as const;

function report(over: Partial<MyReport> = {}): MyReport {
  return {
    id: 'r0',
    title: 'หลุมลึกหน้าตลาด',
    category: 'road',
    danger_level: 2,
    status: 'open',
    reject_reason: null,
    place_name: 'ซอยลาดพร้าว 1',
    confirm_count: 3,
    comment_count: 1,
    created_at: '2026-10-13T08:00:00Z',
    thumb_url: null,
    ...over,
  };
}

const sixStatuses = () =>
  STATUSES.map((status, i) =>
    report({
      id: `r${i}`,
      title: `เรื่องที่ ${i}`,
      status,
      reject_reason: status === 'rejected' ? 'duplicate' : null,
      thumb_url: i === 1 ? '/sb/storage/v1/object/public/photos-public/u/p_thumb.webp' : null,
    }),
  );

async function setup(opts: { reports?: MyReport[] | Error; name?: string } = {}) {
  const reports = vi.fn();
  if (opts.reports instanceof Error) reports.mockRejectedValue(opts.reports);
  else reports.mockResolvedValue(opts.reports ?? []);
  const svc = { reports, rename: vi.fn() };
  const profile = signal<{ id: string; display_name: string; role: 'user' }>({ id: 'u1', display_name: opts.name ?? 'พี่ปลา', role: 'user' });
  const order: string[] = [];
  const auth = {
    profile: profile.asReadonly(),
    signedIn: signal(true),
    setDisplayName: vi.fn((n: string) => profile.update((p) => ({ ...p, display_name: n }))),
    signOut: vi.fn(async () => void order.push('signOut')),
  };
  const nav = { navigateRoot: vi.fn().mockResolvedValue(true) };
  const draft = { reset: vi.fn(() => void order.push('reset')) };
  const back = { go: vi.fn().mockResolvedValue(undefined) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: MeService, useValue: svc },
      { provide: AuthService, useValue: auth },
      { provide: NavController, useValue: nav },
      { provide: ReportDraftService, useValue: draft },
      { provide: MapReturnService, useValue: back },
    ],
  });
  const fixture = TestBed.createComponent(MePage);
  const settle = async () => {
    for (let i = 0; i < 8; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  await settle();
  const root = fixture.nativeElement as HTMLElement;
  const button = (text: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(text));
  const input = () => root.querySelector<HTMLInputElement>('input[aria-label="ชื่อที่แสดง"]');
  const type = (value: string) => {
    const el = input()!;
    el.value = value;
    el.dispatchEvent(new Event('input'));
  };
  return { fixture, root, svc, auth, nav, draft, back, order, profile, settle, button, input, type };
}

describe('MePage', () => {
  describe('the list', () => {
    it('shows one row per report, six statuses in six different words and icons', async () => {
      const { root } = await setup({ reports: sixStatuses() });
      const rows = [...root.querySelectorAll('ul.reports > li')];
      expect(rows).toHaveLength(6);
      const words = new Set<string>();
      rows.forEach((row, i) => {
        const status = STATUSES[i];
        const line = row.querySelector('.state')!;
        expect(line.textContent).toContain(STATUS_TH[status]);
        expect(line.querySelector(`app-icon svg.icon-${STATUS_ICON[status]}`)).not.toBeNull();
        words.add(line.textContent!.trim());
        // no status is told by a colour class alone
        expect(line.className).not.toContain(status);
      });
      expect(words.size).toBe(6);
    });

    it('keeps the order the API gave (newest first)', async () => {
      const { root } = await setup({ reports: [report({ id: 'new', title: 'ใหม่สุด' }), report({ id: 'old', title: 'เก่าสุด' })] });
      const titles = [...root.querySelectorAll('ul.reports .title')].map((e) => e.textContent?.trim());
      expect(titles).toEqual(['ใหม่สุด', 'เก่าสุด']);
    });

    it('shows the thumb, or the category icon when there is none', async () => {
      const { root } = await setup({ reports: sixStatuses() });
      const rows = root.querySelectorAll('ul.reports > li');
      expect(rows[1].querySelector('img')?.getAttribute('src')).toContain('_thumb.webp');
      expect(rows[0].querySelector('img')).toBeNull();
      expect(rows[0].querySelector('.thumb app-icon svg.icon-construction')).not.toBeNull();
    });

    it('shows level as shape and word, place and age', async () => {
      const { root } = await setup({ reports: [report()] });
      const row = root.querySelector('ul.reports > li')!;
      expect(row.querySelector('app-level-shape svg')?.getAttribute('data-level')).toBe('2');
      expect(row.textContent).toContain('อันตราย');
      expect(row.textContent).toContain('ซอยลาดพร้าว 1');
      expect(row.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-13T08:00:00Z');
    });

    it('says why a rejected report did not pass, in Thai for a known key', async () => {
      const { root } = await setup({ reports: sixStatuses() });
      const rows = root.querySelectorAll('ul.reports > li');
      expect(rows[4].querySelector('.reason')?.textContent?.trim()).toBe('ไม่ผ่านเพราะ: ซ้ำกับเรื่องที่มีอยู่แล้ว');
      expect(root.querySelectorAll('.reason')).toHaveLength(1);
    });

    it('shows free text reasons as written and a line for a missing one', async () => {
      const { root } = await setup({
        reports: [
          report({ id: 'a', status: 'rejected', reject_reason: '<b>พิกัดไม่ชัด</b>' }),
          report({ id: 'b', status: 'rejected', reject_reason: null }),
        ],
      });
      const reasons = [...root.querySelectorAll('.reason')].map((e) => e.textContent?.trim());
      expect(reasons).toEqual(['ไม่ผ่านเพราะ: <b>พิกัดไม่ชัด</b>', 'ไม่ผ่านเพราะ: ผู้ดูแลไม่ได้ระบุเหตุผล']);
      expect(root.querySelector('.reason b')).toBeNull();
    });

    it('links public reports to /r/:id and leaves the others plain', async () => {
      const { root } = await setup({ reports: sixStatuses() });
      const rows = root.querySelectorAll('ul.reports > li');
      const isLink = [...rows].map((r) => r.querySelector('a')?.getAttribute('href') ?? null);
      expect(isLink).toEqual([null, '/r/r1', '/r/r2', '/r/r3', null, null]);
    });

    it('shows how long it took to count the list', async () => {
      const { root } = await setup({ reports: sixStatuses() });
      expect(root.querySelector('h2')?.textContent).toContain('6');
    });

    it('shows 100 rows without paging', async () => {
      const many = Array.from({ length: 100 }, (_, i) => report({ id: `m${i}`, title: `เรื่อง ${i}` }));
      const { root } = await setup({ reports: many });
      expect(root.querySelectorAll('ul.reports > li')).toHaveLength(100);
    });
  });

  describe('empty and failing', () => {
    it('invites the first report when there is none', async () => {
      const { root, fixture, button } = await setup({ reports: [] });
      expect(root.textContent).toContain('ยังไม่มีเรื่องที่แจ้ง กดปุ่ม แจ้ง ได้เลยนะ');
      expect(root.querySelector('ul.reports')).toBeNull();
      const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      button('แจ้ง')!.click();
      expect(nav).toHaveBeenCalledWith(['/report']);
      fixture.destroy();
    });

    it('offers a retry that asks again', async () => {
      const { root, svc, button, settle } = await setup({ reports: new ApiError(0, 'network', 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้งนะ') });
      expect(root.querySelector('[role="status"]')?.textContent).toContain('โหลดเรื่องของคุณไม่สำเร็จ');
      expect(svc.reports).toHaveBeenCalledTimes(1);
      svc.reports.mockResolvedValue([report({ title: 'กลับมาแล้ว' })]);
      button('ลองอีกครั้ง')!.click();
      await settle();
      expect(svc.reports).toHaveBeenCalledTimes(2);
      expect(root.textContent).toContain('กลับมาแล้ว');
      expect(button('ลองอีกครั้ง')).toBeUndefined();
    });
  });

  describe('signing out', () => {
    it('drops the unsent draft, signs out, then goes to the map', async () => {
      const { button, auth, draft, nav, order, settle } = await setup();
      button('ออกจากระบบ')!.click();
      await settle();
      expect(draft.reset).toHaveBeenCalledTimes(1);
      expect(auth.signOut).toHaveBeenCalledTimes(1);
      expect(order).toEqual(['reset', 'signOut']);
      expect(nav.navigateRoot).toHaveBeenCalledWith('/');
    });
  });

  describe('display name', () => {
    it('shows the name and an edit button', async () => {
      const { root, button } = await setup({ name: 'พี่ปลา' });
      expect(root.textContent).toContain('พี่ปลา');
      expect(button('แก้ชื่อ')).toBeDefined();
      expect(root.querySelector('input')).toBeNull();
    });

    it('opens a field holding the current name, limited to 30', async () => {
      const { button, input, settle } = await setup({ name: 'พี่ปลา' });
      button('แก้ชื่อ')!.click();
      await settle();
      expect(input()?.value).toBe('พี่ปลา');
      expect(input()?.getAttribute('maxlength')).toBe('30');
    });

    it('keeps save disabled while the trimmed name is under 2 or over 30, or unchanged', async () => {
      const { button, type, settle } = await setup({ name: 'พี่ปลา' });
      button('แก้ชื่อ')!.click();
      await settle();
      const save = () => button('บันทึก')!;
      expect(save().disabled).toBe(true); // unchanged
      type('ก');
      await settle();
      expect(save().disabled).toBe(true);
      type('   ก   ');
      await settle();
      expect(save().disabled).toBe(true);
      type('ก'.repeat(31));
      await settle();
      expect(save().disabled).toBe(true);
      type('กข');
      await settle();
      expect(save().disabled).toBe(false);
    });

    it('keeps save disabled for invisible or control characters, and counts code points', async () => {
      const { button, type, settle, root } = await setup({ name: 'พี่ปลา' });
      button('แก้ชื่อ')!.click();
      await settle();
      const save = () => button('บันทึก')!;
      type('​​');
      await settle();
      expect(save().disabled).toBe(true);
      type('สม\u0007ชาย'); // an <input> drops newlines itself; other control characters get through
      await settle();
      expect(save().disabled).toBe(true);
      const face = String.fromCodePoint(0x1f600);
      type(face.repeat(2));
      await settle();
      expect(save().disabled).toBe(false); // 2 code points, 4 UTF-16 units
      expect(root.textContent).toContain('2/30');
      type(face.repeat(30));
      await settle();
      expect(save().disabled).toBe(false);
      type(face.repeat(31));
      await settle();
      expect(save().disabled).toBe(true);
    });

    it('saves a valid new name, trimmed, and updates the profile', async () => {
      const { button, type, settle, svc, auth, profile, root } = await setup({ name: 'พี่ปลา' });
      svc.rename.mockResolvedValue('น้องบี');
      button('แก้ชื่อ')!.click();
      await settle();
      type('  น้องบี ');
      await settle();
      button('บันทึก')!.click();
      await settle();
      expect(svc.rename).toHaveBeenCalledWith('น้องบี');
      expect(auth.setDisplayName).toHaveBeenCalledWith('น้องบี');
      expect(profile().display_name).toBe('น้องบี');
      expect(root.querySelector('input')).toBeNull();
      expect(root.textContent).toContain('น้องบี');
    });

    it('shows the API message in an alert and keeps the old name on 422', async () => {
      const { button, type, settle, svc, auth, profile, root, input } = await setup({ name: 'พี่ปลา' });
      svc.rename.mockRejectedValue(new ApiError(422, 'profanity', 'ชื่อนี้ใช้ไม่ได้ ลองชื่ออื่นนะ'));
      button('แก้ชื่อ')!.click();
      await settle();
      type('ชื่อไม่ดี');
      await settle();
      button('บันทึก')!.click();
      await settle();
      expect(root.querySelector('[role="alert"]')?.textContent).toContain('ชื่อนี้ใช้ไม่ได้ ลองชื่ออื่นนะ');
      expect(auth.setDisplayName).not.toHaveBeenCalled();
      expect(profile().display_name).toBe('พี่ปลา');
      expect(input()).not.toBeNull(); // still editing
    });

    it('cancels without saving', async () => {
      const { button, settle, svc, root } = await setup({ name: 'พี่ปลา' });
      button('แก้ชื่อ')!.click();
      await settle();
      button('ยกเลิก')!.click();
      await settle();
      expect(svc.rename).not.toHaveBeenCalled();
      expect(root.querySelector('input')).toBeNull();
    });
  });
});
