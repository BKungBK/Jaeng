import { expect, test } from '@playwright/test';
import { measureFrames, NO_MOTION_CSS } from '../../scripts/measure-frames.mjs';
import { loginAs, person, zoomToABeam } from './helpers';

// The motion budget (plan 8, Task 10): frame times on the map while idle and while the app animates, with
// the motion on and with every animation and transition switched off (the baseline). Opt-in, it takes minutes:
//   bash scripts/e2e.sh --project desktop tests/perf.spec.ts      (PERF=1 is set by this file's own check)
// Software GL in the container makes every number slower than on a phone; compare the two runs with each other.

test.skip(!process.env.PERF, 'set PERF=1 (scripts/e2e.sh passes it through with --perf)');
// an action that cannot be done (covered, not there) must fail in seconds, not hold the whole test for minutes
test.use({ actionTimeout: 20_000 });

for (const mode of ['motion', 'baseline'] as const) {
  test(`frames on the map: ${mode}`, async ({ browser }, info) => {
    test.setTimeout(300_000);
    const ctx = await person(browser, info.project.use);
    const page = await ctx.newPage();
    if (mode === 'baseline') await page.addInitScript((css) => document.addEventListener('DOMContentLoaded', () => document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`)), NO_MOTION_CSS);
    await page.goto('/');
    await zoomToABeam(page);
    const idle = await measureFrames(page, 5000);
    // me too five times (the number rolls, the disc bumps), then the theme circle, all while the probe runs
    await loginAs(page, 'neighbor');
    await page.goto('/');
    await zoomToABeam(page);
    // Phase 1: opening a report (the panel comes in, the detail loads, the map flies there). Phase 2: me too
    // five times (the tick draws, the number rolls, the disc bumps) with the panel already open. Two probes, so a
    // hitch can be told apart: the panel opening is one thing, the new motion on top of it is another.
    // An open report (a resolved one has no me-too button); force: a marker's root has no box of its own.
    const opening = measureFrames(page, 4000);
    await page.locator('.beacon.st-open .disc[aria-label]').first().click({ force: true });
    const open = await opening;
    const metoo = page.locator('app-report-detail .metoo');
    await expect(metoo).toBeVisible();
    await page.waitForTimeout(1500); // let the camera and the detail settle
    const pressing = measureFrames(page, 4500);
    for (let i = 0; i < 5; i++) {
      await metoo.click();
      await page.waitForTimeout(600);
    }
    const result = { mode, project: info.project.name, idle, open, metoo: await pressing };
    console.log('PERF', JSON.stringify(result));
    info.annotations.push({ type: 'perf', description: JSON.stringify(result) });
  });
}
