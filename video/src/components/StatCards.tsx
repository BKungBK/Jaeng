import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, EASE, enter, FONT, thaiWrap } from "../theme";

const fmt = (v: number) => Math.round(v).toLocaleString("en-US");

/** A number that counts up from 0 to `value` (always from measured-values.json). */
export const StatCard: React.FC<{
  value: number;
  unit: string;
  label: string;
  f: number;
  x: number;
  y: number;
  w?: number;
  big?: boolean;
  note?: string;
}> = ({ value, unit, label, f, x, y, w = 420, big, note }) => {
  const frame = useCurrentFrame();
  const p = enter(frame, f, 14);
  if (p <= 0) return null;
  const count = interpolate(frame, [f, f + 40], [0, value], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const done = frame >= f + 40;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        padding: "26px 32px",
        borderRadius: 28,
        background: C.glass,
        border: `2px solid ${C.glassEdge}`,
        fontFamily: FONT,
        opacity: p,
        translate: `0px ${(1 - p) * 30}px`,
        boxShadow: done ? "0 0 40px rgba(244,180,154,0.18)" : "none",
      }}
    >
      <div style={{ fontSize: 34, color: C.muted, fontWeight: 500, lineHeight: 1.4 }}>{thaiWrap(label)}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, fontVariantNumeric: "tabular-nums" }}>
        <span style={{ fontSize: big ? 120 : 84, fontWeight: 700, color: C.ink, lineHeight: 1.15 }}>{fmt(count)}</span>
        <span style={{ fontSize: 38, color: C.accent, fontWeight: 600 }}>{unit}</span>
      </div>
      {note ? <div style={{ fontSize: 28, color: C.faint, lineHeight: 1.4 }}>{thaiWrap(note)}</div> : null}
    </div>
  );
};

/** Test suites ticking one by one. */
export const SuiteList: React.FC<{ items: { text: string; f: number }[]; x: number; y: number }> = ({ items, x, y }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: x, top: y, display: "flex", flexDirection: "column", gap: 14, fontFamily: FONT }}>
      {items.map((it, i) => {
        const p = enter(frame, it.f, 12);
        if (p <= 0) return null;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40, fontWeight: 600, opacity: p, translate: `${(1 - p) * 30}px 0px` }}>
            <span
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: C.mint,
                color: C.onAccent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 30,
                scale: String(interpolate(frame, [it.f + 4, it.f + 10, it.f + 16], [0, 1.18, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })),
              }}
            >
              ✓
            </span>
            <span style={{ color: C.ink }}>{it.text}</span>
          </div>
        );
      })}
    </div>
  );
};

/** Raw samples falling onto an axis, with the median line glowing once they have landed. */
export const DotPlot: React.FC<{ samples: number[]; median: number; max: number; f: number; x: number; y: number; w: number }> = ({
  samples,
  median,
  max,
  f,
  x,
  y,
  w,
}) => {
  const frame = useCurrentFrame();
  if (!samples.length || frame < f) return null;
  const top = Math.max(max, ...samples) * 1.05;
  const sx = (v: number) => (v / top) * w;
  const settled = enter(frame, f + samples.length * 1.2 + 10, 20);
  return (
    <svg style={{ position: "absolute", left: x, top: y, overflow: "visible" }} width={w} height={140}>
      <line x1={0} y1={100} x2={w} y2={100} stroke={C.faint} strokeWidth={2} />
      {samples.map((v, i) => {
        const p = enter(frame, f + i * 1.2, 14);
        return <circle key={i} cx={sx(v)} cy={100 - 14 - (i % 5) * 12 - (1 - p) * 80} r={6} fill={C.mint} opacity={p * 0.85} />;
      })}
      <line x1={sx(median)} y1={10} x2={sx(median)} y2={110} stroke={C.accent} strokeWidth={4} opacity={settled} style={{ filter: `drop-shadow(0 0 ${8 + 6 * Math.sin(frame / 12)}px ${C.accent})` }} />
    </svg>
  );
};
