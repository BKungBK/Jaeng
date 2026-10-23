import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { DIAGRAM_SVG } from "../data/diagramSvg";

export const DIAGRAM_IDS = [
  "step-1-users",
  "arrow-1",
  "caddy",
  "arrow-2",
  "web",
  "arrow-3-write",
  "elysia",
  "arrow-4-read",
  "arrow-5-write",
  "supabase",
  "step-6-approve",
  "resend",
  "docker",
] as const;

type Pt = [number, number];
type Seg = { line: [Pt, Pt] } | { cubic: [Pt, Pt, Pt, Pt] };
// Geometry copied from docs/video/diagram-system.svg so packets ride the drawn arrows.
const SEG: Record<string, Seg> = {
  "arrow-1": { line: [[404, 540], [518, 540]] },
  "arrow-2": { cubic: [[700, 446], [700, 300], [780, 255], [916, 255]] },
  "arrow-3-write": { cubic: [[700, 634], [700, 780], [780, 805], [916, 805]] },
  "arrow-4-read": { line: [[804, 540], [1428, 540]] },
  "arrow-5-write": { line: [[1334, 820], [1428, 820]] },
  "step-6-approve": { line: [[1560, 704], [1740, 704]] },
  resend: { line: [[1650, 960], [1650, 1040]] },
};
const ROUTES = {
  read: { color: C.mint, segs: ["arrow-1", "arrow-4-read"] },
  write: { color: C.accent, segs: ["arrow-1", "arrow-3-write", "arrow-5-write"] },
  web: { color: C.ink, segs: ["arrow-1", "arrow-2"] },
  photo: { color: C.accent, segs: ["step-6-approve"] },
  email: { color: C.accent, segs: ["resend"] },
} as const;
export type Flow = { kind: keyof typeof ROUTES; from: number };

const at = (s: Seg, t: number): Pt => {
  if ("line" in s) {
    const [a, b] = s.line;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  const [p0, p1, p2, p3] = s.cubic;
  const u = 1 - t;
  const f = (i: 0 | 1) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i];
  return [f(0), f(1)];
};

type Props = {
  /** ids lit right now */
  focus: string[];
  /** 0..1: how strongly everything not in focus is dimmed */
  dim: number;
  /** 0..1 fade-in of the whole drawing */
  reveal: number;
  /** packet streams that run from a frame on and loop until the scene ends */
  flows?: Flow[];
};

/** The system drawing (docs/video/diagram-system.svg) lit group by group, with packets on the arrows. */
export const Diagram: React.FC<Props> = ({ focus, dim, reveal, flows = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const css = DIAGRAM_IDS.map((id) => {
    const on = focus.includes(id);
    const o = on ? 1 : 1 - 0.72 * dim;
    const glow = on && dim > 0 ? `filter: drop-shadow(0 0 18px rgba(244,180,154,${0.55 * dim}));` : "";
    return `#dg #${id}{opacity:${o.toFixed(3)};${glow}}`;
  }).join("");
  const period = 1.6 * fps; // one packet trip; loops land on whole periods
  return (
    <div id="dg" style={{ position: "absolute", inset: 0, opacity: reveal }}>
      <style>{css}</style>
      <div style={{ position: "absolute", inset: 0 }} dangerouslySetInnerHTML={{ __html: DIAGRAM_SVG }} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {flows.map((fl, i) => {
          if (frame < fl.from) return null;
          const r = ROUTES[fl.kind];
          return [0, 0.33, 0.66].map((off, j) => {
            const p = ((frame - fl.from) / period + off) % 1;
            const k = Math.min(r.segs.length - 1, Math.floor(p * r.segs.length));
            const local = p * r.segs.length - k;
            const [x, y] = at(SEG[r.segs[k]], local);
            const fade = Math.min(1, (frame - fl.from) / 12);
            return <circle key={`${i}-${j}`} cx={x} cy={y} r={11} fill={r.color} opacity={0.95 * fade} style={{ filter: `drop-shadow(0 0 8px ${r.color})` }} />;
          });
        })}
      </svg>
    </div>
  );
};
