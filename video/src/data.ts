// The one timeline (prompt 4.7): cues.json is built from the real recorded speech by scripts/a5_cues.py.
// Session 1 can point this at cues.estimated.json; the code does not change.
import cuesJson from "../cues.json";
import valuesJson from "../data/measured-values.json";
import musicJson from "../data/music.json";

export type Sfx = { name: string; offset: number };
export type Beat = {
  id: string;
  start: number;
  kind: string;
  anim: string;
  text?: string;
  sub?: string;
  icon?: string;
  ids?: string[];
  shot?: string;
  value?: { key: string; value: number; unit: string };
  sfx?: Sfx[];
  sync?: string;
};
export type Phrase = { text: string; start: number; end: number };
export type Sentence = { id: string; text: string; script: string | null; start: number; end: number; phrases: Phrase[] };
export type Section = {
  id: string;
  num: string;
  title: string;
  system: string;
  shots: string[];
  start: number;
  end: number;
  sentences: Sentence[];
  beats: Beat[];
};
export type Cues = { fps: number; voice: string; duration: number; sections: Section[] };

export const cues = cuesJson as unknown as Cues;
export const values = valuesJson as unknown as Record<string, { value: number; unit: string }>;
export const FPS = cues.fps;
export const TAIL = musicJson.tail; // music rings out after the last word (scripts/a7_mix.py)
export const TOTAL_FRAMES = Math.ceil((cues.duration + TAIL) * FPS);

/** Scene i runs from its section start to the next section start (gaps belong to the earlier scene). */
export const sceneSpans = cues.sections.map((s, i) => {
  const from = Math.round(s.start * FPS);
  const next = i + 1 < cues.sections.length ? cues.sections[i + 1].start : cues.duration + TAIL;
  return { section: s, from, duration: Math.max(1, Math.round(next * FPS) - from) };
});

/** Beats of a section that are not plain sentence beats, with frames relative to the scene start. */
export const localBeats = (s: Section) =>
  s.beats
    .filter((b) => b.kind !== "sentence")
    .map((b) => ({ ...b, f: Math.round((b.start - s.start) * FPS) }));
export type LocalBeat = ReturnType<typeof localBeats>[number];
