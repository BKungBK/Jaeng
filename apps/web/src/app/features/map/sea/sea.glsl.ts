// The cel sea (plan 2b): flat depth bands, toon caustics in the shallows, foam that laps the
// coast and sparkles on open water. Everything is cut into hard steps, never smooth gradients.

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
uniform vec2 u_centerPx;     // camera centre in world pixels, wrapped to the pattern period
uniform float u_worldPx;     // 512 * 2^zoom
uniform float u_kmPerPx;     // ground size of one CSS pixel at the centre
uniform float u_time;
uniform float u_foamFade;    // 1 at country zoom, 0 at street zoom (vector foam takes over)
uniform vec3 u_deep, u_mid, u_shallow, u_foam, u_caustic, u_sparkle;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
// distance to the nearest cell edge of a moving Voronoi pattern: small along the caustic lines
float voronoiEdge(vec2 p, float t) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y);
    vec2 o = hash2(i + g);
    o = 0.5 + 0.5 * sin(t + 6.2831 * o);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return d2 - d1;
}

void main() {
  vec2 merc = v_rel + u_anchor;
  vec2 uv = (merc - u_grid.xy) / u_grid.z;
  vec4 s = texture(u_sdf, clamp(uv, 0.0, 1.0));
  float km = s.r * u_maxKm;
  float px = km / u_kmPerPx;                     // distance from the coast in screen pixels
  vec2 p = (v_rel - u_center) * u_worldPx + u_centerPx; // screen-scale pattern space, moves with the map

  // depth bands: hard steps, their edges wobbling slowly so the water looks alive
  float wob = (noise(p / 96.0 + u_time * 0.05) - 0.5);
  // shallows 4–30 km wide (about 6 px, more at the country view); the mid band runs to 4× that, inside
  // the texture's 150 km reach, and the open sea beyond is deep
  float shallowKm = clamp(6.0 * u_kmPerPx, 4.0, 30.0);
  float d = km / shallowKm + wob * 0.35;
  vec3 col = d < 1.0 ? u_shallow : d < 4.0 ? u_mid : u_deep;
  // a light toon rim where the shallows meet the mid band
  float rim = abs(d - 1.0) * shallowKm / u_kmPerPx;
  col = mix(col, mix(col, u_caustic, 0.45), step(rim, 1.2));

  // caustics: thin bright cell-edge lines, full in the shallows, faint in the mid band, none at sea
  float c = voronoiEdge(p / 64.0, u_time * 0.9);
  float c2 = voronoiEdge(p / 32.0 + 7.3, -u_time * 0.7);
  float lines = step(c, 0.05) + step(c2, 0.035) * 0.5;
  float reach = d < 1.0 ? 0.9 : d < 4.0 ? 0.3 : 0.0;
  col = mix(col, u_caustic, clamp(lines, 0.0, 1.0) * reach);

  // foam lapping the coast: a solid band that breathes, and a thin line chasing it
  float wave = sin(u_time * 1.3 - px * 0.18);
  float band = step(px, 3.5 + 2.5 * (0.5 + 0.5 * wave));
  float trail = step(abs(px - (11.0 + 5.0 * (0.5 + 0.5 * sin(u_time * 1.3 - 1.4)))), 0.8);
  float broken = step(0.5, noise(p / 16.0 + u_time * 0.2));
  col = mix(col, u_foam, max(band, trail * broken) * u_foamFade);

  // sparkles on open water: one per cell, flashing briefly
  vec2 cell = floor(p / 48.0);
  vec2 spot = (cell + 0.2 + 0.6 * hash2(cell)) * 48.0;
  float phase = fract(u_time * 0.3 + hash(cell + 3.1));
  float on = step(0.93, phase) * step(1.0, d);
  vec2 q = abs(p - spot);
  float star = step(q.x + q.y * 3.0, 3.2) + step(q.y + q.x * 3.0, 3.2);
  col = mix(col, u_sparkle, clamp(star, 0.0, 1.0) * on);

  fragColor = vec4(col, 1.0);
}`;
