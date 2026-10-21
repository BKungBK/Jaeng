import { expectAccessiblePage } from '../../a11y.testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import type { DuplicateCandidate } from '@jaeng/shared/report';
import { ApiError, ApiService } from '../../core/api.service';
import { BackButtonService } from '../../core/back-button.service';
import { CategoriesService } from '../../core/categories.service';
import { DeviceService } from '../../core/device.service';
import { LoginPromptService } from '../auth/login-prompt.service';
import { MAP_FACTORY } from '../map/map-factory';
import { CATEGORIES, provideCategories } from './categories.testing';
import { I18nService } from '../../core/i18n.service';
import { TagSuggestService } from './details-section.component';
import { fakeMap } from './fake-map.testing';
import { photoFile } from './gps-jpeg.testing';
import { MapReturnService } from './map-return.service';
import { PHOTO_PIPELINE, readGps } from './photo-tools';
import { ReportDraftService } from './report-draft.service';
import { ReportNewPage } from './report-new.page';

const CANDIDATE: DuplicateCandidate = {
  id: 'd1',
  title: 'หลุมลึกหน้าตลาด',
  category: 'road',
  status: 'open',
  danger_level: 2,
  confirm_count: 3,
  cover_photo_path: null,
};

const tick = () => new Promise((r) => setTimeout(r, 0));

async function setup(opts: { position?: { lng: number; lat: number } | null; duplicates?: DuplicateCandidate[] } = {}) {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  const map = fakeMap();
  let n = 0;
  const api = {
    upload: vi.fn(async () => ({ photo_id: `p${++n}`, width: 1600, height: 1200 })),
    post: vi.fn(async (path: string, _body?: unknown): Promise<unknown> => {
      if (path === '/reports/check-duplicate') return { duplicates: opts.duplicates ?? [] };
      if (path === '/reports') return { report: { id: 'new1', status: 'pending_review' } };
      return {};
    }),
  };
  const device = { currentPosition: vi.fn().mockResolvedValue(opts.position === undefined ? null : opts.position) };
  const prompt = { ask: vi.fn().mockResolvedValue(true) };
  const session = signal<{ user: { id: string } } | null>({ user: { id: 'user-a' } });
  const back = { go: vi.fn().mockResolvedValue(undefined) };
  const release = vi.fn();
  const backButton = { on: vi.fn(() => release) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BackButtonService, useValue: backButton },
      { provide: ApiService, useValue: api },
      { provide: DeviceService, useValue: device },
      provideCategories(),
      { provide: PHOTO_PIPELINE, useValue: { readGps, compress: async (f: File) => ({ blob: f, width: 1600, height: 1200, type: 'image/webp' }) } },
      { provide: MAP_FACTORY, useValue: () => map },
      { provide: TagSuggestService, useValue: { suggest: vi.fn().mockResolvedValue([]) } },
      { provide: LoginPromptService, useValue: prompt },
      { provide: MapReturnService, useValue: back },
      { provide: AuthService, useValue: { session } },
    ],
  });
  const draft = TestBed.inject(ReportDraftService);
  const fixture = TestBed.createComponent(ReportNewPage);
  const root = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    for (let i = 0; i < 10; i++) {
      fixture.detectChanges();
      await tick();
    }
    await fixture.whenStable();
  };
  await settle();
  const button = (text: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(text));
  const title = () => root.querySelector('h1')?.textContent?.trim();
  /** photo (the first tap) and category (the second): lands on step 3 */
  const toStep3 = async (slug = 'road') => {
    await draft.addFiles([photoFile('a.jpg')]);
    await settle();
    root.querySelectorAll<HTMLButtonElement>('button.cat')[CATEGORIES.findIndex((c) => c.slug === slug)].click();
    await settle();
  };
  return { fixture, root, map, api, device, prompt, back, draft, settle, button, title, toStep3, session, backButton, release };
}

describe('ReportNewPage', () => {
  afterEach(() => TestBed.inject(ReportDraftService).reset());

  it('sits on the shared backdrop', async () => {
    const { root } = await setup();
    expect(root.querySelector('app-backdrop')).not.toBeNull();
    expect(root.querySelector('main.card')?.classList).toContain('glass');
  });

  it('starts on step 1 of 3 with "ไปต่อ" disabled until there is a photo', async () => {
    const { root, title, button } = await setup();
    expect(title()).toBe('ถ่ายรูปปัญหา');
    expect(root.textContent).toContain('ขั้น 1 จาก 3');
    expect(button('ไปต่อ')!.disabled).toBe(true);
  });

  it('puts focus on the step title once Ionic has shown the page', async () => {
    const { fixture, root } = await setup();
    fixture.componentInstance.ionViewDidEnter();
    expect(document.activeElement).toBe(root.querySelector('h1'));
  });

  it('moves to the categories by itself once the first photo is ready', async () => {
    const { draft, settle, title, root } = await setup();
    await draft.addFiles([photoFile('a.jpg')]);
    await settle();
    expect(title()).toBe('เป็นเรื่องอะไร');
    expect(root.textContent).toContain('ขั้น 2 จาก 3');
  });

  it('switches to English at step 2 without leaving it or losing the photo (plan 6)', async () => {
    const { draft, settle, title, root } = await setup();
    await draft.addFiles([photoFile('a.jpg')]);
    await settle();
    TestBed.inject(I18nService).setLocale('en');
    await settle();
    expect(title()).toBe('What is it?');
    expect(root.textContent).toContain('Step 2 of 3');
    expect(draft.photos()).toHaveLength(1);
    expect(root.querySelector('button.cat')?.textContent?.trim()).toBe('Roads & sidewalks');
  });

  it('goes straight to the pin when a category is tapped: three taps in all', async () => {
    const { toStep3, title, draft, root } = await setup({ position: { lng: 100.6, lat: 13.8 } });
    await toStep3('hazard');
    expect(title()).toBe('ปักหมุดตรงไหน');
    expect(root.textContent).toContain('ขั้น 3 จาก 3');
    expect(draft.category()).toBe('hazard');
  });

  it('keeps "ส่งเรื่อง" disabled on the national view until zoom 14 when no position is known', async () => {
    const { toStep3, button, root, map, settle } = await setup({ position: null });
    await toStep3();
    expect(button('ส่งเรื่อง')!.disabled).toBe(true);
    expect(root.textContent).toContain('ซูมเข้าไปอีกหน่อยเพื่อปักหมุดให้แม่น');
    map.cam.zoom = 13.9;
    map.fire('zoom');
    map.fire('moveend');
    await settle();
    expect(button('ส่งเรื่อง')!.disabled).toBe(true);
    map.cam.zoom = 14;
    map.fire('zoom');
    map.fire('moveend');
    await settle();
    expect(button('ส่งเรื่อง')!.disabled).toBe(false);
    expect(root.textContent).not.toContain('ซูมเข้าไปอีกหน่อยเพื่อปักหมุดให้แม่น');
  });

  it('can send at once with a device position', async () => {
    const { toStep3, button } = await setup({ position: { lng: 100.6, lat: 13.8 } });
    await toStep3();
    expect(button('ส่งเรื่อง')!.disabled).toBe(false);
  });

  it('holds the send button below zoom 14 even with a suggested pin (no sending from the national view)', async () => {
    const { toStep3, button, root, map, settle } = await setup({ position: { lng: 100.6, lat: 13.8 } });
    await toStep3();
    expect(map.cam.zoom).toBeGreaterThanOrEqual(14); // the suggestion opens close in: still three taps
    map.cam.zoom = 6; // dragged and zoomed out across the country
    map.cam.center = { lng: 99, lat: 16 };
    map.fire('zoom');
    map.fire('moveend');
    await settle();
    expect(button('ส่งเรื่อง')!.disabled).toBe(true);
    expect(root.textContent).toContain('ซูมเข้าไปอีกหน่อยเพื่อปักหมุดให้แม่น');
  });

  it('puts the "talk about the problem" line right under the send button and folds the details', async () => {
    const { toStep3, button, root } = await setup({ position: { lng: 100.6, lat: 13.8 } });
    await toStep3();
    const send = button('ส่งเรื่อง')!;
    expect(send.nextElementSibling?.textContent?.trim()).toBe('เล่าที่ปัญหา ไม่ระบุชื่อหรือกล่าวหาบุคคล');
    const fold = button('เพิ่มรายละเอียด')!;
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('input[role="switch"]')).toBeNull();
  });

  it('starts the level at the chosen category’s default and the name switch off', async () => {
    const { toStep3, button, root, settle } = await setup({ position: { lng: 100.6, lat: 13.8 } });
    await toStep3('hazard'); // default_level 2
    button('เพิ่มรายละเอียด')!.click();
    await settle();
    const radios = [...root.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.map((r) => r.checked)).toEqual([false, false, true, false]);
    expect(root.querySelector<HTMLInputElement>('input[role="switch"]')!.checked).toBe(false);
  });

  it('never says anything about blurring on any step', async () => {
    const { root, toStep3, button, settle } = await setup({ position: { lng: 100.6, lat: 13.8 } });
    expect(root.textContent).not.toContain('เบลอ');
    await toStep3();
    button('เพิ่มรายละเอียด')!.click();
    await settle();
    expect(root.textContent).not.toContain('เบลอ');
    button('ส่งเรื่อง')!.click();
    await settle();
    expect(root.textContent).not.toContain('เบลอ');
  });

  it('shows the sent card and clears the draft after a report is created', async () => {
    const { toStep3, button, root, settle, draft } = await setup({ position: { lng: 100.6, lat: 13.8 } });
    await toStep3();
    button('ส่งเรื่อง')!.click();
    await settle();
    expect(root.querySelector('h2')?.textContent?.trim()).toBe('ส่งแล้ว รอผู้ดูแลตรวจ');
    expect(draft.photos()).toEqual([]);
  });

  it('sends one report however fast the button is pressed', async () => {
    const { toStep3, button, api, settle } = await setup({ position: { lng: 100.6, lat: 13.8 } });
    await toStep3();
    const send = button('ส่งเรื่อง')!;
    send.click();
    send.click();
    send.click();
    await settle();
    expect(api.post.mock.calls.filter(([p]) => p === '/reports')).toHaveLength(1);
  });

  it('shows the duplicate card when there is a report like it nearby', async () => {
    const { toStep3, button, root, settle } = await setup({ position: { lng: 100.6, lat: 13.8 }, duplicates: [CANDIDATE] });
    await toStep3();
    button('ส่งเรื่อง')!.click();
    await settle();
    expect(root.querySelector('h2')?.textContent?.trim()).toBe('เรื่องนี้ใช่ไหม?');
    expect(root.textContent).toContain('หลุมลึกหน้าตลาด');
  });

  it('shows the API message in the status line and keeps the draft', async () => {
    const { toStep3, button, root, settle, api, draft } = await setup({ position: { lng: 100.6, lat: 13.8 } });
    await toStep3();
    api.post.mockImplementation(async (path: string) => {
      if (path === '/reports/check-duplicate') return { duplicates: [] };
      throw new ApiError(429, 'rate_limited', 'วันนี้แจ้งครบ 5 เรื่องแล้ว พรุ่งนี้มาแจ้งต่อนะ', 'en');
    });
    button('ส่งเรื่อง')!.click();
    await settle();
    expect(root.querySelector('.status[role="status"]')?.textContent).toContain('วันนี้แจ้งครบ 5 เรื่องแล้ว พรุ่งนี้มาแจ้งต่อนะ');
    expect(draft.photos()).toHaveLength(1);
    expect(button('ส่งเรื่อง')!.disabled).toBe(false);
  });

  it('asks to log in again on 401 and then sends the same draft', async () => {
    const { toStep3, button, root, settle, api, prompt } = await setup({ position: { lng: 100.6, lat: 13.8 } });
    await toStep3();
    let first = true;
    api.post.mockImplementation(async (path: string) => {
      if (first) {
        first = false;
        throw new ApiError(401, 'unauthorized', 'เข้าสู่ระบบก่อนนะ', 'en');
      }
      if (path === '/reports/check-duplicate') return { duplicates: [] };
      return { report: { id: 'new1' } };
    });
    button('ส่งเรื่อง')!.click();
    await settle();
    expect(prompt.ask).toHaveBeenCalled();
    expect(root.querySelector('h2')?.textContent?.trim()).toBe('ส่งแล้ว รอผู้ดูแลตรวจ');
  });

  it('sends the same draft after a failed refresh signed the user out and they log back in', async () => {
    const { toStep3, button, root, settle, api, prompt, session, draft } = await setup({ position: { lng: 100.6, lat: 13.8 } });
    await toStep3();
    draft.details.update((d) => ({ ...d, title: 'หลุมใหญ่' }));
    let first = true;
    api.post.mockImplementation(async (path: string) => {
      if (first) {
        first = false;
        session.set(null); // Supabase: SIGNED_OUT after the refresh failed
        TestBed.tick();
        throw new ApiError(401, 'unauthorized', 'เข้าสู่ระบบก่อนนะ', 'en');
      }
      if (path === '/reports/check-duplicate') return { duplicates: [] };
      return { report: { id: 'new1' } };
    });
    prompt.ask.mockImplementation(async () => {
      session.set({ user: { id: 'user-a' } }); // the same person logs back in
      TestBed.tick();
      return true;
    });
    button('ส่งเรื่อง')!.click();
    await settle();
    expect(root.querySelector('h2')?.textContent?.trim()).toBe('ส่งแล้ว รอผู้ดูแลตรวจ');
    expect(api.post).toHaveBeenCalledWith('/reports', expect.objectContaining({ photo_ids: ['p1'], category: 'road', title: 'หลุมใหญ่' }));
  });

  it('closes back to the map from step 1 and steps back from step 2', async () => {
    const { root, draft, settle, back, title } = await setup();
    await draft.addFiles([photoFile('a.jpg')]);
    await settle();
    root.querySelector<HTMLButtonElement>('button[aria-label="ย้อนกลับ"]')!.click();
    await settle();
    expect(title()).toBe('ถ่ายรูปปัญหา');
    root.querySelector<HTMLButtonElement>('button[aria-label="ปิด"]')!.click();
    expect(back.go).toHaveBeenCalledWith();
  });
});

describe('ReportNewPage and the Android back button (plan 7)', () => {
  afterEach(() => TestBed.inject(ReportDraftService).reset());

  it('steps back 3 → 2 → 1 → map and keeps the draft all the way', async () => {
    const { fixture, toStep3, settle, title, back, draft } = await setup({ position: { lng: 100.6, lat: 13.8 } });
    await toStep3();
    expect(title()).toBe('ปักหมุดตรงไหน');
    fixture.componentInstance.onHardwareBack();
    await settle();
    expect(title()).toBe('เป็นเรื่องอะไร');
    fixture.componentInstance.onHardwareBack();
    await settle();
    expect(title()).toBe('ถ่ายรูปปัญหา');
    expect(back.go).not.toHaveBeenCalled();
    fixture.componentInstance.onHardwareBack();
    expect(back.go).toHaveBeenCalledTimes(1);
    expect(draft.photos()).toHaveLength(1);
    expect(draft.category()).toBe('road');
  });

  it('from the duplicate card it returns to the flow, not to the map', async () => {
    const { fixture, toStep3, button, settle, root, back } = await setup({ position: { lng: 100.6, lat: 13.8 }, duplicates: [CANDIDATE] });
    await toStep3();
    button('ส่งเรื่อง')!.click();
    await settle();
    expect(root.querySelector('h2')?.textContent?.trim()).toBe('เรื่องนี้ใช่ไหม?');
    fixture.componentInstance.onHardwareBack();
    await settle();
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('ปักหมุดตรงไหน');
    expect(back.go).not.toHaveBeenCalled();
  });

  it('does nothing while the report is being sent', async () => {
    const { fixture, toStep3, button, settle, api, back, title } = await setup({ position: { lng: 100.6, lat: 13.8 } });
    await toStep3();
    api.post.mockImplementation(() => new Promise(() => {})); // the send never answers
    button('ส่งเรื่อง')!.click();
    await settle();
    fixture.componentInstance.onHardwareBack();
    await settle();
    expect(title()).toBe('ปักหมุดตรงไหน');
    expect(back.go).not.toHaveBeenCalled();
  });

  it('holds the button only while the page shows', async () => {
    const { fixture, backButton, release } = await setup();
    expect(backButton.on).not.toHaveBeenCalled();
    fixture.componentInstance.ionViewDidEnter();
    expect(backButton.on).toHaveBeenCalledWith(50, expect.any(Function));
    fixture.componentInstance.ionViewWillLeave();
    expect(release).toHaveBeenCalledTimes(1);
    fixture.componentInstance.ionViewDidEnter();
    fixture.destroy();
    expect(release).toHaveBeenCalledTimes(2);
  });
});

describe('ReportNewPage accessibility (plan 6)', () => {
  afterEach(() => TestBed.inject(ReportDraftService).reset());
  it('has one h1 and no unnamed button on every step', async () => {
    const { root, toStep3 } = await setup({ position: { lng: 100.6, lat: 13.8 } });
    expectAccessiblePage(root);
    await toStep3('road');
    expectAccessiblePage(root);
  });
});
