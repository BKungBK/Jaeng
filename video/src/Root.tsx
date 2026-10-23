import React from "react";
import { Composition } from "remotion";
import { FPS, TOTAL_FRAMES } from "./data";
import { JaengVideo } from "./Video";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Jaeng"
        component={JaengVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ audio: "audio/mix.wav" }}
      />
    </>
  );
};
