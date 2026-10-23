// Visual check without rendering the clip (prompt 1.1): bundle once, render chosen frames as half-size stills.
// Usage: node scripts/stills.mjs [sectionId ...]   (no args = every section)
// Picks per section: just after the middle beat, and just after the last beat. Writes out/stills/<id>-<n>.jpg
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const cues = JSON.parse(readFileSync(path.join(root, "cues.json"), "utf8"));
const want = process.argv.slice(2);
const fps = cues.fps;
const outDir = path.join(root, "out", "stills");
mkdirSync(outDir, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts"), publicDir: path.join(root, "public") });
const comp = await selectComposition({ serveUrl, id: "Jaeng", inputProps: { audio: "" } });
const secs = cues.sections;
// "@<seconds>" arguments render that exact moment as out/stills/at-<seconds>.jpg
for (const a of want.filter((w) => w.startsWith("@"))) {
  const t = Number(a.slice(1));
  await renderStill({ composition: comp, serveUrl, frame: Math.round(t * fps), output: path.join(outDir, `at-${t}.jpg`), imageFormat: "jpeg", jpegQuality: 80, scale: 0.5, inputProps: { audio: "" } });
  console.log(`at ${t}s`);
}
if (want.length && want.every((w) => w.startsWith("@"))) process.exit(0);
for (let i = 0; i < secs.length; i++) {
  const s = secs[i];
  if (want.length && !want.includes(s.id)) continue;
  const end = i + 1 < secs.length ? secs[i + 1].start : cues.duration;
  const bs = s.beats.filter((b) => b.kind !== "sentence").map((b) => b.start);
  const picks = bs.length ? [bs[Math.floor(bs.length / 2)] + 1.2, bs[bs.length - 1] + 1.5] : [(s.start + end) / 2];
  for (let k = 0; k < picks.length; k++) {
    const t = Math.min(picks[k], end - 0.4);
    const frame = Math.round(t * fps);
    const output = path.join(outDir, `${s.id}-${k + 1}.jpg`);
    await renderStill({ composition: comp, serveUrl, frame, output, imageFormat: "jpeg", jpegQuality: 80, scale: 0.5, inputProps: { audio: "" } });
    console.log(`${s.id}-${k + 1} @ ${t.toFixed(2)}s`);
  }
}
