import { Easing, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Anuphan";

// DESIGN.md: "toy Thailand at night-into-dawn"
export const { fontFamily: FONT } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
});

export const C = {
  night: "#0F1F44",
  nightSurface: "#1B2A52",
  nightLine: "#2F3D66",
  ink: "#F2EDE6",
  muted: "#DAD1C5",
  faint: "#B9B5CC",
  accent: "#F4B49A",
  onAccent: "#2E231C",
  glass: "rgba(255, 245, 235, 0.10)",
  glassDense: "rgba(255, 245, 235, 0.14)",
  glassEdge: "rgba(255, 240, 224, 0.22)",
  dawn1: "#FFE3C4",
  dawn2: "#F4B49A",
  dawn3: "#C9A0DC",
  mint: "#8FD3B6",
  butter: "#F6D983",
  peach: "#F4A582",
  rose: "#E57373",
  sea: "#1F5A6E",
};
export const DAWN = `linear-gradient(90deg, ${C.dawn1}, ${C.dawn2} 50%, ${C.dawn3})`;

// apps/web/src/app/core/motion.ts: EASE = cubic-bezier(0.2, 0.8, 0.2, 1)
export const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
export const SAFE = 96;

// Beam spec (design doc, condensed in the prompt)
export const LEVELS = [
  { color: C.mint, shape: "●", label: "ทั่วไป", period: 3 },
  { color: C.butter, shape: "▲", label: "ควรระวัง", period: 2.4 },
  { color: C.peach, shape: "◆", label: "อันตราย", period: 1.6 },
  { color: C.rose, shape: "⚠", label: "วิกฤต", period: 1 },
] as const;
export const beamHeight = (n: number) => Math.min(260, 60 + 36 * Math.log2(1 + n));

/** 0..1 progress of an entrance that starts at frame `at` and lasts `dur` frames. */
export const enter = (frame: number, at: number, dur = 18) =>
  interpolate(frame, [at, at + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });

/** Thai text with zero-width spaces at word boundaries so lines break between words, never inside one. */
const seg = new Intl.Segmenter("th", { granularity: "word" });
export const thaiWrap = (s: string) =>
  Array.from(seg.segment(s))
    .map((p) => p.segment)
    .join("​");
