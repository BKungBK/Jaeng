import React from "react";
import { Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Beam, type BeamState } from "../components/Beam";
import { Caption, Glass } from "../components/Bits";
import { DeviceFrame, SHOTS } from "../components/DeviceFrame";
import { StepList } from "../components/StepList";
import { C, DAWN, EASE, enter, FONT, LEVELS, thaiWrap } from "../theme";
import type { LocalBeat } from "../data";
import { beats, first, latest, SHOT_DEVICE, type SceneProps } from "./util";

/** 8 หลักการทำงาน (intro to the demo). */
export const DemoIntro: React.FC<SceneProps> = ({ s }) => {
  const frame = useCurrentFrame();
  const title = first(s, "title");
  const cap = beats(s, "caption");
  const p = title ? enter(frame, title.f, 20) : 0;
  return (
    <>
      {title ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 380, textAlign: "center", fontFamily: FONT, opacity: p, scale: String(0.94 + 0.06 * p) }}>
          <div style={{ fontSize: 110, fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{title.text}</div>
          <div style={{ height: 10, width: 320 * p, borderRadius: 5, background: DAWN, margin: "14px auto 0" }} />
        </div>
      ) : null}
      <Caption items={cap.map((c) => ({ text: c.text ?? "", f: c.f }))} bottom={330} />
    </>
  );
};

const VISUAL = ["beam:levels4", "beam:states3", "beam:height", "beam:rise", "beam:grow", "beam:fade", "beam:check", "alert", "roles"];
const STEP = ["step", "caption", "chip", "role", "level", "state", "theme", "shotfocus", "title"];

/** The panel picture that goes with what is being said (beam rules, alerts, roles). */
const Visual: React.FC<{ v: LocalBeat; s: LocalBeat[]; w: number }> = ({ v, s, w }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - v.f;
  const p = enter(frame, v.f, 16);
  const cx = w / 2;
  const after = (k: string) => s.filter((b) => b.kind === k && b.f >= v.f);
  let body: React.ReactNode = null;
  if (v.kind === "beam:levels4") {
    const lv = after("level");
    body = [0, 1, 2, 3].map((i) => (
      <Beam key={i} x={w * (0.14 + i * 0.24)} y={300} level={i as 0 | 1 | 2 | 3} n={[1, 3, 10, 40][i]} scale={0.9} rise={lv[i] ? enter(frame, lv[i].f, 18) : enter(frame, v.f + i * 6, 18)} label={LEVELS[i].label} />
    ));
  } else if (v.kind === "beam:states3") {
    const st = after("state");
    const states: BeamState[] = ["open", "pending", "resolved"];
    body = states.map((k, i) => (
      <Beam key={k} x={w * (0.2 + i * 0.3)} y={300} level={2} n={10} state={k} scale={1} rise={st[i] ? enter(frame, st[i].f, 18) : 0} label={["เปิด", "รอตรวจแก้", "แก้แล้ว"][i]} />
    ));
  } else if (v.kind === "beam:height") {
    const n = Math.round(interpolate(t, [0, 2.5 * fps], [0, 40], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
    body = (
      <>
        <Beam x={cx} y={320} level={1} n={n} scale={1.1} rise={p} />
        <div style={{ position: "absolute", left: cx + 60, top: 120, fontSize: 52, fontWeight: 700, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{n} คน</div>
      </>
    );
  } else if (v.kind.startsWith("beam:")) {
    const state: BeamState = v.kind === "beam:fade" ? "pending" : v.kind === "beam:check" ? "resolved" : "open";
    const n = v.kind === "beam:grow" ? (t > 10 ? 4 : 3) : 3;
    const rise = v.kind === "beam:rise" ? enter(frame, v.f, 30) : 1;
    body = <Beam x={cx} y={320} level={2} n={n} state={state} scale={1.3} rise={rise * p + (1 - p) * 0} />;
  } else if (v.kind === "alert") {
    body = (
      <Glass style={{ left: 20, top: 40, width: w - 40, padding: 28, border: `3px solid ${C.rose}`, background: "rgba(229,115,115,0.14)" }}>
        <div style={{ fontSize: 44, fontWeight: 700, color: C.rose }}>⚠ {thaiWrap(v.text ?? "")}</div>
      </Glass>
    );
  } else if (v.kind === "roles") {
    body = after("role").map((r, i) => (
      <Glass key={r.id} style={{ left: 0, top: 10 + i * 140, width: w, padding: "14px 24px", opacity: enter(frame, r.f, 14) }}>
        <div style={{ fontSize: 40, fontWeight: 600, color: C.ink }}>{thaiWrap(r.text ?? "")}</div>
      </Glass>
    ));
  }
  return <div style={{ position: "absolute", inset: 0, opacity: p, fontFamily: FONT }}>{body}</div>;
};

/** A1: the real email (cropped from the owner's screenshot: sender, subject, code only), the code zooms in. */
const EmailCard: React.FC<{ f: number; until: number }> = ({ f, until }) => {
  const frame = useCurrentFrame();
  const p = enter(frame, f, 16) * (1 - enter(frame, until - 12, 12));
  if (p <= 0) return null;
  const zoom = interpolate(frame, [f + 30, f + 90], [1, 1.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  return (
    <div style={{ position: "absolute", left: 160, top: 300, width: 1040, opacity: p, translate: `0px ${(1 - p) * 30}px`, fontFamily: FONT }}>
      <div style={{ borderRadius: 24, overflow: "hidden", background: "#fff", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", border: `3px solid ${C.glassEdge}` }}>
        <Img src={staticFile("demo/email-a1.png")} style={{ width: 1040, display: "block", scale: String(zoom), transformOrigin: "20% 100%" }} />
      </div>
      <div style={{ position: "absolute", left: 24, top: -54, background: DAWN, color: C.onAccent, fontSize: 30, fontWeight: 700, borderRadius: 18, padding: "4px 18px" }}>อีเมลจริงผ่าน Resend</div>
    </div>
  );
};

/** 8.1-8.10: the real app in a device frame, the system's name, and what each step shows. */
export const Demo: React.FC<SceneProps> = ({ s, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const all = beats(s);
  const shotBeats = all.filter((b) => b.shot);
  const cur = latest(shotBeats, frame);
  const shot = cur?.shot ?? s.shots[0];
  const device = SHOT_DEVICE[shot] ?? "desktop";
  const screens = first(s, "screens3");
  // 8.9 has no shot of its own: the three phones are on screen from the start, small beside the text, and
  // grow to the full row when "สามหน้าจอ" is said
  const threeOnly = s.shots.every((k) => k.startsWith("I1"));
  const three = screens ? enter(frame, screens.f, threeOnly ? 30 : 20) : 0;
  const visuals = all.filter((b) => VISUAL.includes(b.kind));
  const vis = threeOnly ? undefined : latest(visuals, frame);
  const steps = all.filter((b) => STEP.includes(b.kind) && b.kind !== "role" && b.kind !== "level" && b.kind !== "state");
  const shownN = steps.filter((b) => b.f <= frame).length;
  const desk = device === "desktop";
  const panelX = desk ? 1250 : 920;
  const panelW = desk ? 580 : 900;
  const keep = desk ? (vis ? 2 : 4) : vis ? 3 : 5;
  // each shot plays from its first mention until the next one, sped up or slowed to fit the speech
  const starts: { shot: string; f: number }[] = [{ shot: s.shots[0], f: 0 }];
  for (const b of shotBeats) {
    if (!b.shot || b.shot.startsWith("I1")) continue;
    if (b.shot === starts[starts.length - 1].shot) continue;
    if (b.f < fps) starts[starts.length - 1] = { shot: b.shot, f: 0 };
    else starts.push({ shot: b.shot, f: b.f });
  }
  const endAll = screens ? screens.f + 20 : dur;
  const segments = (threeOnly ? [] : starts)
    .map((st, i) => {
      const to = Math.min(i + 1 < starts.length ? starts[i + 1].f : endAll, endAll);
      const segSec = Math.max(0.5, (to - st.f) / fps);
      const shotSec = SHOTS[st.shot]?.duration ?? segSec;
      const rate = Math.min(2.5, Math.max(0.8, shotSec / segSec));
      const playSec = shotSec / rate;
      return { shot: st.shot, from: st.f, to, rate, playFrames: playSec < segSec ? Math.round(playSec * fps) : undefined };
    })
    .filter((sg) => sg.to > sg.from);
  const email = first(s, "email");
  const emailUntil = email ? (starts.find((st) => st.f > email.f)?.f ?? email.f + 6 * fps) : 0;
  const window = steps.slice(Math.max(0, shownN - keep));
  const reveal = enter(frame, 0, 18);
  // the admin taps approve 4.2 s into the three recordings: until then they play slowed so that tap lands on
  // "กดอนุมัติ", then at normal speed
  const approve = first(s, "beam:rise");
  const tapAt = 4.2;
  const tapF = approve ? approve.f - Math.round(0.2 * fps) : Math.round(tapAt * fps);
  const parts = [
    { f: 0, at: 0, rate: tapAt / (tapF / fps) },
    { f: tapF, at: tapAt, rate: 1 },
  ];
  const lay = threeOnly ? three : 1;
  const ph = 560 + 140 * lay;
  const pw = (ph * 375) / 812 + 36;
  const px = (i: number) => (80 + i * (pw + 30)) * (1 - lay) + (250 + i * 520) * lay;
  const py = 230 * (1 - lay) + 180 * lay;
  return (
    <>
      <div style={{ opacity: threeOnly ? 1 : 1 - three }}>
        {segments.map((sg) => {
          const d = (SHOT_DEVICE[sg.shot] ?? "desktop") === "desktop";
          return (
            <Sequence key={`${sg.shot}-${sg.from}`} from={sg.from} durationInFrames={sg.to - sg.from} layout="none">
              <DeviceFrame shot={sg.shot} device={d ? "desktop" : "phone"} x={d ? 80 : 330} y={d ? 220 : 140} h={d ? 600 : 760} reveal={reveal} rate={sg.rate} playFrames={sg.playFrames} />
            </Sequence>
          );
        })}
        {email ? <EmailCard f={email.f} until={emailUntil} /> : null}
        <div style={{ position: "absolute", left: panelX, top: 150, width: panelW, fontFamily: FONT, opacity: threeOnly ? 1 - three : 1 }}>
          <div style={{ fontSize: 54, fontWeight: 700, color: C.ink, lineHeight: 1.3, opacity: reveal, whiteSpace: "nowrap" }}>{s.system}</div>
        </div>
        {vis ? (
          <div style={{ position: "absolute", left: panelX, top: 250, width: panelW, height: 440 }}>
            <Visual v={vis} s={all} w={panelW} />
          </div>
        ) : null}
        <div style={{ opacity: threeOnly ? 1 - three : 1 }}>
          <StepList x={panelX} y={vis ? 720 : 270} width={panelW} fontSize={40} gap={20} items={window.map((b) => ({ text: b.text ?? "", f: b.f, mark: "dot", color: C.accent }))} />
        </div>
      </div>
      {screens ? (
        <div style={{ opacity: threeOnly ? reveal : three }}>
          {/* honest label (prompt 6.2): the three screens were recorded at the same time */}
          <div style={{ position: "absolute", right: 96, top: 60, fontFamily: FONT, fontSize: 30, fontWeight: 600, color: C.onAccent, background: DAWN, borderRadius: 18, padding: "4px 18px", opacity: three }}>
            อัดพร้อมกัน 3 จอ
          </div>
          {["ผู้แจ้ง", "ผู้ดูแล", "เพื่อนบ้าน"].map((who, i) => {
            const lab = all.filter((b) => b.kind === "screen")[i];
            return (
              <React.Fragment key={who}>
                <DeviceFrame shot={`I1-${i + 1}`} device="phone" x={px(i)} y={py} h={ph} reveal={threeOnly ? reveal : three} parts={parts} />
                {/* above the phone: below it the subtitles would cover the name */}
                <div style={{ position: "absolute", left: px(i), width: pw, top: py - 66, textAlign: "center", fontFamily: FONT, fontSize: 44, fontWeight: 700, color: C.ink, opacity: lab ? enter(frame, lab.f, 12) : 0 }}>
                  {who}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      ) : null}
    </>
  );
};
