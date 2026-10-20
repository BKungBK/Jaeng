// The night-to-dawn backdrop behind the non-map pages (plan 6b): a slow mesh gradient of four colours
// whose centres drift on 18–30 s loops (the grain is a CSS layer on top). WebGL 1 so it runs nearly anywhere;
// one full-screen triangle, a few dozen ALU ops a pixel, drawn at half resolution.

export const BACKDROP_VERTEX = /* glsl */ `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export const BACKDROP_FRAGMENT = /* glsl */ `
// the grain's hash shows diagonal hatching at mediump; most GPUs have highp
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float u_time;
uniform vec2 u_res;
uniform vec3 u_c0, u_c1, u_c2, u_c3;

const float TAU = 6.2831853;

// weight of a colour centre: inverse square distance, scaled by how much of the sky it owns
float pull(vec2 p, vec2 c, float k) {
  vec2 d = p - c;
  return k / (dot(d, d) + 0.02);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res; // 0..1, y up
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = u_time;

  // c0: the night, wide in the middle; c1: deep navy low; c2: the glow, top left; c3: dawn bottom right
  vec2 p0 = vec2(aspect * (0.55 + 0.12 * sin(t * TAU / 24.0)), 0.55 + 0.08 * cos(t * TAU / 30.0));
  vec2 p1 = vec2(aspect * (0.35 + 0.10 * cos(t * TAU / 20.0)), 0.2 + 0.08 * sin(t * TAU / 26.0));
  vec2 p2 = vec2(aspect * (0.08 + 0.06 * cos(t * TAU / 28.0)), 1.02 + 0.05 * sin(t * TAU / 18.0));
  vec2 p3 = vec2(aspect * (0.95 + 0.05 * sin(t * TAU / 22.0)), -0.05 + 0.06 * cos(t * TAU / 27.0));

  float w0 = pull(p, p0, 1.0);
  float w1 = pull(p, p1, 0.7);
  float w2 = pull(p, p2, 0.12);
  float w3 = pull(p, p3, 0.05);
  vec3 col = (u_c0 * w0 + u_c1 * w1 + u_c2 * w2 + u_c3 * w3) / (w0 + w1 + w2 + w3);

  // the grain is a full-resolution CSS layer over the canvas (see the component), not drawn here:
  // at half resolution it read as a coarse weave
  gl_FragColor = vec4(col, 1.0);
}`;
