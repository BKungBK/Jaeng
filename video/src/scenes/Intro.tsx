import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Beam } from "../components/Beam";
import { Glass, Logo } from "../components/Bits";
import { C, DAWN, enter, FONT } from "../theme";
import { first, type SceneProps } from "./util";

/** 1 แนะนำตัว: the mark draws itself, the name slides in, beams rise around the title and keep pulsing. */
export const Intro: React.FC<SceneProps> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lower = first(s, "lower");
  const title = first(s, "title");
  const draw = enter(frame, 0, 2.2 * fps);
  const glow = 0.5 + 0.5 * Math.sin((frame / (3 * fps)) * Math.PI * 2);
  const tp = title ? enter(frame, title.f, 22) : 0;
  const lp = lower ? enter(frame, lower.f, 20) : 0;
  const beams: { x: number; level: 0 | 1 | 2 | 3; n: number; d: number }[] = [
    { x: 250, level: 0, n: 3, d: 0 },
    { x: 470, level: 1, n: 10, d: 5 },
    { x: 1450, level: 2, n: 10, d: 10 },
    { x: 1670, level: 3, n: 40, d: 15 },
  ];
  return (
    <>
      {beams.map((b, i) => (
        <Beam key={i} x={b.x} y={900} level={b.level} n={b.n} scale={1.4} rise={title ? enter(frame, title.f + b.d, 26) : 0} />
      ))}
      <Logo draw={draw} size={300} x={960} y={330 - 40 * tp} glow={draw >= 1 ? glow : 0} />
      {title ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 520, textAlign: "center", fontFamily: FONT, opacity: tp, translate: `0px ${(1 - tp) * 30}px` }}>
          <div style={{ fontSize: 120, fontWeight: 700, lineHeight: 1.25, background: DAWN, WebkitBackgroundClip: "text", color: "transparent" }}>
            {title.text}
          </div>
          <div style={{ fontSize: 46, color: C.muted, fontWeight: 500 }}>{title.sub}</div>
        </div>
      ) : null}
      {lower ? (
        <Glass style={{ left: "50%", marginLeft: -330, width: 660, textAlign: "center", bottom: 90, padding: "22px 36px", opacity: lp, translate: `${(1 - lp) * -60}px 0px` }}>
          <div style={{ fontSize: 52, fontWeight: 700, color: C.ink, lineHeight: 1.35 }}>{lower.text}</div>
          <div style={{ fontSize: 36, color: C.accent, fontWeight: 500 }}>{lower.sub}</div>
        </Glass>
      ) : null}
    </>
  );
};
