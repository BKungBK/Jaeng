// Frame-time probe for the motion budget (plan 8, Task 10). It runs inside the page: it counts
// requestAnimationFrame ticks for `ms` milliseconds and reports the spread of the time between them.
//
//   const r = await measureFrames(page, 5000);   // Playwright page, see e2e/tests/perf.spec.ts
//   // r = { frames, p50, p95, max, over24, over50 }   (all times in ms)
//
// To try it by hand in a browser console: paste FRAME_PROBE and `await probe(5000)`.

export const FRAME_PROBE = `(ms) => new Promise((resolve) => {
  const gaps = [];
  let last = performance.now();
  const end = last + ms;
  const tick = (now) => {
    gaps.push(now - last);
    last = now;
    if (now < end) requestAnimationFrame(tick);
    else {
      gaps.shift(); // the first gap includes the time to schedule the probe
      const sorted = [...gaps].sort((a, b) => a - b);
      const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
      resolve({
        frames: gaps.length,
        p50: +at(0.5).toFixed(1),
        p95: +at(0.95).toFixed(1),
        max: +(sorted[sorted.length - 1] ?? 0).toFixed(1),
        over24: gaps.filter((g) => g > 24).length,
        over50: gaps.filter((g) => g > 50).length,
      });
    }
  };
  requestAnimationFrame(tick);
})`;

/** Playwright: run the probe in the page for `ms` ms while the test does something else (do not await it first). */
export function measureFrames(page, ms = 5000) {
  return page.evaluate(`(${FRAME_PROBE})(${ms})`);
}

/** The same scenarios without motion, for a baseline: kills every animation and transition in the page. */
export const NO_MOTION_CSS = '*,*::before,*::after{animation:none!important;transition:none!important}';
