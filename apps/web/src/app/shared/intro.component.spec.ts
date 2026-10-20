import { TestBed } from '@angular/core/testing';
import { INTRO_MS, INTRO_STORAGE_KEY, IntroComponent } from './intro.component';

function setup() {
  const fixture = TestBed.createComponent(IntroComponent);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const intro = () => root.querySelector<HTMLElement>('.intro');
  const tick = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };
  return { fixture, root, intro, tick };
}

describe('IntroComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('plays once per visit and goes by itself after 1.8 s', async () => {
    const { intro, tick } = setup();
    expect(intro()).not.toBeNull();
    expect(intro()!.getAttribute('aria-hidden')).toBe('true');
    expect(sessionStorage.getItem(INTRO_STORAGE_KEY)).toBe('1');
    await tick(INTRO_MS - 1);
    expect(intro()).not.toBeNull();
    await tick(1);
    expect(intro()).toBeNull();
  });

  it('goes at once on a tap or a key', async () => {
    const first = setup();
    first.intro()!.click();
    first.fixture.detectChanges();
    expect(first.intro()).toBeNull();
    sessionStorage.clear();
    const second = setup();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    second.fixture.detectChanges();
    expect(second.intro()).toBeNull();
  });

  it('does not play again in the same visit', () => {
    sessionStorage.setItem(INTRO_STORAGE_KEY, '1');
    expect(setup().intro()).toBeNull();
  });

  it('still plays and goes when storage throws (private mode)', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { intro, tick } = setup();
    expect(intro()).not.toBeNull();
    await tick(INTRO_MS);
    expect(intro()).toBeNull();
  });

  it('takes no focus', () => {
    const { root } = setup();
    expect(root.querySelector('button, a, [tabindex]')).toBeNull();
  });
});
