import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, thaiWrap } from "../theme";
import captionsJson from "../data/captions.json";

type Cap = { start: number; end: number; text: string };
const CAPS = captionsJson as Cap[];

/** Burned-in subtitles (prompt 10): one phrase at a time, at most two lines, at the bottom edge. */
export const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const cap = CAPS.find((c) => t >= c.start && t < c.end);
  if (!cap) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 18, display: "flex", justifyContent: "center", fontFamily: FONT }}>
      <div
        style={{
          maxWidth: 1500,
          padding: "6px 22px",
          borderRadius: 14,
          background: "rgba(8,14,32,0.72)",
          color: C.ink,
          fontSize: 40,
          fontWeight: 500,
          lineHeight: 1.4,
          textAlign: "center",
        }}
      >
        {thaiWrap(cap.text)}
      </div>
    </div>
  );
};
