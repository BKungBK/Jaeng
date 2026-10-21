import { expect, test, type Page } from '@playwright/test';
import { beams, loginAs, person, sawFx, watchFx, zoomToABeam } from './helpers';

// The demo (spec 1.1, PRODUCT.md "Demo flow") from the first screen to switching the language, with three
// people at once: the reporter, the admin and a neighbour. One serial test; each scene is a step.
// Text locators are the Thai words of the app (the default language), so a reworded button is noticed here.

const TITLE = `ท่อระบายน้ำอุดตัน e2e ${Date.now().toString(36)}`;

test('demo: report, approve, me too, fix claim, confirm, language', async ({ browser }, info) => {
  test.setTimeout(600_000);
  const t0 = Date.now();
  const step = async <T>(name: string, body: () => Promise<T>) => {
    const r = await test.step(name, body);
    console.log(`[${info.project.name}] ${name}: ${Math.round((Date.now() - t0) / 1000)} s`);
    return r;
  };
  const use = info.project.use;
  const mobile = !!use.isMobile;

  // ---- 1. the map opens with beams on it ----
  const guest = await person(browser, use);
  const map = await guest.newPage();
  await step('1. the map opens and shows beams', async () => {
    await map.goto('/');
    await expect(map.locator('.map canvas').first()).toBeVisible();
    // a marker's root has no box of its own: what can be seen is its disc, or the number button of a group
    await expect(map.locator('.beacon .disc, .cluster button').first()).toBeVisible({ timeout: 60_000 });
  });

  // ---- 2. zoom to the street ----
  await step('2. zoom in until single beams are drawn', async () => {
    await zoomToABeam(map);
    await expect(beams(map).first()).toBeVisible();
    await map.screenshot({ path: `test-results/${info.project.name}-1-map.png` });
    await map.close(); // a map renders on the CPU here (software GL): pages that are done stop costing frames
  });

  // ---- 3. the reporter: photo, category, pin, send ----
  const reporterCtx = await person(browser, use);
  const reporter = await reporterCtx.newPage();
  let reportId = '';
  await step('3. the reporter sends a report in three taps', async () => {
    await loginAs(reporter, 'member');
    await reporter.goto('/report');
    await expect(reporter.locator('h1')).toHaveText('ถ่ายรูปปัญหา');
    await reporter.locator('input[type="file"][multiple]').setInputFiles('fixtures/report.jpg');
    await expect(reporter.locator('h1')).toHaveText('เป็นเรื่องอะไร'); // the first ready photo moves on by itself
    await reporter.locator('button.cat', { hasText: 'ถนน/ทางเท้า' }).click();
    await expect(reporter.locator('h1')).toHaveText('ปักหมุดตรงไหน');
    await reporter.getByRole('button', { name: 'เพิ่มรายละเอียด' }).click();
    await reporter.locator('#rn-title').fill(TITLE);
    await reporter.screenshot({ path: `test-results/${info.project.name}-2-flow.png` });
    const send = reporter.getByRole('button', { name: 'ส่งเรื่อง', exact: true });
    await expect(send).toBeEnabled({ timeout: 60_000 }); // the device position puts the pin at street zoom
    const created = reporter.waitForResponse((r) => r.url().endsWith('/api/reports') && r.request().method() === 'POST' && r.status() === 201);
    await send.click();
    // a report near another of the same kind first shows "is it this one?": it is a new one
    const different = reporter.getByRole('button', { name: 'ไม่ใช่ แจ้งเป็นเรื่องใหม่' });
    if (await different.isVisible({ timeout: 4_000 }).catch(() => false)) await different.click();
    const body = (await (await created).json()) as { report: { id: string } };
    reportId = body.report.id;
    await expect(reporter.locator('#rn-sent-title')).toHaveText('ส่งแล้ว รอผู้ดูแลตรวจ');
    await reporter.screenshot({ path: `test-results/${info.project.name}-3-sent.png` });
    await reporter.close();
  });

  // ---- 4. the admin approves it ----
  const adminCtx = await person(browser, use);
  const admin = await adminCtx.newPage();
  await step('4. the admin approves it and its beam appears', async () => {
    await loginAs(admin, 'admin');
    await admin.goto('/admin');
    await expect(admin.locator('app-review-queue article.review h2')).toBeVisible();
    for (let i = 0; i < 12 && !(await admin.locator('article.review h2').innerText()).includes(TITLE); i++) {
      await admin.getByRole('button', { name: 'เรื่องถัดไป' }).click();
      await admin.waitForTimeout(300);
    }
    await expect(admin.locator('article.review h2')).toContainText(TITLE);
    await admin.getByRole('button', { name: 'อนุมัติ…' }).click();
    await admin.getByRole('button', { name: 'อนุมัติ ขึ้นแผนที่' }).click();
    await expect(admin.locator('[role="status"]').first()).toContainText('อนุมัติแล้ว');
    await admin.screenshot({ path: `test-results/${info.project.name}-4-admin.png` });
  });

  // ---- 5. a neighbour: me too, fix claim; the admin confirms; the beam changes ----
  const neighborCtx = await person(browser, use);
  const neighbor = await neighborCtx.newPage();
  // a marker's root has no box (it is never isible): the disc is what is seen, the root carries the state class
  const disc = (page: Page) => page.locator(`.disc[aria-label*="${TITLE}"]`);
  const beam = (page: Page) => page.locator(`.beacon`, { has: disc(page) });
  await step('5a. the new beam is on the map; me too raises it', async () => {
    await loginAs(neighbor, 'neighbor');
    await neighbor.goto(`/r/${reportId}`);
    await expect(disc(neighbor)).toBeVisible({ timeout: 60_000 });
    await expect(neighbor.locator('app-report-detail h2')).toHaveText(TITLE);
    await watchFx(neighbor);
    const metoo = neighbor.locator('app-report-detail .metoo');
    await expect(metoo).toContainText('0');
    await metoo.click();
    await expect(metoo).toHaveAttribute('aria-pressed', 'true');
    await expect(metoo).toContainText('1');
    await expect.poll(() => sawFx(neighbor, 'bump'), { timeout: 15_000 }).toBe(true); // the disc bumped, the number rolled
    await neighbor.screenshot({ path: `test-results/${info.project.name}-5-metoo.png` });
  });

  await step('5b. a fix claim dims the beam (claimed)', async () => {
    await neighbor.locator('app-report-detail .btn.fix').click();
    await neighbor.getByRole('button', { name: 'ส่งให้ผู้ดูแลตรวจ' }).click();
    await expect(neighbor.locator('app-report-detail .status')).toContainText('ขอบคุณนะ ส่งให้ผู้ดูแลตรวจแล้ว');
    await expect(beam(neighbor)).toHaveClass(/st-claimed/, { timeout: 30_000 });
  });

  await step('5c. the admin confirms: the beam goes out (done)', async () => {
    await admin.goto('/admin?tab=claims');
    const card = admin.locator('app-claims-queue article.item', { hasText: TITLE });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'ยืนยันว่าแก้แล้ว' }).click();
    await expect(admin.locator('[role="status"]').first()).toContainText('ยืนยันแล้ว');
    await expect(beam(neighbor)).toHaveClass(/st-done/, { timeout: 30_000 });
    await neighbor.screenshot({ path: `test-results/${info.project.name}-6-done.png` });
    await neighbor.close();
    await admin.close();
  });

  // ---- 6. the language ----
  await step('6. switch to English and back', async () => {
    const home = await guest.newPage();
    if (mobile) {
      // a phone keeps the language in the display settings of the about page (the map's menu capsule is for wide screens)
      await home.goto('/about');
      await expect(home.locator('h1')).toHaveText('เกี่ยวกับแจ้ง');
      await home.getByRole('radio', { name: 'English' }).click();
      await expect(home.locator('h1')).toHaveText(/About/);
      await home.getByRole('radio', { name: 'ไทย' }).click();
      await expect(home.locator('h1')).toHaveText('เกี่ยวกับแจ้ง');
      return;
    }
    await home.goto('/');
    const toggle = home.getByRole('button', { name: 'Switch to English' });
    await expect(toggle.first()).toBeVisible();
    await toggle.first().click();
    await expect(home.getByRole('button', { name: 'Zoom in' }).first()).toBeVisible();
    await home.getByRole('button', { name: 'เปลี่ยนเป็นภาษาไทย' }).first().click();
    await expect(home.getByRole('button', { name: 'ซูมเข้า' }).first()).toBeVisible();
  });

  await Promise.all([guest.close(), reporterCtx.close(), adminCtx.close(), neighborCtx.close()]);
});
