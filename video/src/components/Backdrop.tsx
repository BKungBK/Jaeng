import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { C, DAWN, FONT, SAFE } from "../theme";

type Props = {
  /** 0..1 over the whole clip: the sky turns from night to dawn as the story moves on */
  progress: number;
  chip?: string;
  title?: string;
  children?: React.ReactNode;
};

const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: random(`sx${i}`) * 1920,
  y: random(`sy${i}`) * 760,
  r: 0.8 + random(`sr${i}`) * 1.8,
  p: 90 + random(`sp${i}`) * 150,
  o: random(`so${i}`) * Math.PI * 2,
}));

/** Night-to-dawn sky, section chip and the clip progress bar. */
export const Backdrop: React.FC<Props> = ({ progress, chip, title, children }) => {
  const frame = useCurrentFrame();
  const glow = 0.18 + 0.62 * progress;
  return (
    <AbsoluteFill style={{ background: C.night, fontFamily: FONT, color: C.ink }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 70% at 50% 118%, rgba(244,180,154,${glow}) 0%, rgba(201,160,220,${glow * 0.55}) 38%, rgba(15,31,68,0) 72%)`,
        }}
      />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, #0B1838 0%, rgba(15,31,68,0) 55%)` }} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill={C.ink}
            opacity={(1 - progress * 0.7) * (0.35 + 0.35 * Math.sin((frame / s.p) * Math.PI * 2 + s.o))}
          />
        ))}
      </svg>
      {children}
      {chip ? (
        <div
          style={{
            position: "absolute",
            left: SAFE,
            top: 56,
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 30,
            fontWeight: 500,
            color: C.muted,
            background: "rgba(15,31,68,0.55)",
            borderRadius: 24,
            padding: "4px 20px 4px 4px",
          }}
        >
          <span
            style={{
              background: DAWN,
              color: C.onAccent,
              borderRadius: 18,
              padding: "4px 18px",
              fontWeight: 700,
            }}
          >
            {chip}
          </span>
          {title}
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 6, width: 1920, background: "rgba(255,245,235,0.08)" }}>
        <div
          style={{
            height: 6,
            width: interpolate(progress, [0, 1], [0, 1920]),
            background: DAWN,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
