import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';
import { ThemeService } from '../core/theme.service';
import { MeService } from '../features/me/me.service';
import { LanguageChoiceComponent } from './language-choice.component';
import { ThemeChoiceComponent } from './theme-choice.component';

function setupLanguage(signedIn: boolean) {
  const me = { setLocale: vi.fn().mockResolvedValue(undefined) };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { signedIn: signal(signedIn) } },
      { provide: MeService, useValue: me },
    ],
  });
  const fixture = TestBed.createComponent(LanguageChoiceComponent);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const radios = () => [...root.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  return { fixture, root, radios, me, i18n: TestBed.inject(I18nService) };
}

describe('ThemeChoiceComponent (plan 8)', () => {
  it('asks for the new theme to grow from the middle of the button that was pressed', () => {
    const theme = { choice: signal('dark'), set: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: ThemeService, useValue: theme }] });
    const fixture = TestBed.createComponent(ThemeChoiceComponent);
    fixture.detectChanges();
    const light = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-value="light"]')!;
    light.getBoundingClientRect = () => ({ left: 10, top: 20, width: 40, height: 44 }) as DOMRect;
    light.click();
    expect(theme.set).toHaveBeenCalledWith('light', { x: 30, y: 42 });
  });
});

describe('LanguageChoiceComponent', () => {
  it('offers both languages, each named in itself, as a radiogroup', () => {
    const { root, radios } = setupLanguage(false);
    expect(root.querySelector('[role="radiogroup"]')).not.toBeNull();
    expect(radios().map((r) => r.textContent?.trim())).toEqual(['ไทย', 'English']);
    expect(radios().map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(radios().map((r) => r.getAttribute('lang'))).toEqual(['th', 'en']);
  });

  it('switches the app and saves it to the account when signed in', async () => {
    const { radios, me, i18n, fixture } = setupLanguage(true);
    radios()[1].click();
    await fixture.whenStable();
    expect(i18n.locale()).toBe('en');
    expect(me.setLocale).toHaveBeenCalledWith('en');
    expect(radios()[1].getAttribute('aria-checked')).toBe('true');
  });

  it('does not call the API when signed out, and a failed save only warns', async () => {
    const signedOut = setupLanguage(false);
    signedOut.radios()[1].click();
    expect(signedOut.me.setLocale).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    localStorage.removeItem('jaeng.locale');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failing = setupLanguage(true);
    failing.me.setLocale.mockRejectedValue(new Error('offline'));
    failing.radios()[1].click();
    await new Promise((r) => setTimeout(r));
    expect(warn).toHaveBeenCalled();
    expect(failing.i18n.locale()).toBe('en');
    warn.mockRestore();
  });

  it('moves with the arrow keys and keeps one tab stop', async () => {
    const { radios, fixture, i18n } = setupLanguage(false);
    expect(radios().map((r) => r.tabIndex)).toEqual([0, -1]);
    radios()[0].focus();
    radios()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    expect(i18n.locale()).toBe('en');
    expect(document.activeElement).toBe(radios()[1]);
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, 0]);
  });
});

describe('ThemeChoiceComponent', () => {
  it('offers system, light and dark, and sets the theme', async () => {
    const fixture = TestBed.createComponent(ThemeChoiceComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const radios = [...root.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(radios.map((r) => r.textContent?.trim())).toEqual(['ตามเครื่อง', 'สว่าง', 'มืด']);
    expect(radios.map((r) => r.querySelector('svg')?.classList.contains('icon'))).toEqual([true, true, true]);
    radios[2].click();
    await fixture.whenStable();
    expect(TestBed.inject(ThemeService).choice()).toBe('dark');
    expect(radios[2].getAttribute('aria-checked')).toBe('true');
    TestBed.inject(I18nService).setLocale('en');
    await fixture.whenStable();
    expect(radios.map((r) => r.textContent?.trim())).toEqual(['Match device', 'Light', 'Dark']);
  });
});
