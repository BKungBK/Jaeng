import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Glass, Heading } from "../components/Bits";
import { C, DAWN, EASE, enter, FONT, SAFE, thaiWrap } from "../theme";
import { beats, first, type SceneProps } from "./util";

/** 7 การสร้างระบบ: six phases light up on a timeline, then three challenge cards flip to their fixes. */
export const Build: React.FC<SceneProps> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phases = beats(s, "phase");
  const title = first(s, "title");
  const cards = beats(s, "card");
  const fixes = beats(s, "cardfix");
  const n = phases.length;
  const x0 = SAFE + 60;
  const span = 1920 - 2 * x0;
  const lit = phases.filter((p) => frame >= p.f).length;
  const lineP = n > 1 ? interpolate(frame, phases.map((p) => p.f), phases.map((_, i) => i / (n - 1)), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE }) : 0;
  const pulse = 0.5 + 0.5 * Math.sin((frame / (1.6 * fps)) * Math.PI * 2);
  const ty = title ? interpolate(frame, [title.f, title.f + 24], [330, 220], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE }) : 330;
  return (
    <>
      {/* timeline */}
      <div style={{ position: "absolute", left: x0, top: ty, width: span, height: 6, borderRadius: 3, background: "rgba(255,245,235,0.12)" }}>
        <div style={{ width: span * lineP, height: 6, borderRadius: 3, background: DAWN }} />
      </div>
      {phases.map((p, i) => {
        const x = x0 + (n > 1 ? (span * i) / (n - 1) : 0);
        const on = enter(frame, p.f, 12);
        const isCur = i === lit - 1;
        return (
          <div key={p.id} style={{ position: "absolute", left: x, top: ty + 3, fontFamily: FONT }}>
            <div
              style={{
                position: "absolute",
                left: -18,
                top: -18,
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: on > 0 ? C.accent : C.nightLine,
                boxShadow: isCur ? `0 0 ${16 + 18 * pulse}px ${C.accent}` : "none",
                scale: String(0.6 + 0.4 * on),
              }}
            />
            <div style={{ position: "absolute", left: -150, width: 300, top: 36, textAlign: "center", fontSize: 40, fontWeight: 600, color: C.ink, opacity: 0.3 + 0.7 * on, lineHeight: 1.3 }}>
              {thaiWrap(p.text ?? "")}
            </div>
          </div>
        );
      })}
      {title ? <Heading text={title.text ?? ""} f={title.f} y={420} size={60} /> : null}
      {cards.map((c, i) => {
        const fix = fixes[i];
        const p = enter(frame, c.f, 18);
        const flip = fix ? interpolate(frame, [fix.f, fix.f + 18], [0, 180], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE }) : 0;
        const x = SAFE + i * 590;
        const face: React.CSSProperties = { position: "absolute", inset: 0, padding: 32, backfaceVisibility: "hidden", borderRadius: 30, display: "flex", flexDirection: "column", gap: 16 };
        if (p <= 0) return null;
        return (
          <div key={c.id} style={{ position: "absolute", left: x, top: 560, width: 548, height: 340, perspective: 1400, opacity: p, translate: `0px ${(1 - p) * 40}px` }}>
            <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", rotate: `y ${flip}deg` }}>
              <Glass style={{ ...face, border: `2px solid ${C.peach}` }}>
                <div style={{ fontSize: 34, color: C.peach, fontWeight: 700 }}>ปัญหา {i + 1}</div>
                <div style={{ fontSize: 46, color: C.ink, fontWeight: 600, lineHeight: 1.4 }}>{thaiWrap(c.text ?? "")}</div>
              </Glass>
              <Glass style={{ ...face, rotate: "y 180deg", border: `2px solid ${C.mint}` }}>
                <div style={{ fontSize: 34, color: C.mint, fontWeight: 700 }}>✓ แก้แล้ว</div>
                <div style={{ fontSize: 46, color: C.ink, fontWeight: 600, lineHeight: 1.4 }}>{thaiWrap(fix?.text ?? "")}</div>
              </Glass>
            </div>
          </div>
        );
      })}
    </>
  );
};
