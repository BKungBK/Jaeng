import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// Plan 6: every Thai word the app shows lives in i18n/th.ts. Specs and *.testing.ts fixtures may hold
// Thai (they check what Thai readers see); comments may too. Thai that must stay in code (a regex, a
// language's own name) is written as \u escapes.
const THAI = new RegExp('[\\u0E00-\\u0E7F]');
const app = resolve(process.cwd(), 'src/app');

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

describe('no Thai literals outside the dictionary', () => {
  it('finds Thai in no app file but i18n/th.ts', () => {
    const found = files(app)
      .map((f) => relative(app, f).replace(/\\/g, '/'))
      .filter((f) => !f.endsWith('.spec.ts') && !f.endsWith('.testing.ts') && f !== 'i18n/th.ts')
      .filter((f) => THAI.test(stripComments(readFileSync(join(app, f), 'utf8'), f.endsWith('.html'))));
    expect(found).toEqual([]);
  }, 30_000);

  it('ignores comments but not strings', () => {
    const thai = String.fromCharCode(0x0e44, 0x0e17, 0x0e22);
    expect(THAI.test(stripComments(`// ${thai}\nconst a = 'x'; /* ${thai} */`, false))).toBe(false);
    expect(THAI.test(stripComments(`const u = 'http://x'; const a = '${thai}';`, false))).toBe(true);
    expect(THAI.test(stripComments(`<!-- ${thai} --><p>x</p>`, true))).toBe(false);
    expect(THAI.test(stripComments(`<p>${thai}</p>`, true))).toBe(true);
  });
});
