// The stylized sea: flat pastel depth bands with clean anti-aliased edges and a pale contour,
// crisp dashed swell lines that roll in and wash up as scalloped foam with a second line chasing
// it, little drawn wave marks drifting on open water, and four-point glints. Patterns are fixed to
// the ground and drawn at the two whole zooms around the camera, crossfaded, so nothing swims or
// pops while zooming; every edge is about one pixel soft, so nothing stair-steps either.

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
uniform vec3 u_deep, u_mid, u_shallow, u_foam, u_caustic, u_sparkle;

const float SWELL_PX = 42.0; // swell spacing on screen at an octave's own zoom
const float SPEED = 0.2;     // swell lines reaching the shore per second

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
// 1 inside a stroke of half-width w (pixels) at distance d (pixels), with a one-pixel soft edge
float stroke(float d, float w) { return 1.0 - smoothstep(w - 0.6, w + 0.6, d); }

// One octave of swell: q is pattern space (pixels at the octave's zoom), s its spacing in km.
// x: dashed crest lines, y: shore foam, z: the thin line that chases the foam.
vec3 swell(float km, float s, vec2 q, float t) {
  float pxPerS = s / u_kmPerPx;                    // screen pixels per spacing
  float bend = (noise(q / 170.0) - 0.5) * 0.8;     // lines wander a little off the coast's shape
  float rel = km / s;
  float x = rel + t * SPEED + bend;                // grows offshore; lines move in as time grows

  // crisp crest lines, thinning out to nothing a few spacings offshore, broken into dashes
  float reach = (1.0 - smoothstep(0.9, 3.4, rel)) * smoothstep(0.55, 0.95, rel);
  float dash = smoothstep(0.4, 0.47, noise(q / 56.0 + vec2(t * 0.05, -t * 0.02)));
  float crest = stroke(abs(fract(x) - 0.5) * pxPerS, 1.5 * reach) * dash * smoothstep(0.0, 0.3, reach);

  // a line breaks on the shore (fract = 0.5 at rel 0), surges up and drains back
  float f0 = fract(t * SPEED + bend - 0.5);
  float wash = 0.16 + 0.3 * smoothstep(0.0, 0.06, f0) * (1.0 - smoothstep(0.06, 0.9, f0));
  float edge = wash + (noise(q / 15.0) - 0.5) * 0.07; // scalloped foam edge
  float foam = 1.0 - smoothstep(-0.6, 0.6, (rel - edge) * pxPerS);
  float ring = stroke(abs(rel - edge - 0.17) * pxPerS, 1.0);
  return vec3(crest, foam, ring);
}

// Little drawn wave marks (two arcs) drifting on open water, a few per screen.
float marks(vec2 q, float t) {
  const float C = 130.0;
  vec2 cell = floor(q / C);
  vec2 h = vec2(hash(cell), hash(cell + 4.3));
  if (h.x > 0.4) return 0.0;
  float life = fract(t * 0.07 + h.y);
  float alpha = smoothstep(0.0, 0.2, life) * (1.0 - smoothstep(0.7, 1.0, life));
  vec2 d = q - ((cell + 0.25 + 0.5 * vec2(hash(cell + 1.7), hash(cell + 9.1))) * C + vec2(life * 16.0, 0.0));
  const float r = 6.5;
  float m = 0.0;
  for (int i = 0; i < 2; i++) {
    vec2 c = vec2(float(i * 2 - 1) * r, r);         // circle centre below the stroke (y grows south)
    float top = 1.0 - smoothstep(-1.0, 1.0, d.y - c.y + r * 0.35); // upper part of the circle only
    m = max(m, stroke(abs(length(d - c) - r), 0.9) * top);
  }
  return m * alpha;
}

// A four-point glint that blinks now and then.
float glint(vec2 q, float t) {
  const float C = 90.0;
  vec2 cell = floor(q / C);
  vec2 spot = (cell + 0.2 + 0.6 * vec2(hash(cell), hash(cell + 7.7))) * C;
  float phase = fract(t * 0.22 + hash(cell + 3.1));
  float k = smoothstep(0.0, 0.08, phase) * (1.0 - smoothstep(0.08, 0.22, phase));
  vec2 a = abs(q - spot) / max(k, 0.001);
  float star = max(1.0 - smoothstep(3.0, 4.2, a.x + a.y * 4.0), 1.0 - smoothstep(3.0, 4.2, a.y + a.x * 4.0));
  return star * step(0.01, k);
}

void main() {
  vec2 merc = v_rel + u_anchor;
  vec2 uv = (merc - u_grid.xy) / u_grid.z;
  float km = texture(u_sdf, clamp(uv, 0.0, 1.0)).r * u_maxKm;

  // pattern space at the two octaves around the current zoom; both are fixed to the ground
  vec2 rel = (v_rel - u_center) * u_worldPx;
  float scaleA = exp2(-u_octave);
  vec2 qA = rel * scaleA + u_centerA;
  vec2 qB = rel * scaleA * 2.0 + u_centerB;
  float w = u_octave;
  float t = u_time;

  // depth bands: ground distances, never thinner than a few pixels at the country view, with
  // gently wandering edges (multiplicative, so they wander the same at every zoom)
  float k = km * (1.0 + (noise(uv * 70.0 + t * 0.008) - 0.5) * 0.35);
  float e1 = max(9.0, 7.0 * u_kmPerPx), e2 = max(32.0, 22.0 * u_kmPerPx), e3 = max(80.0, 48.0 * u_kmPerPx);
  float aa = 0.6 * u_kmPerPx;
  vec3 col = mix(u_shallow, u_mid, smoothstep(e1 - aa, e1 + aa, k));
  col = mix(col, mix(u_mid, u_deep, 0.5), smoothstep(e2 - aa, e2 + aa, k));
  col = mix(col, u_deep, smoothstep(e3 - aa, e3 + aa, k));
  // a pale contour just inside each band edge, like an inked chart
  float contour = 0.0;
  for (int i = 0; i < 3; i++) {
    float e = i == 0 ? e1 : i == 1 ? e2 : e3;
    contour = max(contour, stroke(abs(k - e + 2.5 * u_kmPerPx) / u_kmPerPx, 0.8));
  }
  col = mix(col, u_caustic, contour * 0.45);

  if (u_foamFade > 0.0) {
    float sA = SWELL_PX * u_kmPerPx / scaleA;      // km per spacing at octave A
    vec3 sw = mix(swell(km, sA, qA, t), swell(km, sA * 0.5, qB, t), w) * u_foamFade;
    col = mix(col, u_foam, sw.x * 0.8);
    col = mix(col, u_foam, sw.z * 0.75);
    col = mix(col, u_foam, sw.y);
  }

  float open = smoothstep(e2, e2 * 1.6, k);
  col = mix(col, u_caustic, mix(marks(qA, t), marks(qB, t), w) * open * 0.7);
  col = mix(col, u_sparkle, mix(glint(qA, t), glint(qB, t), w) * open);
  fragColor = vec4(col, 1.0);
}`;
