import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';
import { MeService } from '../features/me/me.service';
import { LanguageToggleComponent } from './language-toggle.component';

function setup(signedIn = false) {
  const me = { setLocale: vi.fn().mockResolvedValue(undefined) };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { signedIn: signal(signedIn) } },
      { provide: MeService, useValue: me },
    ],
  });
  const fixture = TestBed.createComponent(LanguageToggleComponent);
  fixture.detectChanges();
  const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
  return { fixture, button, me, i18n: TestBed.inject(I18nService) };
}

describe('LanguageToggleComponent', () => {
  it('offers English while Thai shows, named in English', () => {
    const { button } = setup();
    expect(button.textContent?.trim()).toBe('EN');
    expect(button.querySelector('[lang]')?.getAttribute('lang')).toBe('en');
    expect(button.getAttribute('aria-label')).toBe('Switch to English');
  });

  it('switches in place and keeps focus on the same button', async () => {
    const { button, fixture, i18n } = setup();
    button.focus();
    button.click();
    await fixture.whenStable();
    expect(i18n.locale()).toBe('en');
    const after = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(after).toBe(button);
    expect(document.activeElement).toBe(button);
    expect(button.textContent?.trim()).toBe('ไทย');
    expect(button.querySelector('[lang]')?.getAttribute('lang')).toBe('th');
    expect(button.getAttribute('aria-label')).toBe('เปลี่ยนเป็นภาษาไทย');
  });

  it('saves the choice to the account when signed in', () => {
    const { button, me } = setup(true);
    button.click();
    expect(me.setLocale).toHaveBeenCalledWith('en');
  });
});
