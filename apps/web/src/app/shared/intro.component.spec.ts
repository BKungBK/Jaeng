import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppReadyService } from '../core/app-ready.service';
import { INTRO_CAP_MS, INTRO_FIRST_MS, INTRO_LEAVE_MS, INTRO_REPEAT_MS, INTRO_STORAGE_KEY, IntroComponent } from './intro.component';

function setup() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const ready = TestBed.inject(AppReadyService);
  const fixture = TestBed.createComponent(IntroComponent);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const intro = () => root.querySelector<HTMLElement>('.wrap');
  const tick = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };
  return { fixture, root, intro, tick, ready };
}

describe('IntroComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    document.documentElement.classList.remove('intro-holding');
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    sessionStorage.clear();
    document.documentElement.classList.remove('intro-holding');
  });

  it('holds the app behind it and stays up until the app is ready, however long that takes', async () => {
    const { intro, tick, ready } = setup();
    expect(intro()).not.toBeNull();
    expect(intro()!.getAttribute('aria-hidden')).toBe('true');
    expect(document.documentElement.classList.contains('intro-holding')).toBe(true);
    expect(sessionStorage.getItem(INTRO_STORAGE_KEY)).toBe('1');
    await tick(INTRO_FIRST_MS + 4000);
    expect(intro()).not.toBeNull();
    expect(intro()!.classList.contains('out')).toBe(false);
    ready.done();
    await tick(0);
    expect(intro()!.classList.contains('out')).toBe(true);
    expect(document.documentElement.classList.contains('intro-holding')).toBe(false);
    await tick(INTRO_LEAVE_MS + 130);
    expect(intro()).toBeNull();
  });

  it('plays at least its full length even when the app is ready at once', async () => {
    const { intro, tick, ready } = setup();
    ready.done();
    await tick(INTRO_FIRST_MS - 1);
    expect(intro()!.classList.contains('out')).toBe(false);
    await tick(1);
    expect(intro()!.classList.contains('out')).toBe(true);
  });

  it('is quick on a repeat open in the same visit, and still waits for the app', async () => {
    sessionStorage.setItem(INTRO_STORAGE_KEY, '1');
    const { intro, tick, ready } = setup();
    expect(intro()!.classList.contains('quick')).toBe(true);
    await tick(INTRO_REPEAT_MS + 500);
    expect(intro()!.classList.contains('out')).toBe(false);
    ready.done();
    await tick(0);
    expect(intro()!.classList.contains('out')).toBe(true);
  });

  it('does not play at all when told to skip (the E2E tests)', () => {
    sessionStorage.setItem(INTRO_STORAGE_KEY, 'skip');
    const { intro } = setup();
    expect(intro()).toBeNull();
    expect(document.documentElement.classList.contains('intro-holding')).toBe(false);
  });

  it('lets go after the cap even if the app never reports', async () => {
    const { intro, tick } = setup();
    await tick(INTRO_CAP_MS);
    expect(intro()!.classList.contains('out')).toBe(true);
    await tick(INTRO_LEAVE_MS + 130);
    expect(intro()).toBeNull();
  });

  it('skips on a tap or a key only once the app is ready', async () => {
    const first = setup();
    first.intro()!.click();
    first.fixture.detectChanges();
    expect(first.intro()!.classList.contains('out')).toBe(false); // nothing drawn to show yet
    first.ready.done();
    first.intro()!.click();
    first.fixture.detectChanges();
    expect(first.intro()!.classList.contains('out')).toBe(true);
    TestBed.resetTestingModule();
    sessionStorage.clear();
    const second = setup();
    second.ready.done();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    second.fixture.detectChanges();
    expect(second.intro()!.classList.contains('out')).toBe(true);
  });

  it('still plays when storage throws (private mode)', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { intro, tick, ready } = setup();
    expect(intro()).not.toBeNull();
    ready.done();
    await tick(INTRO_FIRST_MS);
    expect(intro()!.classList.contains('out')).toBe(true);
  });

  it('takes no focus', () => {
    const { root } = setup();
    expect(root.querySelector('button, a, [tabindex]')).toBeNull();
  });
});
