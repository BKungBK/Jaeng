import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PublicComment, ReportSignal } from '@jaeng/shared/api';
import { ApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { RealtimeService } from '../../core/realtime.service';
import { PopoverController } from '@ionic/angular';
import { AdminService } from '../admin/admin.service';
import { LoginPromptService } from '../auth/login-prompt.service';
import type { ReportDetail } from './report-detail';
import { ReportDetailComponent, SIGNAL_DEBOUNCE_MS } from './report-detail.component';
import { ReportDetailService } from './report-detail.service';
import { I18nService } from '../../core/i18n.service';
import { provideCategories } from '../report-new/categories.testing';

const ID = '7b0c5a3e-1f7d-4c49-9a52-2b8f3d0c6e11';

function detail(over: Partial<ReportDetail> = {}): ReportDetail {
  return {
    id: ID,
    title: 'หลุมลึกหน้าตลาด',
    category: 'road',
    icon: 'construction',
    danger_level: 2,
    status: 'open',
    confirm_count: 3,
    comment_count: 1,
    days_open: 4,
    cover_photo_path: null,
    description: 'ลึกประมาณหนึ่งฝ่ามือ\nรถมอเตอร์ไซค์ตกบ่อย',
    lng: 100.5,
    lat: 13.7,
    place_name: 'ซอยลาดพร้าว 1',
    author_name: 'สมใจ',
    tags: ['กลางคืน'],
    photos: [],
    created_at: '2026-10-13T08:00:00Z',
    approved_at: '2026-10-13T09:00:00Z',
    resolved_at: null,
    ...over,
  };
}

function comment(over: Partial<PublicComment> = {}): PublicComment {
  return {
    id: 'c1',
    report_id: ID,
    body: 'เจอเหมือนกันเมื่อวาน',
    author_name: 'น้องบี',
    by_reporter: false,
    created_at: '2026-10-14T08:00:00Z',
    photo_path: null,
    ...over,
  };
}

const sig = (over: Partial<ReportSignal> = {}): ReportSignal => ({
  id: ID,
  status: 'open',
  confirm_count: 4,
  comment_count: 1,
  ...over,
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type Opts = {
  report?: ReportDetail | null;
  comments?: PublicComment[];
  signedIn?: boolean;
  mine?: boolean;
  failFirst?: boolean;
  admin?: boolean;
  menuRole?: string;
  /** false: the categories table has not loaded */
  categories?: boolean;
};

async function setup(opts: Opts = {}) {
  const get = vi.fn().mockResolvedValue(opts.report === undefined ? detail() : opts.report);
  if (opts.failFirst) get.mockRejectedValueOnce(new Error('offline'));
  const svc = {
    get,
    comments: vi.fn().mockResolvedValue(opts.comments ?? [comment()]),
    myConfirmation: vi.fn().mockResolvedValue(opts.mine ?? false),
    toggleConfirm: vi.fn(),
    addComment: vi.fn(),
  };
  const user = signal<string | null>((opts.signedIn ?? true) ? 'u1' : null);
  const session = computed(() => (user() ? { user: { id: user() } } : null));
  const signedIn = computed(() => user() !== null);
  const ask = vi.fn().mockResolvedValue(false);
  const unlisten = vi.fn();
  const listeners: ((s: ReportSignal) => void)[] = [];
  const listen = vi.fn((fn: (s: ReportSignal) => void) => {
    listeners.push(fn);
    return unlisten;
  });
  const emit = (s: ReportSignal) => listeners.forEach((fn) => fn(s));
  const popover = { present: vi.fn().mockResolvedValue(undefined), onDidDismiss: vi.fn().mockResolvedValue({ role: opts.menuRole }) };
  const popovers = { create: vi.fn().mockResolvedValue(popover) };
  const admin = { hide: vi.fn().mockResolvedValue(undefined) };
  TestBed.configureTestingModule({
    providers: [
      { provide: RealtimeService, useValue: { listen } },
      { provide: ReportDetailService, useValue: svc },
      { provide: AuthService, useValue: { session, signedIn, profile: signal(opts.admin ? { id: 'u1', display_name: 'a', role: 'admin', locale: 'th' } : null) } },
      { provide: LoginPromptService, useValue: { ask } },
      { provide: PopoverController, useValue: popovers },
      { provide: AdminService, useValue: admin },
      opts.categories === false ? provideCategories([]) : provideCategories(),
    ],
  });
  const fixture = TestBed.createComponent(ReportDetailComponent);
  const out = { loaded: vi.fn(), missing: vi.fn(), changed: vi.fn(), closed: vi.fn() };
  const c = fixture.componentInstance;
  c.loaded.subscribe(out.loaded);
  c.missing.subscribe(out.missing);
  c.changed.subscribe(out.changed);
  c.closed.subscribe(out.closed);
  fixture.componentRef.setInput('reportId', ID);
  const settle = async () => {
    for (let i = 0; i < 8; i++) {
      fixture.detectChanges();
      await Promise.resolve();
    }
    fixture.detectChanges();
  };
  await settle();
  const root = fixture.nativeElement as HTMLElement;
  const meToo = () => root.querySelector<HTMLButtonElement>('button.metoo');
  /** Waits out the live-signal debounce (real timers), then settles. */
  const afterDebounce = async () => {
    await new Promise((r) => setTimeout(r, SIGNAL_DEBOUNCE_MS + 30));
    await settle();
  };
  return { fixture, root, svc, user, ask, out, settle, afterDebounce, meToo, emit, listen, unlisten, popovers, admin };
}

describe('ReportDetailComponent', () => {
  it('lays the content out in the spec 3.4 order', async () => {
    const { root } = await setup();
    const order = ['.gallery', 'h2', '.tags', '.desc', '.byline', '.metoo', '.fix', '.more', '.comments'];
    const found = order.map((s) => root.querySelector(s));
    expect(found.every(Boolean)).toBe(true);
    for (let i = 1; i < found.length; i++) {
      // each one follows the previous in document order
      expect(found[i - 1]!.compareDocumentPosition(found[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('titles the panel with an h2 that has a stable id and emits loaded', async () => {
    const { root, out } = await setup();
    expect(root.querySelector('h2')?.id).toBe('report-detail-title');
    expect(root.querySelector('h2')?.textContent?.trim()).toBe('หลุมลึกหน้าตลาด');
    expect(out.loaded).toHaveBeenCalledWith(expect.objectContaining({ id: ID, lng: 100.5 }));
  });

  it('shows the level with its shape, the category, the status and the age', async () => {
    const { root } = await setup();
    const tags = root.querySelector('.tags')!;
    expect(tags.querySelector('app-level-shape')).not.toBeNull();
    expect(tags.textContent).toContain('อันตราย');
    expect(tags.textContent).toContain('ถนน/ทางเท้า');
    expect(tags.textContent).toContain('ยังไม่ได้แก้');
    expect(tags.textContent).toContain('ค้างมา 4 วัน');
    expect(tags.textContent).not.toContain('ค้างนาน');
  });

  it('marks a report open for more than 30 days as long-waiting', async () => {
    const { root } = await setup({ report: detail({ days_open: 45 }) });
    expect(root.querySelector('.tags')?.textContent).toContain('ค้างนาน');
  });

  it('names an anonymous reporter and gives the time a datetime and a Buddhist-calendar title', async () => {
    const { root } = await setup({ report: detail({ author_name: null }) });
    const byline = root.querySelector('.byline')!;
    expect(byline.textContent).toContain('ผู้ใช้นิรนาม');
    const time = byline.querySelector('time')!;
    expect(time.getAttribute('datetime')).toBe('2026-10-13T08:00:00Z');
    expect(time.getAttribute('title')).toContain('2569');
    expect(root.textContent).toContain('ซอยลาดพร้าว 1');
  });

  it('shows the category tile when there is no photo, and the photos when there are', async () => {
    const a = await setup();
    expect(a.root.querySelector('.gallery .tile app-icon')).not.toBeNull();
    TestBed.resetTestingModule();
    const b = await setup({
      report: detail({
        photos: [
          { path: 'r/a.webp', kind: 'before', width: 800, height: 600 },
          { path: 'r/b.webp', kind: 'after', width: 800, height: 600 },
        ],
      }),
    });
    const imgs = b.root.querySelectorAll('.gallery img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0].getAttribute('src')).toContain('photos-public/r/a.webp');
    expect(b.root.querySelector('.gallery')?.textContent).toContain('ก่อนแก้');
    expect(b.root.querySelector('.gallery')?.textContent).toContain('หลังแก้');
  });

  it('warns that this is not an emergency channel on a level 3 report', async () => {
    const { root } = await setup({ report: detail({ danger_level: 3 }) });
    const box = root.querySelector('.emergency')!;
    expect(box.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'ระบบนี้ไม่ใช่ช่องทางฉุกเฉิน หากมีอันตรายทันที โทร 191 / 199 / 1669',
    );
    const hrefs = [...box.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['tel:191', 'tel:199', 'tel:1669']);
    // above the me-too button
    expect(box.compareDocumentPosition(root.querySelector('.metoo')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has no emergency box below level 3', async () => {
    const { root } = await setup({ report: detail({ danger_level: 2 }) });
    expect(root.querySelector('.emergency')).toBeNull();
  });

  it('emits missing when the report is not public', async () => {
    const { root, out } = await setup({ report: null });
    expect(out.missing).toHaveBeenCalledTimes(1);
    expect(out.loaded).not.toHaveBeenCalled();
    expect(root.querySelector('h2')).toBeNull();
  });

  it('offers a retry when the report cannot be read, and recovers', async () => {
    const { root, svc, settle, out } = await setup({ failFirst: true });
    expect(root.querySelector('h2')).toBeNull();
    expect(out.missing).not.toHaveBeenCalled();
    expect(root.querySelector('[role="status"]')?.textContent).toContain('โหลดเรื่องนี้ไม่สำเร็จ');
    root.querySelector<HTMLButtonElement>('button.retry')!.click();
    await settle();
    expect(svc.get).toHaveBeenCalledTimes(2);
    expect(root.querySelector('h2')).not.toBeNull();
  });

  describe('me too', () => {
    it('reflects my confirmation in aria-pressed and shows the count', async () => {
      const { meToo } = await setup({ mine: true });
      expect(meToo()!.getAttribute('aria-pressed')).toBe('true');
      expect(meToo()!.textContent?.replace(/\s+/g, ' ')).toContain('เจอเหมือนกัน · 3');
    });

    it('sends one toggle for two quick clicks and shows what the server answered', async () => {
      const { svc, meToo, settle, out } = await setup();
      const answer = deferred<{ confirmed: boolean; report: ReportSignal }>();
      svc.toggleConfirm.mockReturnValue(answer.promise);
      meToo()!.click();
      meToo()!.click();
      await settle();
      expect(svc.toggleConfirm).toHaveBeenCalledTimes(1);
      expect(meToo()!.disabled).toBe(true);
      answer.resolve({ confirmed: true, report: sig({ confirm_count: 7 }) });
      await settle();
      expect(meToo()!.disabled).toBe(false);
      expect(meToo()!.getAttribute('aria-pressed')).toBe('true');
      expect(meToo()!.textContent).toContain('7');
      expect(out.changed).toHaveBeenCalledWith(sig({ confirm_count: 7 }));
    });

    it('asks to log in when signed out and does nothing when the visitor declines', async () => {
      const { svc, meToo, settle, ask } = await setup({ signedIn: false });
      meToo()!.click();
      await settle();
      expect(ask).toHaveBeenCalledTimes(1);
      expect(svc.toggleConfirm).not.toHaveBeenCalled();
      expect(meToo()!.disabled).toBe(false);
    });

    it('toggles after a successful login', async () => {
      const { svc, meToo, settle, ask, user } = await setup({ signedIn: false });
      ask.mockImplementation(async () => {
        user.set('u1');
        return true;
      });
      svc.toggleConfirm.mockResolvedValue({ confirmed: true, report: sig() });
      meToo()!.click();
      await settle();
      expect(svc.toggleConfirm).toHaveBeenCalledTimes(1);
    });

    it('does not undo an existing confirmation found after login', async () => {
      const { svc, meToo, settle, ask, user } = await setup({ signedIn: false });
      ask.mockImplementation(async () => {
        user.set('u1');
        return true;
      });
      svc.myConfirmation.mockResolvedValue(true);
      meToo()!.click();
      await settle();
      expect(svc.toggleConfirm).not.toHaveBeenCalled();
      expect(meToo()!.getAttribute('aria-pressed')).toBe('true');
    });

    it('shows the API message in the status line', async () => {
      const { svc, meToo, settle, root } = await setup();
      svc.toggleConfirm.mockRejectedValue(new ApiError(409, 'report_resolved', 'เรื่องนี้ปิดไปแล้วนะ', 'en'));
      meToo()!.click();
      await settle();
      expect(root.querySelector('[role="status"]')?.textContent).toContain('เรื่องนี้ปิดไปแล้วนะ');
      expect(meToo()!.getAttribute('aria-pressed')).toBe('false');
    });

    it('leaves the next report enabled when the toggle for the previous one is still pending', async () => {
      const { fixture, svc, meToo, settle } = await setup();
      const answer = deferred<{ confirmed: boolean; report: ReportSignal }>();
      svc.toggleConfirm.mockReturnValue(answer.promise);
      meToo()!.click();
      await settle();
      expect(meToo()!.disabled).toBe(true);
      fixture.componentRef.setInput('reportId', 'other');
      await settle();
      expect(meToo()!.disabled).toBe(false);
      answer.resolve({ confirmed: true, report: sig({ confirm_count: 9 }) });
      await settle();
      expect(meToo()!.disabled).toBe(false);
      expect(meToo()!.getAttribute('aria-pressed')).toBe('false');
    });

    it('re-reads my confirmation when another user signs in without signing out first', async () => {
      const { svc, meToo, settle, user } = await setup({ mine: true });
      expect(meToo()!.getAttribute('aria-pressed')).toBe('true');
      const calls = svc.myConfirmation.mock.calls.length;
      svc.myConfirmation.mockResolvedValue(false);
      user.set('u2'); // quick login reporter -> neighbor1: SIGNED_IN, still signed in
      await settle();
      expect(svc.myConfirmation.mock.calls.length).toBe(calls + 1);
      expect(meToo()!.getAttribute('aria-pressed')).toBe('false');
    });

    it("drops a slow answer for the previous user's confirmation", async () => {
      const { svc, meToo, settle, user } = await setup({ mine: false });
      const slow = deferred<boolean>();
      svc.myConfirmation.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(false);
      user.set('u2');
      await settle();
      user.set('u3');
      await settle();
      slow.resolve(true); // u2's answer arrives after u3's
      await settle();
      expect(meToo()!.getAttribute('aria-pressed')).toBe('false');
    });

    it('shows a hand when not pressed and a check when pressed, keeping the label', async () => {
      const { svc, meToo, settle } = await setup({ mine: false });
      expect(meToo()!.querySelector('svg.icon-hand')).not.toBeNull();
      expect(meToo()!.querySelector('svg.icon-check')).toBeNull();
      svc.toggleConfirm.mockResolvedValue({ confirmed: true, report: sig({ confirm_count: 4 }) });
      meToo()!.click();
      await settle();
      expect(meToo()!.querySelector('svg.icon-check')).not.toBeNull();
      expect(meToo()!.querySelector('svg.icon-hand')).toBeNull();
      expect(meToo()!.textContent?.replace(/\s+/g, ' ')).toContain('เจอเหมือนกัน · 4');
    });

    it('is a sentence, not a button, on a resolved report', async () => {
      const { root, meToo } = await setup({ report: detail({ status: 'resolved', confirm_count: 5 }) });
      expect(meToo()).toBeNull();
      expect(root.textContent).toContain('มีคนเจอเหมือนกัน 5 คน');
    });
  });

  describe('comments', () => {
    const typeInto = (root: HTMLElement, text: string) => {
      const box = root.querySelector<HTMLTextAreaElement>('.composer textarea')!;
      box.value = text;
      box.dispatchEvent(new Event('input'));
    };
    const sendBtn = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('.composer button.send')!;

    it('lists name, time and body, and badges the reporter', async () => {
      const { root } = await setup({
        comments: [comment(), comment({ id: 'c2', author_name: null, by_reporter: true, body: 'ขอบคุณค่ะ' })],
      });
      const items = root.querySelectorAll('.comments li');
      expect(items).toHaveLength(2);
      expect(items[0].textContent).toContain('น้องบี');
      expect(items[0].querySelector('.badge')).toBeNull();
      expect(items[0].querySelector('time')?.getAttribute('datetime')).toBe('2026-10-14T08:00:00Z');
      expect(items[1].textContent).toContain('ผู้ใช้นิรนาม');
      expect(items[1].querySelector('.badge')?.textContent?.trim()).toBe('ผู้แจ้ง');
    });

    it('keeps send disabled for blank text and caps the length at 500', async () => {
      const { root, fixture } = await setup();
      expect(sendBtn(root).disabled).toBe(true);
      typeInto(root, '   ');
      fixture.detectChanges();
      expect(sendBtn(root).disabled).toBe(true);
      expect(root.querySelector('.composer textarea')?.getAttribute('maxlength')).toBe('500');
      expect(root.querySelector('.composer .count')?.textContent?.trim()).toBe('3/500');
    });

    it('appends the new comment once, clears the box and emits changed', async () => {
      const { root, fixture, svc, settle, out } = await setup();
      const added = comment({ id: 'c9', body: 'ฝากแจ้งเขตด้วยนะ' });
      svc.addComment.mockResolvedValue({ comment: added, report: sig({ comment_count: 2 }) });
      typeInto(root, '  ฝากแจ้งเขตด้วยนะ ');
      fixture.detectChanges();
      sendBtn(root).click();
      sendBtn(root).click();
      await settle();
      expect(svc.addComment).toHaveBeenCalledTimes(1);
      expect(svc.addComment).toHaveBeenCalledWith(ID, 'ฝากแจ้งเขตด้วยนะ');
      const items = root.querySelectorAll('.comments li');
      expect(items).toHaveLength(2);
      expect(items[1].textContent).toContain('ฝากแจ้งเขตด้วยนะ');
      expect(root.querySelector<HTMLTextAreaElement>('.composer textarea')!.value).toBe('');
      expect(out.changed).toHaveBeenCalledWith(sig({ comment_count: 2 }));
    });

    it('does not show the same comment twice', async () => {
      const { root, fixture, svc, settle } = await setup();
      svc.addComment.mockResolvedValue({ comment: comment(), report: sig() });
      typeInto(root, 'ซ้ำ');
      fixture.detectChanges();
      sendBtn(root).click();
      await settle();
      expect(root.querySelectorAll('.comments li')).toHaveLength(1);
    });

    it('keeps send disabled for a 501-character draft', async () => {
      const { root, fixture } = await setup();
      typeInto(root, 'ก'.repeat(500));
      fixture.detectChanges();
      expect(sendBtn(root).disabled).toBe(false);
      typeInto(root, 'ก'.repeat(501));
      fixture.detectChanges();
      expect(sendBtn(root).disabled).toBe(true);
    });

    it('keeps a comment sent before the first list arrives, and counts from the report', async () => {
      const { root, fixture, svc, settle } = await setup({ comments: [] });
      const first = deferred<PublicComment[]>();
      svc.comments.mockReturnValue(first.promise);
      fixture.componentRef.setInput('reportId', 'other');
      await settle();
      const added = comment({ id: 'c9', body: 'มาก่อนรายการ' });
      svc.addComment.mockResolvedValue({ comment: added, report: sig({ comment_count: 2 }) });
      typeInto(root, 'มาก่อนรายการ');
      fixture.detectChanges();
      sendBtn(root).click();
      await settle();
      first.resolve([comment()]);
      await settle();
      const items = [...root.querySelectorAll('.comments li')].map((li) => li.textContent);
      expect(items).toHaveLength(2);
      expect(items.some((t) => t?.includes('เจอเหมือนกันเมื่อวาน'))).toBe(true);
      expect(items.some((t) => t?.includes('มาก่อนรายการ'))).toBe(true);
      expect(root.querySelector('#report-comments-title')?.textContent).toContain('· 2');
    });

    it('takes the heading count from the report, not the list length', async () => {
      const { root } = await setup({ report: detail({ comment_count: 5 }), comments: [comment()] });
      expect(root.querySelector('#report-comments-title')?.textContent).toContain('· 5');
    });

    it('offers a login button instead of the box when signed out', async () => {
      const { root, ask } = await setup({ signedIn: false });
      expect(root.querySelector('.composer textarea')).toBeNull();
      const btn = [...root.querySelectorAll('button')].find((b) => b.textContent?.includes('เข้าสู่ระบบเพื่อแสดงความคิดเห็น'));
      btn!.click();
      expect(ask).toHaveBeenCalled();
    });
  });

  it('keeps the status line in the accessibility tree while it is empty', async () => {
    const { root } = await setup();
    const status = root.querySelector<HTMLElement>('p.status[role="status"]')!;
    expect(status).not.toBeNull();
    expect(status.textContent).toBe('');
    expect(getComputedStyle(status).display).not.toBe('none');
  });

  describe('live updates', () => {
    it('listens while open and stops when destroyed', async () => {
      const { fixture, listen, unlisten } = await setup();
      expect(listen).toHaveBeenCalledTimes(1);
      fixture.destroy();
      expect(unlisten).toHaveBeenCalledTimes(1);
    });

    it('refetches the report on a signal and shows what the server says', async () => {
      const { root, svc, emit, afterDebounce, meToo } = await setup();
      svc.get.mockResolvedValue(detail({ confirm_count: 8 }));
      emit(sig({ confirm_count: 8 }));
      await afterDebounce();
      expect(svc.get).toHaveBeenCalledTimes(2);
      expect(meToo()!.textContent).toContain('8');
      svc.get.mockResolvedValue(detail({ status: 'resolved', confirm_count: 8 }));
      emit(sig({ status: 'resolved', confirm_count: 8 }));
      await afterDebounce();
      expect(meToo()).toBeNull();
      expect(root.textContent).toContain('มีคนเจอเหมือนกัน 8 คน');
    });

    it('does not trust the payload: a spoofed "resolved" leaves me-too in place when the refetch says open', async () => {
      const { svc, emit, afterDebounce, meToo } = await setup();
      emit(sig({ status: 'resolved', confirm_count: 999, comment_count: 1 }));
      await afterDebounce();
      expect(svc.get).toHaveBeenCalledTimes(2);
      expect(meToo()).not.toBeNull();
      expect(meToo()!.textContent).toContain('3');
      expect(meToo()!.textContent).not.toContain('999');
    });

    it('coalesces a burst of signals into one refetch', async () => {
      const { svc, emit, settle, afterDebounce } = await setup();
      for (let i = 0; i < 6; i++) emit(sig({ confirm_count: 4 + i }));
      await settle();
      expect(svc.get).toHaveBeenCalledTimes(1); // only the first load so far
      await afterDebounce();
      expect(svc.get).toHaveBeenCalledTimes(2);
    });

    it('emits missing when the refetch finds the report gone', async () => {
      const { svc, emit, afterDebounce, out } = await setup();
      svc.get.mockResolvedValue(null);
      emit(sig());
      await afterDebounce();
      expect(out.missing).toHaveBeenCalledTimes(1);
    });

    it('ignores a signal for another report', async () => {
      const { svc, emit, afterDebounce, meToo } = await setup();
      emit(sig({ id: 'someone-else', confirm_count: 99, comment_count: 9 }));
      await afterDebounce();
      expect(svc.get).toHaveBeenCalledTimes(1);
      expect(meToo()!.textContent).toContain('3');
      expect(svc.comments).toHaveBeenCalledTimes(1);
    });

    it('reloads the comments only when the refetched comment count differs, merging without duplicates', async () => {
      const { root, svc, emit, afterDebounce } = await setup();
      emit(sig({ comment_count: 2 })); // the payload's count is not trusted: the refetch still says 1
      await afterDebounce();
      expect(svc.comments).toHaveBeenCalledTimes(1);
      svc.get.mockResolvedValue(detail({ comment_count: 2 }));
      svc.comments.mockResolvedValue([comment(), comment({ id: 'c2', body: 'จากอีกหน้าต่าง' })]);
      emit(sig({ comment_count: 2 }));
      await afterDebounce();
      expect(svc.comments).toHaveBeenCalledTimes(2);
      expect(root.querySelectorAll('.comments li')).toHaveLength(2);
      emit(sig({ comment_count: 2 })); // same count again: nothing to fetch
      await afterDebounce();
      expect(svc.comments).toHaveBeenCalledTimes(2);
    });

    it('does not lose a comment of my own when a reload comes back without it', async () => {
      const { root, fixture, svc, emit, settle, afterDebounce } = await setup();
      const mine = comment({ id: 'c9', body: 'ของฉันเอง' });
      svc.addComment.mockResolvedValue({ comment: mine, report: sig({ comment_count: 2 }) });
      const box = root.querySelector<HTMLTextAreaElement>('.composer textarea')!;
      box.value = 'ของฉันเอง';
      box.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      root.querySelector<HTMLButtonElement>('.composer button.send')!.click();
      await settle();
      svc.comments.mockResolvedValue([comment(), comment({ id: 'c2' })]);
      svc.get.mockResolvedValue(detail({ comment_count: 3 }));
      emit(sig({ comment_count: 3 }));
      await afterDebounce();
      expect(root.querySelectorAll('.comments li')).toHaveLength(3);
    });
  });

  it('shows the photo of a comment as a thumb with a fixed alt', async () => {
    const { root } = await setup({
      comments: [comment({ id: 'p1', photo_path: 'u1/abc.webp' }), comment({ id: 'p2', photo_path: null })],
    });
    const items = root.querySelectorAll('.comments li');
    const img = items[0].querySelector('img');
    expect(img?.getAttribute('src')).toMatch(/\/photos-public\/u1\/abc_thumb\.webp$/);
    expect(img?.getAttribute('alt')).toBe('รูปที่แนบในความคิดเห็น');
    expect(items[1].querySelector('img')).toBeNull();
  });

  it('emits closed from its close button', async () => {
    const { root, out } = await setup();
    root.querySelector<HTMLButtonElement>('button[aria-label="ปิด"]')!.click();
    expect(out.closed).toHaveBeenCalled();
  });
});

describe('ReportDetailComponent (plan 5: fix claims, the more menu, reports)', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));
  afterEach(() => vi.unstubAllGlobals());

  it('an open report offers "แจ้งว่าแก้แล้ว" and a labelled more button', async () => {
    const { root } = await setup();
    expect(root.querySelector('button.fix')?.textContent).toContain('แจ้งว่าแก้แล้ว');
    expect(root.querySelector('button.more')?.getAttribute('aria-label')).toBe('ตัวเลือกเพิ่มเติม');
    expect(root.querySelector('button.copy')).toBeNull(); // copy link moved into the menu
  });

  it('fix_claimed says it waits for review instead of the button', async () => {
    const { root } = await setup({ report: detail({ status: 'fix_claimed' }) });
    expect(root.querySelector('button.fix')).toBeNull();
    expect(root.querySelector('.waiting')?.textContent).toContain('มีคนแจ้งว่าแก้แล้ว รอผู้ดูแลตรวจ');
    expect(root.querySelector('.waiting app-icon')).not.toBeNull();
  });

  it('resolved shows neither', async () => {
    const { root } = await setup({ report: detail({ status: 'resolved' }) });
    expect(root.querySelector('button.fix')).toBeNull();
    expect(root.querySelector('.waiting')).toBeNull();
  });

  it('signed out: the fix button asks to log in and opens nothing when declined', async () => {
    const { root, ask, settle } = await setup({ signedIn: false });
    root.querySelector<HTMLButtonElement>('button.fix')!.click();
    await flush();
    await settle();
    expect(ask).toHaveBeenCalled();
    expect(root.querySelector('app-fix-claim-form')).toBeNull();
  });

  it('signed in: the fix form replaces the action row, and cancel brings it back', async () => {
    const { root, settle } = await setup();
    root.querySelector<HTMLButtonElement>('button.fix')!.click();
    await flush();
    await settle();
    expect(root.querySelector('app-fix-claim-form')).not.toBeNull();
    expect(root.querySelector('.actions')).toBeNull();
    [...root.querySelectorAll<HTMLButtonElement>('app-fix-claim-form button')].find((b) => b.textContent?.includes('ยกเลิก'))!.click();
    await settle();
    expect(root.querySelector('app-fix-claim-form')).toBeNull();
    expect(root.querySelector('.actions')).not.toBeNull();
  });

  it('"คัดลอกลิงก์" in the menu still copies /r/:id', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const { root, settle, popovers } = await setup({ menuRole: 'copy' });
    root.querySelector<HTMLButtonElement>('button.more')!.click();
    await flush();
    await settle();
    expect(popovers.create).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/r/${ID}`);
  });

  it('"รายงาน" from the menu opens the report form for the report', async () => {
    const { root, settle } = await setup({ menuRole: 'flag' });
    root.querySelector<HTMLButtonElement>('button.more')!.click();
    await flush();
    await settle();
    expect(root.querySelector('app-flag-form h3')?.textContent).toContain('รายงานเรื่องนี้');
  });

  it('an admin hides from the menu: AdminService.hide then missing', async () => {
    const { root, settle, admin, out } = await setup({ admin: true, menuRole: 'hide' });
    root.querySelector<HTMLButtonElement>('button.more')!.click();
    await flush();
    await settle();
    expect(admin.hide).toHaveBeenCalledWith('report', ID);
    expect(out.missing).toHaveBeenCalledWith('detail.hidden');
  });

  it('every comment has a labelled report button that opens the form under it', async () => {
    const { root, settle } = await setup({ comments: [comment(), comment({ id: 'c2', body: 'อีกอัน' })] });
    const buttons = root.querySelectorAll<HTMLButtonElement>('button.flag-comment');
    expect(buttons.length).toBe(2);
    expect(buttons[1].getAttribute('aria-label')).toBe('รายงานความคิดเห็นนี้');
    buttons[1].click();
    await flush();
    await settle();
    const items = root.querySelectorAll('.comments li');
    expect(items[1].querySelector('app-flag-form h3')?.textContent).toContain('รายงานความคิดเห็นนี้');
    expect(items[0].querySelector('app-flag-form')).toBeNull();
  });
});
describe('ReportDetailComponent in English (plan 6)', () => {
  const english = () => TestBed.inject(I18nService).setLocale('en');

  it('rewords the open panel in place: me too, fix, level, category, age', async () => {
    const { root, settle, fixture } = await setup({ report: detail({ danger_level: 3 }) });
    const panel = fixture.componentInstance;
    english();
    await settle();
    expect(fixture.componentInstance).toBe(panel);
    expect(root.querySelector('.metoo')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('Me too · 3');
    expect(root.querySelector('.fix')!.textContent).toContain('I saw it fixed');
    const tags = root.querySelector('.tags')!.textContent!;
    expect(tags).toContain('Critical level');
    expect(tags).toContain('Roads & sidewalks');
    expect(tags).toContain('Open for 4 days');
    expect(root.querySelector('.emergency')!.textContent).toContain('not an emergency service');
  });

  it('says a claimed fix is waiting for review', async () => {
    const { root, settle } = await setup({ report: detail({ status: 'fix_claimed' }) });
    english();
    await settle();
    expect(root.querySelector('.tags')!.textContent).toContain('Waiting for review of the fix');
  });

  it('keeps a half-written comment across a switch, both ways', async () => {
    const { root, settle } = await setup();
    const box = root.querySelector('textarea')!;
    box.value = 'ยังพิมพ์อยู่';
    box.dispatchEvent(new Event('input'));
    await settle();
    english();
    await settle();
    TestBed.inject(I18nService).setLocale('th');
    await settle();
    expect(root.querySelector('textarea')!.value).toBe('ยังพิมพ์อยู่');
    expect(root.querySelector('textarea')).toBe(box);
  });

  it('shows the API error in English, and rewords it after switching back', async () => {
    const { root, settle, svc, meToo } = await setup();
    svc.toggleConfirm.mockRejectedValue(new ApiError(409, 'report_resolved', 'เรื่องนี้แก้แล้ว', 'Already resolved.'));
    english();
    await settle();
    meToo()!.click();
    await settle();
    expect(root.querySelector('.status')!.textContent).toBe('Already resolved.');
    TestBed.inject(I18nService).setLocale('th');
    await settle();
    expect(root.querySelector('.status')!.textContent).toBe('เรื่องนี้แก้แล้ว');
  });

  it('shows no category tag before the categories load (never the slug)', async () => {
    const { root } = await setup({ categories: false });
    const tags = root.querySelector('.tags')!.textContent!;
    expect(tags).not.toContain('road');
    expect(tags).toContain('ยังไม่ได้แก้');
  });
});