import { TestBed } from '@angular/core/testing';
import { ThemeService } from '../core/theme.service';
import { BACKDROP_COLORS, BackdropComponent } from './backdrop.component';

/** Enough of a WebGL context for the component: every method a spy, shaders and programs compile. */
function stubGl() {
  const loseContext = vi.fn();
  const gl: Record<string, unknown> = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getExtension: (name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null),
  };
  const ctx = new Proxy(gl, { get: (t, k: string) => (k in t ? t[k] : (t[k] = vi.fn(() => ({})))) });
  return { ctx, loseContext };
}

function setup(gl: unknown) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => gl) as never);
  const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 7);
  const caf = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  const fixture = TestBed.createComponent(BackdropComponent);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return { fixture, root, raf, caf };
}

describe('BackdropComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('falls back to the CSS gradient without WebGL', () => {
    const { root } = setup(null);
    expect(root.querySelector('div.fallback')).not.toBeNull();
    expect(root.querySelector('canvas')).toBeNull();
  });

  it('draws on a canvas, pauses with the tab and lets go of the GPU when destroyed', () => {
    const { ctx, loseContext } = stubGl();
    const { fixture, root, raf, caf } = setup(ctx);
    expect(root.querySelector('canvas')).not.toBeNull();
    expect(root.querySelector('div.fallback')).toBeNull();
    expect(raf).toHaveBeenCalled();
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(caf).toHaveBeenCalled();
    caf.mockClear();
    fixture.destroy();
    expect(caf).toHaveBeenCalled();
    expect(loseContext).toHaveBeenCalled();
  });

  it('switches to the CSS gradient when the context is lost', () => {
    const { ctx } = stubGl();
    const { fixture, root } = setup(ctx);
    root.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost'));
    fixture.detectChanges();
    expect(root.querySelector('canvas')).toBeNull();
    expect(root.querySelector('div.fallback')).not.toBeNull();
  });

  it('stays idle after the context is lost, even when the tab comes back', () => {
    const { ctx } = stubGl();
    const { root, raf } = setup(ctx);
    root.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost'));
    raf.mockClear();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(raf).not.toHaveBeenCalled();
  });

  it('pauses while Ionic keeps its page hidden in the stack, and resumes when it shows again', () => {
    let seen!: (entries: { isIntersecting: boolean }[]) => void;
    const observe = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof seen) {
          seen = cb;
        }
        observe = observe;
        disconnect = vi.fn();
      },
    );
    const { ctx } = stubGl();
    const { raf, caf } = setup(ctx);
    expect(observe).toHaveBeenCalled();
    caf.mockClear();
    seen([{ isIntersecting: false }]);
    expect(caf).toHaveBeenCalled();
    raf.mockClear();
    seen([{ isIntersecting: true }]);
    expect(raf).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('takes its colours from the theme', () => {
    const { fixture } = setup(null);
    TestBed.inject(ThemeService).set('light');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).classList).toContain('light');
    // the comp's sea: navy field, a #24356E glow top-left, the dawn bottom-right (finish review)
    expect(BACKDROP_COLORS.dark).toEqual(['#0E1D40', '#13264D', '#24356E', '#F4B49A']);
    expect(BACKDROP_COLORS.light).toEqual(['#F6F1FA', '#DCD6F2', '#F9D9CB', '#FFFFFF']);
  });
});
