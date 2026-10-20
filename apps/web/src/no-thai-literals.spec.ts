import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// Plan 6: every Thai word the app shows lives in i18n/th.ts. Specs and *.testing.ts fixtures may hold
// Thai (they check what Thai readers see); comments may too.
const THAI = /[฀-๿]/;
const app = resolve(process.cwd(), 'src/app');

/** Files not moved to the dictionary yet; Tasks 5–6 empty this list. */
const PENDING: string[] = [
  'core/auth.service.ts',
  'features/admin/admin-labels.ts',
  'features/admin/admin.page.html',
  'features/admin/claims-queue.component.ts',
  'features/admin/flags-queue.component.ts',
  'features/admin/log-tab.component.ts',
  'features/admin/place-map.component.ts',
  'features/admin/review-queue.component.html',
  'features/admin/review-queue.component.ts',
  'features/admin/users-tab.component.ts',
  'features/auth/account-button.component.ts',
  'features/auth/login-form.component.html',
  'features/auth/login-form.component.ts',
  'features/auth/login-prompt.service.ts',
  'features/auth/login.page.ts',
  'features/map/beacon.ts',
  'features/map/filter-bar.component.ts',
  'features/map/map.page.html',
  'features/map/map.page.ts',
  'features/map/report.ts',
  'features/map/toy.ts',
  'features/me/me.page.html',
  'features/me/me.page.ts',
  'features/me/reject-reason.ts',
  'features/report-detail/fix-claim-form.component.ts',
  'features/report-detail/flag-form.component.ts',
  'features/report-detail/flag-reason.ts',
  'features/report-detail/report-detail.component.html',
  'features/report-detail/report-detail.component.ts',
  'features/report-detail/report-detail.ts',
  'features/report-detail/report-menu.component.ts',
  'features/report-new/category-step.component.ts',
  'features/report-new/details-section.component.html',
  'features/report-new/duplicate-card.component.html',
  'features/report-new/duplicate-card.component.ts',
  'features/report-new/location-step.component.ts',
  'features/report-new/photo-step.component.html',
  'features/report-new/photo-step.component.ts',
  'features/report-new/report-draft.service.ts',
  'features/report-new/report-fab.component.ts',
  'features/report-new/report-new.page.html',
  'features/report-new/report-new.page.ts',
  'features/report-new/sent-card.component.ts',
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|html)$/.test(name) ? [path] : [];
  });
}

export function stripComments(src: string, html: boolean): string {
  if (html) return src.replace(/<!--[\s\S]*?-->/g, '');
  // strings are kept: a '//' inside a quoted URL must not eat the rest of the line
  return src.replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) =>
    m.startsWith('/') ? '' : m,
  );
}

function offenders(): string[] {
  return files(app)
    .map((f) => relative(app, f).replace(/\\/g, '/'))
    .filter((f) => !f.endsWith('.spec.ts') && !f.endsWith('.testing.ts') && f !== 'i18n/th.ts')
    .filter((f) => THAI.test(stripComments(readFileSync(join(app, f), 'utf8'), f.endsWith('.html'))))
    .sort();
}

describe('no Thai literals outside the dictionary', () => {
  it('finds Thai only in files still pending, and every pending file still has some', () => {
    const found = offenders();
    expect(found.filter((f) => !PENDING.includes(f))).toEqual([]);
    expect(PENDING.filter((f) => !found.includes(f))).toEqual([]);
  }, 30_000);

  it('ignores comments but not strings', () => {
    expect(THAI.test(stripComments("// ไทย\nconst a = 'x'; /* ไทย */", false))).toBe(false);
    expect(THAI.test(stripComments("const u = 'http://x'; const a = 'ไทย';", false))).toBe(true);
    expect(THAI.test(stripComments('<!-- ไทย --><p>x</p>', true))).toBe(false);
    expect(THAI.test(stripComments('<p>ไทย</p>', true))).toBe(true);
  });
});
