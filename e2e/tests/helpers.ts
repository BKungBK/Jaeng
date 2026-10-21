import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export const INTRO_KEY = 'jaeng.intro';

export type Who = 'member' | 'admin' | 'neighbor';
/** the demo-user buttons of the login form, by their Thai label (quick login works on localhost only) */
const WHO_LABEL: Record<Who, string> = { member: 'ผู้แจ้ง (เพื่อนบ้านใจดี)', admin: 'ผู้ดูแล', neighbor: 'เพื่อนบ้านอีกคน' };

/** A browser context of its own per person, so three people can be signed in at once. The intro is skipped. */
export async function person(
  browser: Browser,
  use: { viewport?: { width: number; height: number }; isMobile?: boolean; hasTouch?: boolean; userAgent?: string },
  geo = { latitude: 13.62, longitude: 100.72 },
): Promise<BrowserContext> {
  const context = await browser.newContext({
    ...use,
    geolocation: geo,
    permissions: ['geolocation'],
    locale: 'th-TH',
  });
  await context.addInitScript((key) => sessionStorage.setItem(key, 'skip'), INTRO_KEY);
  return context;
}

/** Signs in with the demo-user buttons on /login, then lands back on the map. */
export async function loginAs(page: Page, who: Who): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: WHO_LABEL[who], exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** the beams (and number discs) of the map as the screen reader hears them */
export const beams = (page: Page) => page.locator('.beacon .disc[aria-label]');

/** Zooms until a beam (not just a number disc) is on screen: a number disc zooms in when pressed. */
export async function zoomToABeam(page: Page): Promise<void> {
  for (let i = 0; i < 14; i++) {
    if ((await beams(page).count()) > 0) return;
    const cluster = page.locator('.cluster button, button.cluster').first();
    const zoomIn = page.getByRole('button', { name: 'ซูมเข้า' });
    if (await cluster.count()) await cluster.click({ force: true });
    else if (await zoomIn.count()) await zoomIn.first().click();
    else await page.locator('.map').dblclick(); // a phone has no zoom buttons: a double tap zooms in
    await page.waitForTimeout(900);
  }
  await expect(beams(page).first()).toBeVisible();
}

/** Watches the page for a `data-fx` value on a marker and remembers it (an effect lasts about a second). */
export async function watchFx(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __fx: Set<string> };
    w.__fx = new Set();
    new MutationObserver((records) => {
      for (const r of records) {
        const v = (r.target as HTMLElement).dataset?.['fx'];
        if (v) w.__fx.add(v);
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-fx'] });
  });
}

export const sawFx = (page: Page, fx: string) =>
  page.evaluate((v) => (window as unknown as { __fx?: Set<string> }).__fx?.has(v) ?? false, fx);
