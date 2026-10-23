import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { beamHeight, C, FONT, LEVELS } from "../theme";

export type BeamState = "open" | "pending" | "resolved";
type Props = {
  level: 0 | 1 | 2 | 3;
  /** "เจอเหมือนกัน" count: drives the height (min(260, 60 + 36 log2(1 + n))) */
  n?: number;
  state?: BeamState;
  /** 0..1 rise-in */
  rise?: number;
  x: number;
  y: number;
  scale?: number;
  label?: string;
};

/** A report beam as the app draws it: colour + shape per level, pulse period per level, 1 or 2 rings. */
export const Beam: React.FC<Props> = ({ level, n = 0, state = "open", rise = 1, x, y, scale = 1, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = LEVELS[level];
  const h = beamHeight(n) * scale * rise;
  const w = 20 * scale;
  const period = L.period * fps;
  const rings = level >= 2 ? [0, 0.5] : [0];
  const pending = state === "pending";
  const resolved = state === "resolved";
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, fontFamily: FONT }}>
      {/* pulse rings on the ground */}
      {!resolved &&
        rings.map((off, i) => {
          const p = (((frame / period + off) % 1) + 1) % 1;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: -(18 + 60 * p) * scale,
                top: -(6 + 20 * p) * scale,
                width: (36 + 120 * p) * scale,
                height: (12 + 40 * p) * scale,
                borderRadius: "50%",
                border: `${3 * scale}px solid ${L.color}`,
                opacity: (1 - p) * 0.8 * rise * (pending ? 0.5 : 1),
              }}
            />
          );
        })}
      {/* the column of light */}
      {!resolved && (
        <div
          style={{
            position: "absolute",
            left: -w / 2,
            top: -h,
            width: w,
            height: h,
            borderRadius: w / 2,
            background: pending
              ? "transparent"
              : `linear-gradient(0deg, ${L.color} 0%, ${L.color}CC 45%, ${L.color}00 100%)`,
            border: pending ? `${3 * scale}px dashed ${L.color}` : "none",
            boxShadow: pending ? "none" : `0 0 ${28 * scale}px ${L.color}88`,
            opacity: pending ? 0.75 : 1,
          }}
        />
      )}
      {/* base dot / resolved check */}
      <div
        style={{
          position: "absolute",
          left: -14 * scale,
          top: -14 * scale,
          width: 28 * scale,
          height: 28 * scale,
          borderRadius: "50%",
          background: resolved ? C.mint : L.color,
          color: C.onAccent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18 * scale,
          fontWeight: 700,
          opacity: rise,
        }}
      >
        {resolved ? "✓" : L.shape}
      </div>
      {label ? (
        <div
          style={{
            position: "absolute",
            left: -160,
            width: 320,
            top: 26 * scale,
            textAlign: "center",
            fontSize: 32,
            fontWeight: 600,
            color: C.ink,
            opacity: rise,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};
