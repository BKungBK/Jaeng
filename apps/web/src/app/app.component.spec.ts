import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { AppUpdateService } from './core/app-update.service';
import { glassNav } from './core/motion';
import { ProfileSetupService } from './features/auth/profile-setup.service';

describe('AppComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), { provide: ProfileSetupService, useValue: {} }]
    }).compileComponents();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('should create the app', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('the new-version notice can be closed without reloading', async () => {
    const dismiss = vi.fn();
    const reload = vi.fn();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), { provide: ProfileSetupService, useValue: {} }, { provide: AppUpdateService, useValue: { ready: signal(true), dismiss, reload } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('.update button')];
    expect(buttons).toHaveLength(2);
    expect(buttons[1].getAttribute('aria-label')).toBe('ปิด');
    buttons[1].click();
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('plays the intro and moves between pages with the glass transition', async () => {
    const { root } = await setup();
    expect(root.querySelector('app-intro')).not.toBeNull();
    const outlet = root.querySelector('ion-router-outlet') as HTMLElement & { animation?: unknown };
    expect(outlet.animation).toBe(glassNav);
  });
});
