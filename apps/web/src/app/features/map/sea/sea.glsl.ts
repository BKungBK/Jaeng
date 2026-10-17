// The animated ocean (owner, 2026-10-17): a smooth glow around the coast fading to the deep, thin
// ripple lines rolling out from the shore and fading, soft foam washing up the coast, and only a
// few small wave marks out on the open sea, each fading in and out. Patterns are fixed to the ground
// and drawn at the two whole zooms around the camera, crossfaded, so nothing pops while zooming.
// Kept cheap on purpose: five texture reads and a handful of value-noise calls a pixel.

export const SEA_VERTEX = /* glsl */ `#version 300 es
precision highp float;
uniform mat4 u_matrix;    // world (mercator 0..1, relative to the anchor) to clip
in vec2 a_pos;            // mercator, relative to the anchor
out vec2 v_rel;
void main() {
  v_rel = a_pos;
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
}`;

export const SEA_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_rel;
out vec4 fragColor;

uniform sampler2D u_sdf;     // R: distance from the coast (0..1 of u_maxKm); B: land
uniform vec2 u_anchor;       // mercator of the anchor
uniform vec3 u_grid;         // sdf grid: x0, y0, size (mercator)
uniform float u_maxKm;
uniform vec2 u_center;       // camera centre, relative to the anchor
uniform float u_worldPx;     // 512 * 2^zoom
uniform float u_kmPerPx;     // ground size of one CSS pixel at the centre
uniform vec2 u_centerA;      // camera centre in world pixels at zoom floor(z), wrapped to the period
uniform vec2 u_centerB;      // the same at zoom floor(z) + 1
uniform float u_octave;      // fract(zoom): weight of octave B
uniform float u_time;
uniform float u_foamFade;    // 1 at country zoom, 0 at street zoom (vector foam takes over)
uniform vec3 u_deep, u_mid, u_shallow, u_foam, u_caustic;

const float FOAM_PX = 56.0;   // foam scale on screen at an octave's own zoom
const float SPEED = 0.16;     // foam surges per second
const float RIPPLE_PX = 30.0; // ripple spacing on screen at an octave's own zoom
const float RIPPLE_SPEED = 0.1; // ripple spacings travelled outward per second
const float MARK_CELL = 300.0;  // one possible wave mark per cell this many pattern px across

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

// Soft foam at the shore: washes up and drains back. q is pattern space, s the foam scale in km.
float shore(float km, float s, vec2 q, float t) {
  float f0 = fract(t * SPEED + (noise(q / 160.0) - 0.5) * 0.8); // stretches of coast surge out of step
  float wash = 0.1 + 0.2 * smoothstep(0.0, 0.1, f0) * (1.0 - smoothstep(0.1, 0.9, f0));
  float v = km / s;
  float w = max(fwidth(v), 1e-6);
  return 1.0 - smoothstep(wash - w, wash + 2.5 * w, v);
}

// Ripple lines rolling out from the coast: r is the spacing in km. Each line is born just off the
// shore and fades as it travels out, so about three show at a time. About 1 px, soft.
float ripples(float km, float r, float t) {
  float x = km / r;
  float p = x - t * RIPPLE_SPEED;
  float f = fract(p);
  float line = 1.0 - smoothstep(0.6, 1.6, min(f, 1.0 - f) / max(fwidth(p), 1e-6));
  return line * smoothstep(0.5, 0.9, x) * (1.0 - smoothstep(1.3, 3.4, x));
}

// A small wave mark (two little crests, one above the other) in some cells of pattern space q, which
// is screen px times scale. Each lives about 10 s: it fades in, drifts a little and fades out.
// The cells are fixed in q (so on the ground); sizing them by scale would reshuffle the marks on
// every frame of a zoom. Only the mark's drawing is in screen px, so it keeps its size.
// No derivatives in here, so the per-cell early return is safe.
float waveMark(vec2 q, float scale, float t) {
  float cellQ = MARK_CELL;
  vec2 cell = floor(q / cellQ);
  if (hash(cell) > 0.3) return 0.0;
  float life = fract(t / 10.0 + hash(cell + 5.3));
  float a = smoothstep(0.0, 0.3, life) * (1.0 - smoothstep(0.6, 0.95, life));
  vec2 at = (cell + 0.2 + 0.6 * vec2(hash(cell + 1.7), hash(cell + 9.2))) * cellQ;
  vec2 p = (q - at) / scale + vec2(-life * 12.0, 0.0); // screen px around the mark, drifting right
  float m = 0.0;
  for (int i = 0; i < 2; i++) {
    vec2 o = p - vec2(float(i) * 7.0, float(i) * 7.0);     // second crest lower right
    float y = -2.6 * sin(o.x * 0.38 + 1.2);
    float d = abs(o.y - y) / sqrt(1.0 + pow(0.99 * cos(o.x * 0.38 + 1.2), 2.0));
    float len = 1.0 - smoothstep(7.0 - float(i) * 2.0, 9.5 - float(i) * 2.0, abs(o.x));
    m = max(m, (1.0 - smoothstep(0.55, 1.5, d)) * len);
  }
  return m * a;
}

void main() {
  vec2 merc = v_rel + u_anchor;
  vec2 uv = (merc - u_grid.xy) / u_grid.z;
  vec2 cuv = clamp(uv, 0.0, 1.0);
  float km = texture(u_sdf, cuv).r * u_maxKm;
  // a softened distance (five taps, ~3 texels apart) so the glow and ripples follow the coast in
  // smooth curves instead of the raster's steps
  vec2 tx = 3.0 / vec2(textureSize(u_sdf, 0));
  float kmS = (texture(u_sdf, cuv).r + texture(u_sdf, cuv + vec2(tx.x, 0)).r + texture(u_sdf, cuv - vec2(tx.x, 0)).r
    + texture(u_sdf, cuv + vec2(0, tx.y)).r + texture(u_sdf, cuv - vec2(0, tx.y)).r) * 0.2 * u_maxKm;
  float t = u_time;

  // a smooth glow around the coast fading to the deep, with a faint slow shimmer far out
  float shimmer = noise(uv * 6.0 + vec2(t * 0.004, -t * 0.003)) - 0.5;
  // the glow reaches 38 km, or 26 px at the country view, whichever is wider (continuous in zoom)
  float reach = max(38.0, 26.0 * u_kmPerPx);
  float b = clamp(exp(-kmS / reach) + shimmer * 0.14 * smoothstep(20.0, 80.0, kmS), 0.0, 1.0);
  vec3 col = mix(u_deep, u_mid, smoothstep(0.0, 0.45, b));
  col = mix(col, u_shallow, smoothstep(0.4, 1.0, b));

  vec2 rel = (v_rel - u_center) * u_worldPx;
  float scaleA = exp2(-u_octave);

  // ripples rolling out from the coast, crossfaded between octaves
  float rA = RIPPLE_PX * u_kmPerPx / scaleA;
  float rip = mix(ripples(kmS, rA, t), ripples(kmS, rA * 0.5, t), u_octave);
  col = mix(col, u_caustic, rip * 0.5 * u_foamFade);

  if (u_foamFade > 0.0) {
    float sA = FOAM_PX * u_kmPerPx / scaleA;
    float foam = mix(shore(km, sA, rel * scaleA + u_centerA, t), shore(km, sA * 0.5, rel * scaleA * 2.0 + u_centerB, t), u_octave);
    col = mix(col, u_foam, foam * 0.85 * u_foamFade);
  }

  // a few small wave marks out on the open sea
  float marks = mix(waveMark(rel * scaleA + u_centerA, scaleA, t), waveMark(rel * scaleA * 2.0 + u_centerB, scaleA * 2.0, t), u_octave);
  col = mix(col, u_caustic, marks * 0.75 * smoothstep(50.0, 90.0, kmS));
  fragColor = vec4(col, 1.0);
}`;
