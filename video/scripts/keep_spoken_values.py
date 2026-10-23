"""On-screen numbers stay the 2026-10-22 values (they match the recorded speech); the 2026-10-23 re-measure
is kept under "measured_2026_10_23" until the owner decides (prompt 6.3: ask before changing on-screen numbers)."""
import json
from sections import DATA

p = DATA / "measured-values.json"
v = json.loads(p.read_text(encoding="utf-8"))
if "measured_2026_10_23" not in v:
    v["measured_2026_10_23"] = {k: v[k] for k in ["perf.bbox.median_ms", "perf.bbox.max_ms", "api.config.median_ms",
                                                   "perf.bbox.samples", "perf.bbox.n", "perf.bbox.beams"] if k in v}
v["perf.bbox.median_ms"] = {"value": 7, "unit": "ms", "source": "2026-10-22 run medians 7.3 / 6.8 / 6.8 ms (spoken); re-measure 2026-10-23: 5.18 ms (measured_2026_10_23), owner to decide"}
v["perf.bbox.max_ms"] = {"value": 61, "unit": "ms", "source": "2026-10-22 per-run max 61 / 14 / 16 ms (spoken); re-measure 2026-10-23: 8.89 ms, owner to decide"}
v["api.config.median_ms"] = {"value": 2, "unit": "ms", "source": "2026-10-22 medians 2.17 / 1.94 / 2.08 ms (spoken); re-measure 2026-10-23: 1.45 / 1.08 / 1.05 ms, owner to decide"}
v["perf.bbox.n"] = {"value": 90, "unit": "ครั้ง", "source": "3 x 30 (both days)"}
v["perf.bbox.beams"] = {"value": 34, "unit": "เส้น", "source": "34 beams (both days)"}
v.pop("perf.bbox.samples", None)
v["_status"] = "on-screen = 2026-10-22 values (match the speech); 2026-10-23 re-measure under measured_2026_10_23 until the owner decides"
p.write_text(json.dumps(v, ensure_ascii=False, indent=1), encoding="utf-8")
print("restored spoken values; new measurements kept apart")
