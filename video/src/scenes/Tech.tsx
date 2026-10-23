import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Beam } from "../components/Beam";
import { Glass, Heading } from "../components/Bits";
import { StatCard } from "../components/StatCards";
import { C, enter, FONT, SAFE, thaiWrap } from "../theme";
import { beats, first, type SceneProps } from "./util";
import type { LocalBeat } from "../data";

const TechCard: React.FC<{ b: LocalBeat; x: number; y: number; w: number }> = ({ b, x, y, w }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - b.f, fps, config: { damping: 12, stiffness: 170 } });
  const sub = enter(frame, b.f + 8, 14);
  const float = Math.sin((frame + b.f * 7) / (2.4 * fps)) * 4; // loop: icons float gently
  if (frame < b.f) return null;
  return (
    <Glass style={{ left: x, top: y + float, width: w, padding: "18px 28px", opacity: Math.min(1, pop * 1.4), scale: String(0.85 + 0.15 * pop) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 54, height: 54, borderRadius: 16, background: `linear-gradient(135deg, ${C.dawn1}, ${C.dawn3})`, color: C.onAccent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 700 }}>
          {(b.text ?? "?").slice(0, 1)}
        </div>
        <div style={{ fontSize: 46, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{b.text}</div>
      </div>
      {b.sub ? <div style={{ fontSize: 40, color: C.muted, lineHeight: 1.4, opacity: sub, translate: `${(1 - sub) * 20}px 0px` }}>{thaiWrap(b.sub)}</div> : null}
    </Glass>
  );
};

const Principle: React.FC<{ b: LocalBeat; i: number; levels?: LocalBeat }> = ({ b, i, levels }) => {
  const frame = useCurrentFrame();
  const p = enter(frame, b.f, 18);
  if (p <= 0) return null;
  const x = SAFE + i * 590;
  return (
    <Glass style={{ left: x, top: 300, width: 548, height: 620, padding: 32, opacity: p, translate: `0px ${(1 - p) * 40}px` }}>
      <div style={{ fontSize: 52, fontWeight: 700, color: C.accent, lineHeight: 1.3 }}>{b.text}</div>
      <div style={{ fontSize: 40, color: C.ink, lineHeight: 1.4, marginTop: 8 }}>{thaiWrap(b.sub ?? "")}</div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 30, height: 300 }}>
        {i === 0 ? (
          // Hick: 8 big category icons, then 3 steps
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 84px)", gap: 22, justifyContent: "center", marginTop: 20 }}>
            {Array.from({ length: 8 }, (_, k) => (
              <div key={k} style={{ width: 84, height: 84, borderRadius: 24, background: C.glassDense, border: `2px solid ${C.glassEdge}`, opacity: enter(frame, b.f + 10 + k * 4, 10) }} />
            ))}
          </div>
        ) : i === 1 ? (
          // Fitts: phone outline with the report button under the thumb
          <svg width={548} height={300}>
            <rect x={194} y={10} width={160} height={280} rx={26} fill="none" stroke={C.faint} strokeWidth={4} />
            <circle cx={318} cy={244} r={26 * enter(frame, b.f + 10, 16)} fill={C.accent} />
            <path d="M 420 300 Q 360 250 330 250" fill="none" stroke={C.muted} strokeWidth={4} strokeDasharray="8 8" strokeDashoffset={-frame * 0.6} opacity={enter(frame, b.f + 20, 16)} />
          </svg>
        ) : (
          // WCAG: four beams with colour + shape + pulse
          [0, 1, 2, 3].map((lv) => (
            <Beam key={lv} x={110 + lv * 110} y={230} level={lv as 0 | 1 | 2 | 3} n={[1, 3, 10, 40][lv]} scale={0.8} rise={levels ? enter(frame, levels.f + lv * 5, 20) : enter(frame, b.f + 10 + lv * 5, 20)} />
          ))
        )}
      </div>
    </Glass>
  );
};

/** 5 อุปกรณ์และทฤษฎี: the stack in three groups (reason under each name), the measured API card, then 3 design principles. */
export const Tech: React.FC<SceneProps> = ({ s }) => {
  const frame = useCurrentFrame();
  const all = beats(s);
  const titles = beats(s, "title");
  const principlesTitle = titles[1];
  const groups = beats(s, "group");
  const stat = first(s, "stat");
  const levels = first(s, "beam:levels4");
  const principles = beats(s, "principle");
  // tech cards belong to the group announced before them
  const byGroup: LocalBeat[][] = groups.map(() => []);
  let g = -1;
  for (const b of all) {
    if (b.kind === "group") g++;
    if (b.kind === "tech" && g >= 0) byGroup[g].push(b);
  }
  const gi = groups.reduce((acc, b, i) => (frame >= b.f ? i : acc), -1);
  const phaseB = principlesTitle ? enter(frame, principlesTitle.f, 16) : 0;
  return (
    <>
      <div style={{ opacity: 1 - phaseB }}>
        {titles[0] ? <Heading text={titles[0].text ?? ""} f={titles[0].f} size={60} y={130} /> : null}
        {/* finished groups shrink into a strip of names */}
        <div style={{ position: "absolute", left: SAFE + 560, top: 150, display: "flex", gap: 14, flexWrap: "wrap", width: 1200, fontFamily: FONT }}>
          {groups.map((grp, i) =>
            i < gi ? (
              <div key={grp.id} style={{ fontSize: 30, padding: "6px 18px", borderRadius: 20, background: C.glass, border: `2px solid ${C.glassEdge}`, color: C.muted, opacity: enter(frame, groups[i + 1].f, 16) }}>
                {grp.text}: {byGroup[i].map((t) => t.text).join(" · ")}
              </div>
            ) : null,
          )}
        </div>
        {gi >= 0 ? (
          <>
            <div key={groups[gi].id} style={{ position: "absolute", left: SAFE, top: 250, fontFamily: FONT, fontSize: 52, fontWeight: 700, color: C.accent, opacity: enter(frame, groups[gi].f, 14) }}>
              {groups[gi].text}
            </div>
            {byGroup[gi].map((b, i) => (
              <TechCard key={b.id} b={b} x={SAFE + (i % 2) * 880} y={340 + Math.floor(i / 2) * 170} w={840} />
            ))}
          </>
        ) : null}
        {stat && stat.value && gi === 1 ? (
          <StatCard value={stat.value.value} unit={stat.value.unit} label={stat.text ?? ""} note={stat.sub} f={stat.f} x={1360} y={680} w={460} />
        ) : null}
      </div>
      {principlesTitle ? (
        <div style={{ opacity: phaseB }}>
          <Heading text={principlesTitle.text ?? ""} f={principlesTitle.f} size={60} y={130} />
          {principles.map((b, i) => (
            <Principle key={b.id} b={b} i={i} levels={i === 2 ? levels : undefined} />
          ))}
          {levels ? (
            <div style={{ position: "absolute", left: SAFE, top: 960, fontFamily: FONT, fontSize: 44, fontWeight: 600, color: C.ink, opacity: enter(frame, levels.f, 14) }}>
              {levels.text}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
};
