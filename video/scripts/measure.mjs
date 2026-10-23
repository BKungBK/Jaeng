// Prompt 6.3: measured numbers for the clip (written into data/measured-values.json, raw samples kept).
//  - GET /api/config (no database): 3 runs x 500 sequential requests on one keep-alive connection, 20 warm-up
//  - reports_in_bbox over the whole country through /sb: 3 runs x 30 after 1 warm-up (raw samples kept)
// The anon key is read from /api/config at run time and never written.
import http from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
const req = (method, path, body, headers = {}) =>
  new Promise((res, rej) => {
    const t0 = process.hrtime.bigint();
    const r = http.request({ host: "localhost", port: 8000, method, path, agent, headers }, (resp) => {
      let data = "";
      resp.on("data", (d) => (data += d));
      resp.on("end", () => res({ ms: Number(process.hrtime.bigint() - t0) / 1e6, status: resp.statusCode, data }));
    });
    r.on("error", rej);
    if (body) r.write(body);
    r.end();
  });
const stats = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +s[s.length - 1].toFixed(2), n: s.length };
};

const config = { runs: [] };
for (let i = 0; i < 20; i++) await req("GET", "/api/config");
for (let run = 0; run < 3; run++) {
  const t = [];
  for (let i = 0; i < 500; i++) t.push((await req("GET", "/api/config")).ms);
  config.runs.push(stats(t));
}
const { supabaseAnonKey } = JSON.parse((await req("GET", "/api/config")).data);
const body = JSON.stringify({ min_lng: 97, min_lat: 5, max_lng: 106, max_lat: 21 });
const h = { apikey: supabaseAnonKey, "content-type": "application/json", "content-length": Buffer.byteLength(body) };
await req("POST", "/sb/rest/v1/rpc/reports_in_bbox", body, h);
const bbox = { runs: [], samples: [] };
let beams = 0;
for (let run = 0; run < 3; run++) {
  const t = [];
  for (let i = 0; i < 30; i++) {
    const r = await req("POST", "/sb/rest/v1/rpc/reports_in_bbox", body, h);
    t.push(r.ms);
    beams = (JSON.parse(r.data).features ?? []).length;
  }
  bbox.runs.push(stats(t));
  bbox.samples.push(...t.map((x) => +x.toFixed(2)));
}
const all = stats(bbox.samples);
mkdirSync("data/raw", { recursive: true });
writeFileSync("data/raw/measure-" + new Date().toISOString().slice(0, 16).replace(/:/g, "") + ".json", JSON.stringify({ config, bbox, beams }, null, 1));
const cfgMed = stats(config.runs.map((r) => r.median));
const vals = JSON.parse(readFileSync("data/measured-values.json", "utf8"));
const stamp = new Date().toISOString().slice(0, 10);
vals["api.config.median_ms"] = { value: Math.round(cfgMed.median), unit: "ms", source: `GET /api/config ${stamp}, 3 x 500 keep-alive, run medians ${config.runs.map((r) => r.median).join(" / ")} ms, p95 ${config.runs.map((r) => r.p95).join(" / ")}, max ${config.runs.map((r) => r.max).join(" / ")}` };
vals["perf.bbox.n"] = { value: bbox.samples.length, unit: "ครั้ง", source: `reports_in_bbox whole country ${stamp}, 3 x 30 after 1 warm-up` };
vals["perf.bbox.median_ms"] = { value: Math.round(all.median), unit: "ms", source: `median of ${bbox.samples.length} samples ${all.median} ms; run medians ${bbox.runs.map((r) => r.median).join(" / ")}` };
vals["perf.bbox.max_ms"] = { value: Math.round(all.max), unit: "ms", source: `max of ${bbox.samples.length} samples; run max ${bbox.runs.map((r) => r.max).join(" / ")}` };
vals["perf.bbox.beams"] = { value: beams, unit: "เส้น", source: `features returned (open + fix_claimed) ${stamp}` };
vals["perf.bbox.samples"] = { value: bbox.samples, unit: "ms", source: `raw samples ${stamp}` };
vals._status = `measured ${stamp} by scripts/measure.mjs (API + bbox); tests from scripts/test.sh`;
writeFileSync("data/measured-values.json", JSON.stringify(vals, null, 1));
console.log("config run medians", config.runs.map((r) => r.median), "p95", config.runs.map((r) => r.p95));
console.log("bbox", all, "beams", beams, "run medians", bbox.runs.map((r) => r.median), "run max", bbox.runs.map((r) => r.max));
