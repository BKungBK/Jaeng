import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { Caption } from "../components/Bits";
import { Diagram, DIAGRAM_IDS, type Flow } from "../components/Diagram";
import { enter } from "../theme";
import { beats, latest, type SceneProps } from "./util";

/** 6 การออกแบบระบบ: arrows 1-6 light up as they are named, everything else dims; packets keep flowing. */
export const SystemDiagram: React.FC<SceneProps> = ({ s, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lit = beats(s, "diagram", "flow");
  const all = beats(s);
  const cur = latest(lit, frame);
  const focus = cur?.ids ?? [];
  const lastLit = lit[lit.length - 1];
  // after the last explanation the whole drawing comes back (loop mode)
  const settle = lastLit && frame > lastLit.f + 3 * fps;
  const dim = settle ? Math.max(0, 1 - enter(frame, lastLit.f + 3 * fps, 30)) : focus.length ? enter(frame, cur!.f, 10) : 0;
  const at = (txt: string, kind: string) => lit.find((b) => b.kind === kind && (b.text ?? "").includes(txt))?.f;
  const flows: Flow[] = [];
  const readF = at("เรียลไทม์", "flow") ?? at("Supabase", "diagram");
  const writeF = at("Elysia", "diagram");
  const photoF = at("อนุมัติ", "diagram");
  const mailF = at("รหัส", "flow");
  if (readF !== undefined) flows.push({ kind: "read", from: readF });
  if (writeF !== undefined) flows.push({ kind: "write", from: writeF });
  if (photoF !== undefined) flows.push({ kind: "photo", from: photoF });
  if (mailF !== undefined) flows.push({ kind: "email", from: mailF });
  const webF = at("Angular", "diagram");
  if (webF !== undefined) flows.push({ kind: "web", from: webF });
  // caption: diagram labels, and the rule chips gathered into one line
  const caps: { text: string; f: number }[] = [];
  let chipRun: string[] = [];
  for (const b of all) {
    if (b.kind === "chip") {
      chipRun.push(b.text ?? "");
      caps.push({ text: chipRun.join(" · "), f: b.f });
    } else if (["diagram", "flow", "caption"].includes(b.kind) && b.text) {
      chipRun = [];
      caps.push({ text: b.text, f: b.f });
    }
  }
  return (
    <>
      <div style={{ position: "absolute", left: 192, top: 96, width: 1920, height: 1080, scale: "0.8", transformOrigin: "0 0" }}>
        <Diagram focus={settle ? [...DIAGRAM_IDS] : focus} dim={dim} reveal={enter(frame, 0, 24)} flows={flows} />
      </div>
      <Caption items={caps.filter((c) => c.f < dur)} bottom={28} />
    </>
  );
};
