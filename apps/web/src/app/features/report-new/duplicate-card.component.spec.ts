import { TestBed } from '@angular/core/testing';
import type { DuplicateCandidate } from '@jaeng/shared/report';
import { ApiError } from '../../core/api.service';
import { LoginPromptService } from '../auth/login-prompt.service';
import { DuplicateCardComponent } from './duplicate-card.component';
import { MapReturnService } from './map-return.service';
import { ReportDraftService } from './report-draft.service';

const WITH_PHOTO: DuplicateCandidate = {
  id: 'd1',
  title: 'หลุมลึกหน้าตลาด',
  category: 'road',
  status: 'open',
  danger_level: 2,
  confirm_count: 3,
  cover_photo_path: 'd1/c1.webp',
};
const WITHOUT_PHOTO: DuplicateCandidate = {
  id: 'd2',
  title: 'ไฟดับซอย 5',
  category: 'light',
  status: 'fix_claimed',
  danger_level: 3,
  confirm_count: 0,
  cover_photo_path: null,
};

const flush = () => new Promise((r) => setTimeout(r, 0));

async function setup(candidates = [WITH_PHOTO, WITHOUT_PHOTO]) {
  const draft = { merge: vi.fn(async (id: string) => ({ id })), createAnyway: vi.fn().mockResolvedValue({ id: 'new1' }), reset: vi.fn() };
  const back = { go: vi.fn().mockResolvedValue(undefined) };
  const prompt = { ask: vi.fn().mockResolvedValue(false) };
  TestBed.configureTestingModule({
    providers: [
      { provide: ReportDraftService, useValue: draft },
      { provide: MapReturnService, useValue: back },
      { provide: LoginPromptService, useValue: prompt },
    ],
  });
  const fixture = TestBed.createComponent(DuplicateCardComponent);
  fixture.componentRef.setInput('candidates', candidates);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const created = vi.fn();
  fixture.componentInstance.created.subscribe(created);
  const buttons = (text: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.textContent?.includes(text));
  return { fixture, root, draft, back, prompt, created, buttons };
}

describe('DuplicateCardComponent', () => {
  it('asks "เรื่องนี้ใช่ไหม?" and says the first photo appears at once, without review', async () => {
    const { root } = await setup();
    expect(root.querySelector('h2')?.textContent?.trim()).toBe('เรื่องนี้ใช่ไหม?');
    expect(root.textContent).toContain('รูปแรกของคุณจะขึ้นเป็นความคิดเห็นในเรื่องนั้นทันที โดยผู้ดูแลยังไม่ได้ตรวจก่อน');
    expect(root.textContent).toContain('รูปอื่นไม่ถูกใช้');
  });

  it('shows each report with its photo or category icon, title and level as shape and word', async () => {
    const { root } = await setup();
    const items = root.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('img')?.getAttribute('src')).toContain('d1/c1.webp');
    expect(items[1].querySelector('img')).toBeNull();
    expect(items[1].querySelector('app-icon svg.icon-lightbulb')).not.toBeNull();
    expect(items[0].textContent).toContain('หลุมลึกหน้าตลาด');
    expect(items[0].querySelector('app-level-shape svg')?.getAttribute('data-level')).toBe('2');
    expect(items[0].textContent).toContain('อันตราย');
    expect(items[1].textContent).toContain('วิกฤต');
    expect(items[1].textContent).toContain('รอตรวจว่าแก้แล้ว');
  });

  it('shows at most three reports', async () => {
    const many = [1, 2, 3, 4].map((n) => ({ ...WITH_PHOTO, id: `d${n}` }));
    const { root } = await setup(many);
    expect(root.querySelectorAll('li')).toHaveLength(3);
  });

  it('"ใช่" merges into that report and goes to it on the map', async () => {
    const { buttons, draft, back } = await setup();
    buttons('ใช่ กดเจอเหมือนกันแทน')[1].click();
    await flush();
    expect(draft.merge).toHaveBeenCalledWith('d2');
    expect(back.go).toHaveBeenCalledWith(['/r', 'd2'], 'ขอบคุณนะ นับให้แล้ว');
  });

  it('"ไม่ใช่" creates the report anyway', async () => {
    const { buttons, draft, created, back } = await setup();
    buttons('ไม่ใช่ แจ้งเป็นเรื่องใหม่')[0].click();
    await flush();
    expect(draft.createAnyway).toHaveBeenCalled();
    expect(created).toHaveBeenCalledWith('new1');
    expect(back.go).not.toHaveBeenCalled();
  });

  it('shows the API message and stays when the merge fails', async () => {
    const { fixture, root, buttons, draft, back } = await setup();
    draft.merge.mockRejectedValueOnce(new ApiError(429, 'rate_limited', 'วันนี้แจ้งครบโควตาแล้ว พรุ่งนี้มาใหม่นะ'));
    buttons('ใช่ กดเจอเหมือนกันแทน')[0].click();
    await flush();
    await fixture.whenStable();
    expect(root.querySelector('[role="status"]')?.textContent).toContain('วันนี้แจ้งครบโควตาแล้ว พรุ่งนี้มาใหม่นะ');
    expect(back.go).not.toHaveBeenCalled();
  });
});
