// The sea: a smooth depth gradient anchored to the ground, swell lines that roll in to the coast
// and wash up as foam, and soft sun sheen on open water. Every pattern is drawn at two zoom
// octaves and crossfaded, so it stays put on the map and keeps its size on screen while zooming.

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

const float SWELL_PX = 36.0; // swell spacing on screen at an octave's own zoom
const float SPEED = 0.22;    // swell lines reaching the shore per second

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { return 0.5 * noise(p) + 0.3 * noise(p * 2.03 + 1.7) + 0.2 * noise(p * 4.01 + 3.1); }

// One octave of swell: q is pattern space (pixels at the octave's zoom), s its spacing in km.
// Returns crest strength (x) and shore foam (y).
vec2 swell(float km, float s, vec2 q, float t) {
  float bend = (noise(q / 140.0) - 0.5) * 0.9;     // crests wander a little off the coast's shape
  float x = km / s + t * SPEED + bend;             // grows offshore; crests move in as time grows
  float f = fract(x);
  float aa = 1.2 * u_kmPerPx / s;                  // about one screen pixel, in spacings
  // steep face toward the shore, long soft back
  float crest = smoothstep(0.0, 0.06 + aa, f) * (1.0 - smoothstep(0.06, 0.42, f));
  float gaps = smoothstep(0.3, 0.62, noise(q / 64.0 + vec2(t * 0.04, -t * 0.03)));
  float reach = 1.0 - smoothstep(1.2, 4.5, km / s); // only the last few lines before the coast
  crest *= gaps * reach * smoothstep(0.05, 0.35, km / s);

  // a line breaks at the shore, washes up to half a spacing and drains back
  float f0 = fract(t * SPEED + bend);
  float wash = 0.12 + 0.38 * (1.0 - smoothstep(0.06, 0.95, f0)) * smoothstep(0.0, 0.06, f0);
  float edge = (noise(q / 18.0 + t * 0.3) - 0.5) * 0.08;
  float foam = 1.0 - smoothstep(wash + edge - aa, wash + edge + aa, km / s);
  return vec2(crest, foam);
}

// Soft sun sheen on the water, in pattern space.
float sheen(vec2 q, float t) {
  float v = 0.6 * fbm(q / 110.0 + vec2(t * 0.03, t * 0.018)) + 0.4 * fbm(q / 60.0 - vec2(t * 0.025, -t * 0.02) + 5.2);
  return smoothstep(0.58, 0.8, v);
}

// A few slow glints on open water.
float glint(vec2 q, float t) {
  vec2 cell = floor(q / 80.0);
  vec2 spot = (cell + 0.2 + 0.6 * vec2(hash(cell), hash(cell + 7.7))) * 80.0;
  float phase = fract(t * 0.25 + hash(cell + 3.1));
  float pulse = smoothstep(0.0, 0.15, phase) * (1.0 - smoothstep(0.15, 0.4, phase));
  return pulse * (1.0 - smoothstep(0.5, 2.2, length(q - spot)));
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

  // depth: shallows to open sea by ground distance, its edge wandering slowly
  float k = max(km + (noise(uv * 90.0 + t * 0.01) - 0.5) * 8.0, 0.0);
  vec3 col = mix(u_shallow, u_mid, smoothstep(1.0, 28.0, k));
  col = mix(col, u_deep, smoothstep(28.0, 120.0, k));

  col = mix(col, u_caustic, mix(sheen(qA, t), sheen(qB, t), w) * 0.16 * smoothstep(4.0, 30.0, k));

  if (u_foamFade > 0.0) {
    float sA = SWELL_PX * u_kmPerPx / scaleA;      // km per spacing at octave A
    vec2 a = swell(km, sA, qA, t);
    vec2 b = swell(km, sA * 0.5, qB, t);
    vec2 sw = mix(a, b, w) * u_foamFade;
    col = mix(col, u_caustic, sw.x * 0.55);
    col = mix(col, u_foam, sw.y * 0.92);
  }

  col = mix(col, u_sparkle, mix(glint(qA, t), glint(qB, t), w) * smoothstep(20.0, 60.0, km) * 0.8);
  fragColor = vec4(col, 1.0);
}`;
