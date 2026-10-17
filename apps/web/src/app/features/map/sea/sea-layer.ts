// The animated cel sea as a MapLibre custom layer, drawn over the flat 'toy-mask' fill (which
// stays as the fallback if WebGL2 or the shader is unavailable). Mercator only (plan 2b).
import type maplibregl from 'maplibre-gl';
import type { CustomRenderMethodInput } from 'maplibre-gl';
import { SeaClock } from './sea-clock';
import { SEA_ANCHOR, SeaMesh } from './sea-geometry';
import { SeaPalette } from './sea-palette';
import { SEA_FRAGMENT, SEA_VERTEX } from './sea.glsl';

export type SeaGrid = { x0: number; y0: number; size: number; px: number; maxKm: number };

const EARTH_KM = 40075.016686;
// Pattern space is wrapped to this period so it stays small in float32. Every pattern cell (16, 32,
// 48, 64, 96 px) divides it; the hash-based patterns still jump once per period crossed, which
// is ~100,000 px of panning.
const PATTERN_PERIOD = 96 * 1024;

/** Fades the shader's foam out between zoom 8 and 10, where the texture is too coarse. */
export const seaFoamFade = (zoom: number) => Math.max(0, Math.min(1, (10 - zoom) / 2));

/** column-major 4×4 multiply, in float64 */
function multiply(a: ArrayLike<number>, b: ArrayLike<number>): Float32Array {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  return out;
}

export class SeaLayer implements maplibregl.CustomLayerInterface {
  readonly id = 'sea';
  readonly type = 'custom' as const;
  readonly renderingMode = '2d' as const;

  private map?: maplibregl.Map;
  private gl?: WebGL2RenderingContext;
  private program?: WebGLProgram;
  private vao?: WebGLVertexArrayObject;
  private buffers: WebGLBuffer[] = [];
  private texture?: WebGLTexture;
  private uniforms = new Map<string, WebGLUniformLocation | null>();
  private timer?: ReturnType<typeof setTimeout>;
  private failed = false;
  private readonly onVisibility = () => this.map?.triggerRepaint();

  constructor(
    private mesh: SeaMesh,
    private sdf: HTMLImageElement,
    private grid: SeaGrid,
    private palette: SeaPalette,
    private clock: SeaClock,
  ) {}

  setPalette(palette: SeaPalette): void {
    this.palette = palette;
    this.map?.triggerRepaint();
  }

  onAdd(map: maplibregl.Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    if (!('createVertexArray' in gl)) {
      this.fail('WebGL2 unavailable');
      return;
    }
    this.gl = gl;
    try {
      this.program = this.link(gl);
      for (const name of ['u_matrix', 'u_sdf', 'u_anchor', 'u_grid', 'u_maxKm', 'u_center', 'u_centerPx', 'u_worldPx', 'u_kmPerPx', 'u_time', 'u_foamFade', 'u_deep', 'u_mid', 'u_shallow', 'u_foam', 'u_caustic', 'u_sparkle'])
        this.uniforms.set(name, gl.getUniformLocation(this.program, name));

      this.vao = gl.createVertexArray()!;
      gl.bindVertexArray(this.vao);
      const vbo = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, this.mesh.positions, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(this.program, 'a_pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const ibo = gl.createBuffer()!;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.mesh.indices, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      this.buffers = [vbo, ibo];

      this.texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.sdf);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
    } catch (e) {
      this.fail(e);
    }
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private link(gl: WebGL2RenderingContext): WebGLProgram {
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const program = gl.createProgram()!;
    const vs = compile(gl.VERTEX_SHADER, SEA_VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, SEA_FRAGMENT);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link');
    return program;
  }

  private fail(reason: unknown) {
    // decoration only: the flat 'toy-mask' sea underneath keeps working
    console.warn('animated sea unavailable', reason);
    this.failed = true;
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput): void {
    const { gl, map, program } = this;
    if (this.failed || !gl || !map || !program || !this.vao) return;
    const zoom = map.getZoom();
    const worldPx = 512 * 2 ** zoom;
    const c = map.getCenter();
    const center = [(c.lng + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + (c.lat * Math.PI) / 360)) / Math.PI) / 2];
    // MapLibre 5's matrix takes world pixels; scale mercator up and translate by the anchor in
    // float64, so vertices near Thailand stay precise in float32
    const w = worldPx;
    const anchor = [w, 0, 0, 0, 0, w, 0, 0, 0, 0, 1, 0, SEA_ANCHOR[0] * w, SEA_ANCHOR[1] * w, 0, 1];
    const u = (n: string) => this.uniforms.get(n) ?? null;

    gl.useProgram(program);
    gl.uniformMatrix4fv(u('u_matrix'), false, multiply(args.modelViewProjectionMatrix, anchor));
    gl.uniform2f(u('u_anchor'), SEA_ANCHOR[0], SEA_ANCHOR[1]);
    gl.uniform3f(u('u_grid'), this.grid.x0, this.grid.y0, this.grid.size);
    gl.uniform1f(u('u_maxKm'), this.grid.maxKm);
    gl.uniform2f(u('u_center'), center[0] - SEA_ANCHOR[0], center[1] - SEA_ANCHOR[1]);
    gl.uniform2f(u('u_centerPx'), (center[0] * worldPx) % PATTERN_PERIOD, (center[1] * worldPx) % PATTERN_PERIOD);
    gl.uniform1f(u('u_worldPx'), worldPx);
    gl.uniform1f(u('u_kmPerPx'), (EARTH_KM * Math.cos((c.lat * Math.PI) / 180)) / worldPx);
    gl.uniform1f(u('u_time'), this.clock.time());
    gl.uniform1f(u('u_foamFade'), seaFoamFade(zoom));
    const p = this.palette;
    gl.uniform3fv(u('u_deep'), p.deep);
    gl.uniform3fv(u('u_mid'), p.mid);
    gl.uniform3fv(u('u_shallow'), p.shallow);
    gl.uniform3fv(u('u_foam'), p.foam);
    gl.uniform3fv(u('u_caustic'), p.caustic);
    gl.uniform3fv(u('u_sparkle'), p.sparkle);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture!);
    gl.uniform1i(u('u_sdf'), 0);

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.mesh.indices.length, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);

    this.clock.drew();
    this.schedule();
  }

  private schedule() {
    if (this.timer !== undefined) return;
    const wait = this.clock.nextFrameIn(document.hidden);
    if (wait === null) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.map?.triggerRepaint();
    }, wait);
  }

  onRemove(_map: maplibregl.Map, _gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    document.removeEventListener('visibilitychange', this.onVisibility);
    const gl = this.gl;
    if (gl) {
      for (const b of this.buffers) gl.deleteBuffer(b);
      if (this.vao) gl.deleteVertexArray(this.vao);
      if (this.texture) gl.deleteTexture(this.texture);
      if (this.program) gl.deleteProgram(this.program);
    }
    this.buffers = [];
    this.vao = this.texture = this.program = undefined;
    this.map = this.gl = undefined;
  }
}
