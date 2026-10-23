import React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "./components/Backdrop";
import { Subtitles } from "./components/Subtitles";
import { sceneSpans, TOTAL_FRAMES, type Section } from "./data";
import { Build } from "./scenes/Build";
import { Demo, DemoIntro } from "./scenes/Demo";
import { Intro } from "./scenes/Intro";
import { Conclusion, Objectives, TwoColumns } from "./scenes/Lists";
import { Problem } from "./scenes/Problem";
import { Results } from "./scenes/Results";
import { SystemDiagram } from "./scenes/SystemDiagram";
import { Tech } from "./scenes/Tech";

const Scene: React.FC<{ s: Section; dur: number }> = ({ s, dur }) => {
  switch (s.id) {
    case "s1":
      return <Intro s={s} dur={dur} />;
    case "s2":
      return <Problem s={s} dur={dur} />;
    case "s3":
      return <Objectives s={s} dur={dur} />;
    case "s4":
      return <TwoColumns s={s} dur={dur} leftKinds={["done"]} rightKinds={["todo"]} leftMark="check" rightMark="dash" />;
    case "s5":
      return <Tech s={s} dur={dur} />;
    case "s6":
      return <SystemDiagram s={s} dur={dur} />;
    case "s7":
      return <Build s={s} dur={dur} />;
    case "s8":
      return <DemoIntro s={s} dur={dur} />;
    case "s9":
      return <Results s={s} dur={dur} />;
    case "s10":
      return <TwoColumns s={s} dur={dur} leftKinds={["limit"]} rightKinds={["shield"]} leftMark="warn" rightMark="shield" />;
    case "s11":
      return <Conclusion s={s} dur={dur} />;
    default:
      return <Demo s={s} dur={dur} />;
  }
};

/** Scene content fades in over 12 frames and out over the last 10 (the sky stays continuous behind). */
const Fade: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 12, dur - 10, dur], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

export const JaengVideo: React.FC<{ audio: string }> = ({ audio }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cur = sceneSpans.filter((sp) => sp.from <= frame).pop() ?? sceneSpans[0];
  const s = cur.section;
  return (
    <AbsoluteFill>
      <Backdrop progress={frame / TOTAL_FRAMES} chip={s.num} title={s.system}>
        {sceneSpans.map((sp) => (
          <Sequence key={sp.section.id} name={`${sp.section.num} ${sp.section.title}`} from={sp.from} durationInFrames={sp.duration} premountFor={fps}>
            <Fade dur={sp.duration}>
              <Scene s={sp.section} dur={sp.duration} />
            </Fade>
          </Sequence>
        ))}
      </Backdrop>
      <Subtitles />
      {audio ? <Audio src={staticFile(audio)} /> : null}
    </AbsoluteFill>
  );
};
