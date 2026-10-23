import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, DAWN, enter, FONT, SAFE, thaiWrap } from "../theme";
import thailand from "../data/thailand.json";

/** The app's line-art signal mark (apps/web/src/assets/icon/logo.svg), drawn stroke by stroke. */
export const Logo: React.FC<{ draw: number; size: number; x: number; y: number; glow?: number }> = ({ draw, size, x, y, glow = 0 }) => {
  const seg = (a: number, b: number) => interpolate(draw, [a, b], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const stroke = { fill: "none", stroke: C.onAccent, strokeWidth: 66, strokeLinecap: "round" as const, pathLength: 1, strokeDasharray: 1 };
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" style={{ position: "absolute", left: x - size / 2, top: y - size / 2, filter: `drop-shadow(0 0 ${40 * glow}px rgba(244,180,154,0.7))` }}>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#efd8bf" />
          <stop offset="0.52" stopColor="#dcae92" />
          <stop offset="1" stopColor="#bb9c94" />
        </linearGradient>
      </defs>
      <circle cx={512} cy={512} r={512 * interpolate(draw, [0, 0.25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} fill="url(#lg)" />
      <g transform="translate(512 512) scale(0.86) translate(-512 -512)">
        <circle cx={512} cy={330} r={150} {...stroke} strokeDashoffset={seg(0.2, 0.55)} />
        <path d="M512 262 L512 350" {...stroke} strokeDashoffset={seg(0.5, 0.62)} />
        <circle cx={512} cy={408} r={4} {...stroke} strokeDashoffset={seg(0.6, 0.65)} />
        <path d="M474 780 L376 456" {...stroke} strokeDashoffset={seg(0.55, 0.8)} />
        <path d="M550 780 L648 456" {...stroke} strokeDashoffset={seg(0.6, 0.85)} />
        <ellipse cx={512} cy={824} rx={92} ry={30} fill={C.onAccent} opacity={interpolate(draw, [0.8, 0.95], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      </g>
    </svg>
  );
};

/** Big section heading, top-left under the chip. */
export const Heading: React.FC<{ text: string; f: number; y?: number; size?: number }> = ({ text, f, y = 150, size = 72 }) => {
  const frame = useCurrentFrame();
  const p = enter(frame, f, 18);
  if (p <= 0) return null;
  return (
    <div style={{ position: "absolute", left: SAFE, top: y, fontFamily: FONT, opacity: p, translate: `0px ${(1 - p) * 24}px` }}>
      <div style={{ fontSize: size, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{thaiWrap(text)}</div>
      <div style={{ height: 8, width: 260 * p, borderRadius: 4, background: DAWN, marginTop: 10 }} />
    </div>
  );
};

/** Caption pill at the bottom: the latest key line of the scene. */
export const Caption: React.FC<{ items: { text: string; f: number }[]; bottom?: number }> = ({ items, bottom = 90 }) => {
  const frame = useCurrentFrame();
  const shown = items.filter((i) => frame >= i.f);
  if (!shown.length) return null;
  const cur = shown[shown.length - 1];
  const p = enter(frame, cur.f, 14);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom, display: "flex", justifyContent: "center", fontFamily: FONT }}>
      <div
        style={{
          maxWidth: 1500,
          padding: "16px 40px",
          borderRadius: 40,
          background: C.glassDense,
          border: `2px solid ${C.glassEdge}`,
          fontSize: 48,
          fontWeight: 600,
          color: C.ink,
          lineHeight: 1.4,
          textAlign: "center",
          opacity: p,
          scale: String(0.96 + 0.04 * p),
        }}
      >
        {thaiWrap(cur.text)}
      </div>
    </div>
  );
};

/** Frosted card. */
export const Glass: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
  <div
    style={{
      position: "absolute",
      borderRadius: 30,
      background: C.glass,
      border: `2px solid ${C.glassEdge}`,
      boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      fontFamily: FONT,
      ...style,
    }}
  >
    {children}
  </div>
);

type Province = { code: string; name: string; region: string; d: string; cx: number; cy: number };
const TH = thailand as { w: number; h: number; provinces: Province[] };
const cel = (p: Province) => {
  if (p.region === "isan") return "#F9CDA2";
  const fy = p.cy / TH.h;
  const fx = p.cx / TH.w;
  if (fy < 0.3) return "#B4DCAB";
  if (fy > 0.6) return "#DAEBA8";
  if (fx < 0.36) return "#D0C4EF";
  if (fx > 0.5 && fy > 0.42) return "#F3C3D0";
  return "#F5E7B2";
};
export const provinceAt = (code: string) => {
  const p = TH.provinces.find((q) => q.code === code)!;
  return { x: p.cx, y: p.cy };
};
export const MAP_W = TH.w;
export const MAP_H = TH.h;

/** Toy Thailand in the app's cel colours (provinces from apps/web/src/assets/geo/provinces.json). */
export const ThaiMap: React.FC<{ reveal: number; height: number; children?: React.ReactNode }> = ({ reveal, height, children }) => {
  const s = height / TH.h;
  return (
    <div style={{ position: "relative", width: TH.w * s, height }}>
      <svg width={TH.w * s} height={height} viewBox={`0 0 ${TH.w} ${TH.h}`}>
        {TH.provinces.map((p) => {
          const o = interpolate(reveal, [p.cy / TH.h * 0.7, p.cy / TH.h * 0.7 + 0.3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return <path key={p.code} d={p.d} fill={cel(p)} fillOpacity={0.9 * o} stroke="#FBF0D2" strokeOpacity={0.55 * o} strokeWidth={1.4} />;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, scale: String(s), transformOrigin: "0 0", width: TH.w, height: TH.h }}>{children}</div>
    </div>
  );
};
