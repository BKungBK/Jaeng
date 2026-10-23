import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Beam } from "../components/Beam";
import { Caption, provinceAt, ThaiMap } from "../components/Bits";
import { StepList } from "../components/StepList";
import { C, EASE, enter, FONT, thaiWrap } from "../theme";
import { beats, first, type SceneProps } from "./util";

// where the four example problems pop up (Bangkok, Chiang Mai, Khon Kaen, Songkhla)
const PIN_AT = ["TH10", "TH50", "TH40", "TH90"];

/** 2 ที่มาและปัญหา: problems pop up on a toy Thailand as the speaker names them, the camera drifts in. */
export const Problem: React.FC<SceneProps> = ({ s }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pins = beats(s, "pin");
  const zoom = first(s, "zoom");
  const emph = first(s, "emph");
  const caption = beats(s, "caption");
  const items = beats(s, "item");
  const reveal = enter(frame, 0, 1.6 * fps);
  const zp = zoom ? interpolate(frame, [zoom.f, zoom.f + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE }) : 0;
  const bkk = provinceAt("TH10");
  const H = 900;
  const sc = H / 1600;
  const drift = Math.sin((frame / (12 * fps)) * Math.PI * 2) * 10;
  // zoom towards the Bangkok pin, which ends up at (520, 560); the map stays inside the left 1000 px
  const z = 1 + 0.9 * zp;
  const tx = zp * (520 - 170 - z * bkk.x * sc);
  const ty = zp * (560 - 110 - z * bkk.y * sc);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1000,
          height: 1080,
          overflow: "hidden",
          WebkitMaskImage: "linear-gradient(90deg, #000 85%, transparent 100%)",
        }}
      >
      <div
        style={{
          position: "absolute",
          left: 170,
          top: 110 + drift,
          translate: `${tx}px ${ty}px`,
          scale: String(z),
          transformOrigin: "0 0",
        }}
      >
        <ThaiMap reveal={reveal} height={H}>
          {pins.map((p, i) => {
            const at = provinceAt(PIN_AT[i % PIN_AT.length]);
            // alternate blink once all are up: the loop mode
            return <Beam key={p.id} x={at.x} y={at.y} level={(i % 4) as 0 | 1 | 2 | 3} n={3 + i * 4} scale={1.8} rise={enter(frame, p.f, 20)} label={undefined} />;
          })}
        </ThaiMap>
      </div>
      </div>
      {pins.map((p, i) => {
        const at = provinceAt(PIN_AT[i % PIN_AT.length]);
        const o = enter(frame, p.f + 6, 14) * (1 - zp);
        return (
          <div key={p.id} style={{ position: "absolute", left: 170 + at.x * sc + 30, top: 110 + drift + at.y * sc - 30, fontFamily: FONT, fontSize: 40, fontWeight: 600, color: C.ink, opacity: o, textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
            {p.text}
          </div>
        );
      })}
      {zoom ? (
        <div style={{ position: "absolute", left: 570, top: 600, fontFamily: FONT, fontSize: 44, fontWeight: 600, color: C.ink, opacity: enter(frame, zoom.f + 20, 16), background: C.glassDense, borderRadius: 24, padding: "10px 26px" }}>
          {thaiWrap(zoom.text ?? "")}
        </div>
      ) : null}
      <StepList
        x={1010}
        y={260}
        width={820}
        fontSize={46}
        items={items.map((b, i) => ({ text: b.text ?? "", f: b.f, mark: i === 0 ? "warn" : "dot", color: i === 0 ? C.peach : C.butter }))}
      />
      {emph ? (
        <div
          style={{
            position: "absolute",
            left: 1010,
            top: 300 + items.length * 92,
            fontFamily: FONT,
            fontSize: 84,
            fontWeight: 700,
            color: C.rose,
            opacity: enter(frame, emph.f, 12),
            scale: String(interpolate(frame, [emph.f, emph.f + 8, emph.f + 16], [0.8, 1.06, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })),
            transformOrigin: "0 50%",
          }}
        >
          {emph.text}
        </div>
      ) : null}
      <Caption items={caption.map((c) => ({ text: c.text ?? "", f: c.f }))} />
    </>
  );
};
