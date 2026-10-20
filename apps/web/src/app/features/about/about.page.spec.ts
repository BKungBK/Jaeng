import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { MeService } from '../me/me.service';
import { MapReturnService } from '../report-new/map-return.service';
import { AboutPage } from './about.page';

async function setup() {
  const back = { go: vi.fn().mockResolvedValue(undefined) };
  TestBed.configureTestingModule({
    providers: [
      { provide: MapReturnService, useValue: back },
      { provide: AuthService, useValue: { signedIn: signal(false) } },
      { provide: MeService, useValue: { setLocale: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(AboutPage);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, root: fixture.nativeElement as HTMLElement, back };
}

describe('AboutPage', () => {
  it('sits on the shared backdrop', async () => {
    const { root } = await setup();
    expect(root.querySelector('app-backdrop')).not.toBeNull();
    expect(root.querySelector('main.card')?.classList).toContain('glass');
  });

  it('has one h1 and the six sections in order', async () => {
    const { root } = await setup();
    expect(root.querySelectorAll('h1')).toHaveLength(1);
    expect(root.querySelector('h1')?.textContent).toBe('เกี่ยวกับแจ้ง');
    expect([...root.querySelectorAll('h2')].map((h) => h.textContent?.trim())).toEqual([
      'แจ้งคืออะไร',
      'กติกาการแจ้ง',
      'เบอร์ฉุกเฉิน',
      'ข้อมูลส่วนตัว',
      'การแสดงผล',
      'เครดิต',
    ]);
  });

  it('gives the three emergency numbers as phone links', async () => {
    const { root } = await setup();
    expect([...root.querySelectorAll('app-emergency-box a')].map((a) => a.getAttribute('href'))).toEqual([
      'tel:191',
      'tel:199',
      'tel:1669',
    ]);
  });

  it('lets everyone change the language and the theme', async () => {
    const { root } = await setup();
    expect(root.querySelector('app-language-choice [role="radiogroup"]')).not.toBeNull();
    expect(root.querySelector('app-theme-choice [role="radiogroup"]')).not.toBeNull();
  });

  it('says photos are not blurred yet, and never anything else about blurring, in both languages', async () => {
    const { root, fixture } = await setup();
    const check = (says: RegExp, root2: string) => {
      expect(root2).toMatch(says);
      const rest = root2.replace(says, '');
      expect(rest).not.toMatch(/เบลอ|blur/i);
    };
    check(/ยังไม่ได้เบลอ/, root.textContent ?? '');
    TestBed.inject(I18nService).setLocale('en');
    await fixture.whenStable();
    check(/not blurred yet/, root.textContent ?? '');
  });

  it('goes back to the map the way it came', async () => {
    const { root, back } = await setup();
    root.querySelector<HTMLButtonElement>('header button')!.click();
    expect(back.go).toHaveBeenCalledWith();
  });
});
