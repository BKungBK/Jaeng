import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Beam } from "../components/Beam";
import { Heading, Logo } from "../components/Bits";
import { StepList } from "../components/StepList";
import { C, DAWN, enter, FONT, SAFE, thaiWrap } from "../theme";
import { beats, first, type SceneProps } from "./util";

const ColumnHead: React.FC<{ text: string; f: number; x: number; y: number; color: string }> = ({ text, f, x, y, color }) => {
  const frame = useCurrentFrame();
  const p = enter(frame, f, 16);
  if (p <= 0) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, fontFamily: FONT, opacity: p }}>
      <div style={{ fontSize: 58, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{text}</div>
      <div style={{ height: 6, width: 180 * p, borderRadius: 3, background: color, marginTop: 6 }} />
    </div>
  );
};

/** 3 วัตถุประสงค์: five goals, numbered, each confirmed with a spring as it is said. */
export const Objectives: React.FC<SceneProps> = ({ s }) => {
  const title = first(s, "title");
  const items = beats(s, "done");
  return (
    <>
      {title ? <Heading text={title.text ?? ""} f={title.f} /> : null}
      <StepList x={SAFE + 20} y={330} width={1700} fontSize={50} gap={30} items={items.map((b, i) => ({ text: b.text ?? "", sub: b.sub, f: b.f, mark: "num", num: i + 1 }))} />
    </>
  );
};

/** 4 ขอบเขต and 10 ข้อจำกัด: two columns (done / not yet, or limits / safeguards). */
export const TwoColumns: React.FC<SceneProps & { leftKinds: string[]; rightKinds: string[]; leftMark: "check" | "warn"; rightMark: "dash" | "shield" }> = ({
  s,
  leftKinds,
  rightKinds,
  leftMark,
  rightMark,
}) => {
  const frame = useCurrentFrame();
  const titles = beats(s, "title");
  const left = beats(s, ...leftKinds);
  const right = beats(s, ...rightKinds);
  const chips = beats(s, "chip");
  // with only the right column left (cuts can drop a column), it takes the left place
  const leftHead = left.length ? titles[0] : undefined;
  const rightHead = left.length ? titles[1] : titles[0];
  const rx = left.length ? 1000 : SAFE + 20;
  return (
    <>
      {leftHead ? <ColumnHead text={leftHead.text ?? ""} f={leftHead.f} x={SAFE + 20} y={170} color={leftMark === "check" ? C.mint : C.peach} /> : null}
      {rightHead ? <ColumnHead text={rightHead.text ?? ""} f={rightHead.f} x={rx} y={170} color={rightMark === "dash" ? C.faint : C.mint} /> : null}
      <StepList x={SAFE + 20} y={320} width={840} fontSize={42} gap={24} items={left.map((b) => ({ text: b.text ?? "", f: b.f, mark: leftMark, color: leftMark === "warn" ? C.peach : C.mint }))} />
      <StepList x={rx} y={320} width={840} fontSize={42} gap={24} items={right.map((b) => ({ text: b.text ?? "", f: b.f, mark: rightMark }))} />
      <div style={{ position: "absolute", left: SAFE + 20, top: 320 + left.length * 86 + 20, display: "flex", gap: 18, fontFamily: FONT }}>
        {chips.map((c) => {
          const p = enter(frame, c.f, 14);
          return (
            <div key={c.id} style={{ fontSize: 40, fontWeight: 600, padding: "8px 26px", borderRadius: 30, background: C.glassDense, border: `2px solid ${C.glassEdge}`, color: C.ink, opacity: p, scale: String(0.9 + 0.1 * p) }}>
              {c.text}
            </div>
          );
        })}
      </div>
    </>
  );
};

/** 11 สรุป: a new beam in the middle, the summary and next steps, then the mark closes the clip. */
export const Conclusion: React.FC<SceneProps> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titles = beats(s, "title");
  const done = beats(s, "done");
  const next = beats(s, "next");
  const end = first(s, "logo");
  const out = end ? interpolate(frame, [end.f - 6, end.f + 14], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const ep = end ? enter(frame, end.f, 30) : 0;
  return (
    <>
      <div style={{ opacity: out }}>
        <Beam x={1700} y={900} level={0} n={40} scale={1.4} rise={enter(frame, 0, fps)} />
        {titles[0] ? <ColumnHead text={titles[0].text ?? ""} f={titles[0].f} x={SAFE + 20} y={170} color={C.mint} /> : null}
        {titles[1] ? <ColumnHead text={titles[1].text ?? ""} f={titles[1].f} x={980} y={170} color={C.accent} /> : null}
        <StepList x={SAFE + 20} y={320} width={820} fontSize={42} items={done.map((b) => ({ text: b.text ?? "", f: b.f, mark: "check" }))} />
        <StepList x={980} y={320} width={620} fontSize={42} items={next.map((b) => ({ text: b.text ?? "", f: b.f, mark: "dot", color: C.accent }))} />
      </div>
      {end ? (
        <>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(70% 60% at 50% 60%, rgba(255,227,196,${0.35 * ep}), rgba(15,31,68,0) 70%)` }} />
          <Logo draw={ep} size={260} x={960} y={420} glow={ep} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 600, textAlign: "center", fontFamily: FONT, opacity: ep }}>
            <div style={{ fontSize: 96, fontWeight: 700, background: DAWN, WebkitBackgroundClip: "text", color: "transparent", lineHeight: 1.3 }}>{thaiWrap(end.text ?? "")}</div>
            <div style={{ fontSize: 40, color: C.muted }}>แจ้ง · Jaeng</div>
          </div>
        </>
      ) : null}
    </>
  );
};
