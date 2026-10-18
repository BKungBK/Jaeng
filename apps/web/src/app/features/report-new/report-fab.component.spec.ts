import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LoginPromptService } from '../auth/login-prompt.service';
import { ReportFabComponent } from './report-fab.component';

async function setup(opts: { signedIn?: boolean; ask?: boolean } = {}) {
  const auth = { signedIn: signal(opts.signedIn ?? false) };
  const prompt = { ask: vi.fn().mockResolvedValue(opts.ask ?? false) };
  const router = { navigate: vi.fn().mockResolvedValue(true) };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: LoginPromptService, useValue: prompt },
      { provide: Router, useValue: router },
    ],
  });
  const fixture = TestBed.createComponent(ReportFabComponent);
  await fixture.whenStable();
  const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!;
  return { fixture, button, prompt, router };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('ReportFabComponent', () => {
  it('goes to /report when signed in', async () => {
    const { button, prompt, router } = await setup({ signedIn: true });
    button.click();
    await flush();
    expect(prompt.ask).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/report']);
  });

  it('asks to log in first and stays put when the sheet is closed', async () => {
    const { button, prompt, router } = await setup({ signedIn: false, ask: false });
    button.click();
    await flush();
    expect(prompt.ask).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('goes on to /report once the login succeeds', async () => {
    const { button, router } = await setup({ signedIn: false, ask: true });
    button.click();
    await flush();
    expect(router.navigate).toHaveBeenCalledWith(['/report']);
  });

  it('is a labelled button with the Lucide plus and the word แจ้ง, at least 44 px', async () => {
    const { button } = await setup();
    expect(button.getAttribute('aria-label')).toBe('แจ้งเรื่องใหม่');
    expect(button.querySelector('app-icon svg.icon-plus')).not.toBeNull();
    expect(button.textContent?.trim()).toBe('แจ้ง');
    const style = getComputedStyle(button);
    expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(44);
    expect(parseFloat(style.minWidth)).toBeGreaterThanOrEqual(44);
  });
});
