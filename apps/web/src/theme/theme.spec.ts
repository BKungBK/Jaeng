import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

/** every .ts/.scss/.html under dir, relative to the web app root */
function sourceFiles(dir: string): string[] {
  return readdirSync(resolve(process.cwd(), dir), { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(path);
    return /\.(ts|scss|html)$/.test(e.name) ? [path] : [];
  });
}

describe('theme', () => {
  it('does not load an Ionic dark palette that overrides the tokens', () => {
    expect(read('src/global.scss')).not.toMatch(/palettes\/dark\./);
  });

  it('gives Ionic the rgb and step colours in both themes', () => {
    const tokens = read('src/theme/tokens.scss');
    // once on the light :root, once in the dark mixin
    const count = (s: string) => tokens.split(s).length - 1;
    expect(count('--ion-background-color-rgb:')).toBeGreaterThanOrEqual(2);
    expect(count('--ion-text-color-rgb:')).toBeGreaterThanOrEqual(2);
    // step shades come from one mixin used by both themes
    expect(tokens).toMatch(/--ion-background-color-step-50:/);
    expect(tokens).toMatch(/--ion-text-color-step-50:/);
    expect(count('@include ion-steps')).toBeGreaterThanOrEqual(2);
  });

  it('has one glass material, loaded globally', () => {
    const glass = read('src/theme/glass.scss');
    expect(glass).toMatch(/\.glass\s*\{[^}]*backdrop-filter/s);
    expect(glass).toMatch(/--noise:/);
    expect(glass).toMatch(/--dawn:/);
    expect(read('src/global.scss')).toMatch(/theme\/glass/);
  });

  it('uses Anuphan everywhere except MapLibre glyph fonts', () => {
    const files = sourceFiles('src').filter((f) => !f.endsWith('map-style.ts') && !f.endsWith('theme.spec.ts'));
    expect(files.length).toBeGreaterThan(50);
    for (const file of files) {
      expect(read(file), file).not.toMatch(/'Prompt'|IBM Plex Sans Thai/);
    }
    expect(read('src/global.scss')).toMatch(/@fontsource\/anuphan\/400/);
  }, 30_000); // walks every source file, slow on the /mnt/d bind mount
});
