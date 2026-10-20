import { ChangeDetectionStrategy, Component, DestroyRef, effect, ElementRef, inject, signal } from '@angular/core';
import { ThemeService } from '../core/theme.service';
import { BACKDROP_FRAGMENT, BACKDROP_VERTEX } from './backdrop.glsl';

/** The four mesh colours per theme: night, indigo, lavender, dawn (light: their daytime pastels). */
export const BACKDROP_COLORS = {
  dark: ['#0E1D40', '#2A2F6B', '#7C6BB0', '#F4B49A'],
  light: ['#F6F1FA', '#DCD6F2', '#F9D9CB', '#FFFFFF'],
} as const;

/** never more than this many frames a second: the drift is slow, the grain does not need more */
const FRAME_MS = 1000 / 30;
/** drawn at half the (capped) device resolution, stretched by CSS; the grain hides the softness */
const SCALE = 0.5;
const MAX_DPR = 1.5;

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

type Gl = WebGLRenderingContext;

function compile(gl: Gl): { program: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> } | null {
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = shader(gl.VERTEX_SHADER, BACKDROP_VERTEX);
  const fs = shader(gl.FRAGMENT_SHADER, BACKDROP_FRAGMENT);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  // one triangle that covers the whole screen
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const u of ['u_time', 'u_res', 'u_c0', 'u_c1', 'u_c2', 'u_c3']) uniforms[u] = gl.getUniformLocation(program, u);
  return { program, uniforms };
}

/**
 * The shared night-to-dawn ground of every page that is not the map (plan 6b): a slow shader mesh
 * gradient with grain, or the same gradient in CSS when there is no WebGL or the context is lost.
 * It sits behind the page (fixed, z-index -1), never takes a pointer, pauses with a hidden tab and
 * gives the GPU context back when the page goes.
 */
@Component({
  selector: 'app-backdrop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (fallback()) {
      <div class="fallback"></div>
    }
  `,
  styles: `
    :host {
      position: fixed;
      z-index: -1;
      inset: 0;
      display: block;
      overflow: hidden;
      background: #0f1f44;
      pointer-events: none;
    }
    :host.light {
      background: #f6f1fa;
    }
    /* the mock's sea: a lavender glow top-left, a peach dawn bottom-right, over the navy */
    .fallback {
      position: absolute;
      inset: 0;
      background:
        radial-gradient(80% 40% at 10% 0%, #24356e, transparent 70%),
        radial-gradient(70% 35% at 90% 100%, rgba(244, 180, 154, 0.2), transparent 70%),
        linear-gradient(170deg, #0e1d40, #13264d 50%, #0f1f44);
    }
    :host.light .fallback {
      background:
        radial-gradient(80% 40% at 10% 0%, #dcd6f2, transparent 70%),
        radial-gradient(70% 35% at 90% 100%, rgba(249, 217, 203, 0.9), transparent 70%),
        linear-gradient(170deg, #f6f1fa, #fbf7f2 50%, #f6f1fa);
    }
    .fallback::after {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--noise);
      opacity: 0.06;
    }
  `,
  host: { 'aria-hidden': 'true', '[class.light]': "theme.effective() === 'light'" },
})
export class BackdropComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly fallback = signal(false);

  private canvas?: HTMLCanvasElement;
  private gl?: Gl;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private raf = 0;
  private last = -Infinity;
  private readonly start = performance.now();

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    const canvas = document.createElement('canvas');
    let gl: Gl | null = null;
    try {
      gl = canvas.getContext('webgl', { antialias: false, depth: false, alpha: false, powerPreference: 'low-power' }) as Gl | null;
    } catch {
      gl = null;
    }
    const compiled = gl ? compile(gl) : null;
    if (!gl || !compiled) {
      this.fallback.set(true);
      return;
    }
    this.canvas = canvas;
    this.gl = gl;
    this.uniforms = compiled.uniforms;
    // made here, not in the template, so the component styles do not reach it: size it inline
    canvas.style.cssText = 'display:block;width:100%;height:100%';
    host.appendChild(canvas);

    canvas.addEventListener('webglcontextlost', () => this.lose());
    const onVisible = () => (document.hidden ? this.stop() : this.loop());
    document.addEventListener('visibilitychange', onVisible);
    const onResize = () => this.resize();
    addEventListener('resize', onResize);
    // the colours follow the theme live
    effect(() => {
      const colors = BACKDROP_COLORS[this.theme.effective()];
      colors.forEach((c, i) => gl.uniform3f(this.uniforms[`u_c${i}`], ...rgb(c)));
      this.last = -Infinity; // draw the new colours on the next frame
    });
    destroyRef.onDestroy(() => {
      this.stop();
      document.removeEventListener('visibilitychange', onVisible);
      removeEventListener('resize', onResize);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    });
    this.resize();
    if (!document.hidden) this.loop();
  }

  private resize() {
    const { canvas, gl } = this;
    if (!canvas || !gl) return;
    const k = Math.min(devicePixelRatio || 1, MAX_DPR) * SCALE;
    canvas.width = Math.max(1, Math.round(innerWidth * k));
    canvas.height = Math.max(1, Math.round(innerHeight * k));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(this.uniforms['u_res'], canvas.width, canvas.height);
    this.last = -Infinity;
  }

  private loop() {
    this.stop();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      if (now - this.last < FRAME_MS) return;
      this.last = now;
      this.draw(now);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private draw(now: number) {
    const gl = this.gl;
    if (!gl) return;
    gl.uniform1f(this.uniforms['u_time'], (now - this.start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** the GPU took the context back (driver reset, too many contexts): the CSS gradient takes over */
  private lose() {
    this.stop();
    this.canvas?.remove();
    this.canvas = undefined;
    this.gl = undefined;
    this.fallback.set(true);
  }
}
