import { localBeats, type LocalBeat, type Section } from "../data";

export type SceneProps = { s: Section; dur: number };

export const beats = (s: Section, ...kinds: string[]): LocalBeat[] =>
  localBeats(s).filter((b) => kinds.length === 0 || kinds.includes(b.kind));

export const first = (s: Section, kind: string): LocalBeat | undefined => beats(s, kind)[0];

/** Latest beat (of the given kinds) at or before `frame`. */
export const latest = (list: LocalBeat[], frame: number): LocalBeat | undefined => {
  let cur: LocalBeat | undefined;
  for (const b of list) if (b.f <= frame) cur = b;
  return cur;
};

/** Desktop or phone for each demo shot (prompt 6.1A). */
export const SHOT_DEVICE: Record<string, "desktop" | "phone"> = {
  A1: "desktop", A1a: "desktop", A1b: "desktop", A2: "desktop", B1: "desktop", C1: "desktop", D1: "phone", D2: "phone", D3: "phone",
  E1: "desktop", E2: "desktop", F1: "phone", G1: "phone", G2: "desktop", G3: "desktop", H1: "phone",
  H2: "phone", H3: "phone", H4: "desktop", I1: "desktop", J1: "desktop", J2: "phone", K1: "phone",
};
