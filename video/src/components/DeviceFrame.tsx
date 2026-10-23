import React from "react";
import { Video } from "@remotion/media";
import { Freeze, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, DAWN, EASE, FONT, thaiWrap } from "../theme";
import shotsJson from "../data/shots.json";

export type Shot = { file: string; device: "phone" | "desktop" | "android"; duration: number; label?: string };
export const SHOTS = shotsJson as Record<string, Shot>;

type Props = {
  shot?: string;
  device: "phone" | "desktop";
  x: number;
  y: number;
  /** frame height in px; width follows the device ratio */
  h: number;
  /** seconds into the recording where this use starts, and speed (stretched to the speech in session 3) */
  from?: number;
  rate?: number;
  /** zoom on a point of the screen (0..1 coords) from frame `zf` */
  zoom?: { x: number; y: number; scale: number; f: number };
  badge?: string;
  reveal?: number;
  /** frames of playback before the last frame is held (the shot is shorter than its stretch of speech) */
  playFrames?: number;
  /** playback in parts: each starts at scene frame `f`, at second `at` of the recording, at speed `rate`;
   *  the last frame holds once the recording runs out */
  parts?: { f: number; at: number; rate: number }[];
};

/** Phone or desktop frame around a demo recording (prompt 6.1); a clear placeholder until the shot is recorded. */
export const DeviceFrame: React.FC<Props> = ({ shot, device, x, y, h, from = 0, rate = 1, zoom, badge, reveal = 1, playFrames, parts }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rec = shot ? SHOTS[shot] : undefined;
  const phone = device === "phone";
  const w = phone ? (h * 375) / 812 : (h * 16) / 9;
  const bezel = phone ? 18 : 12;
  const z = zoom ? interpolate(frame, [zoom.f, zoom.f + 24], [1, zoom.scale], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE }) : 1;
  const realAndroid = rec?.device === "android";
  const label = badge ?? (rec ? (realAndroid ? "บันทึกจากมือถือ Android จริง" : phone ? "มุมมองมือถือ" : undefined) : undefined);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w + bezel * 2,
        height: h + bezel * 2,
        borderRadius: phone ? 54 : 22,
        background: "#0A1430",
        border: `2px solid ${C.glassEdge}`,
        boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
        padding: bezel,
        opacity: reveal,
        scale: String(0.94 + 0.06 * reveal),
        fontFamily: FONT,
      }}
    >
      <div style={{ position: "relative", width: w, height: h, borderRadius: phone ? 38 : 12, overflow: "hidden", background: C.nightSurface }}>
        {rec ? (
          <div style={{ position: "absolute", inset: 0, scale: String(z), transformOrigin: `${(zoom?.x ?? 0.5) * 100}% ${(zoom?.y ?? 0.5) * 100}%` }}>
            {parts
              ? parts.map((pt, i) => {
                  const clip = (
                    <Video src={staticFile(rec.file)} muted trimBefore={Math.round(pt.at * fps)} playbackRate={pt.rate} premountFor={fps} objectFit="cover" style={{ width: "100%", height: "100%" }} />
                  );
                  const next = i + 1 < parts.length ? parts[i + 1].f : Infinity;
                  const runOut = pt.f + Math.floor(((rec.duration - pt.at) / pt.rate) * fps) - 2;
                  const playEnd = Math.min(next, runOut);
                  return (
                    <React.Fragment key={pt.f}>
                      <Sequence from={pt.f} durationInFrames={playEnd - pt.f} layout="none">{clip}</Sequence>
                      {runOut < next ? (
                        <Sequence from={runOut} durationInFrames={next === Infinity ? undefined : next - runOut} layout="none">
                          <Freeze frame={runOut - pt.f - 1}>{clip}</Freeze>
                        </Sequence>
                      ) : null}
                    </React.Fragment>
                  );
                })
              : (() => {
              const video = (
                <Video
                  src={staticFile(rec.file)}
                  muted
                  trimBefore={Math.round(from * fps)}
                  playbackRate={rate}
                  premountFor={fps}
                  objectFit="cover"
                  style={{ width: "100%", height: "100%" }}
                />
              );
              if (!playFrames) return video;
              // the recording ends before the speech moves on: hold its last frame
              return (
                <>
                  <Sequence durationInFrames={playFrames} layout="none">{video}</Sequence>
                  <Sequence from={playFrames} layout="none">
                    <Freeze frame={Math.max(0, playFrames - 2)}>{video}</Freeze>
                  </Sequence>
                </>
              );
            })()}
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              background: `linear-gradient(160deg, ${C.nightSurface}, #24356E)`,
              color: C.muted,
              textAlign: "center",
              padding: 30,
            }}
          >
            <div style={{ fontSize: phone ? 34 : 44, fontWeight: 600, color: C.ink }}>{thaiWrap(`เดโม ${shot ?? ""}`)}</div>
            <div style={{ fontSize: phone ? 26 : 32 }}>{thaiWrap("รออัดจากแอปจริง")}</div>
          </div>
        )}
      </div>
      {label ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: -58,
            translate: "-50% 0px",
            whiteSpace: "nowrap",
            background: DAWN,
            color: C.onAccent,
            fontSize: 26,
            fontWeight: 600,
            borderRadius: 18,
            padding: "4px 18px",
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};
