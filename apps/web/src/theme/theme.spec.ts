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

  it('leaves nothing behind after an entrance (a filling transform would trap fixed children)', () => {
    // the phone's "more filters" card is position: fixed inside the chip row; a rise kept with
    // fill "both" made the row its containing block and the card opened at the top of the screen
    for (const file of sourceFiles('src').filter((f) => !f.endsWith('.spec.ts'))) {
      expect(read(file), file).not.toMatch(/animation:\s*(rise|panel-in)\b[^;]*\b(both|forwards)\b/);
    }
  }, 30_000);

  it('ships the motion kit once, globally: one easing, one spring, the shared keyframes', () => {
    const motion = read('src/theme/_motion.scss');
    expect(read('src/global.scss')).toMatch(/@use 'theme\/motion'/);
    expect(motion).toMatch(/--ease:\s*cubic-bezier\(0\.2,\s*0\.8,\s*0\.2,\s*1\)/);
    expect(motion).toMatch(/--pop:\s*linear\(/);
    expect(motion).toMatch(/@property --p\b/);
    for (const name of ['tick-draw', 'ping', 'settle', 'sheen', 'shimmer', 'leave', 'shake', 'vt-reveal']) {
      expect(motion, name).toMatch(new RegExp(`@keyframes ${name}\\b`));
    }
    // the mixins file emits nothing by itself, so components can @use it without repeating the keyframes
    expect(read('src/theme/_motion-mixins.scss')).not.toMatch(/@keyframes/);
  });

  it('plays one-shot motion from a `from` frame only and never holds its end (a held transform traps fixed children)', () => {
    for (const file of sourceFiles('src').filter((f) => !f.endsWith('.spec.ts'))) {
      expect(read(file), file).not.toMatch(/animation:\s*(settle|ping|leave|shake|tick-draw)\b[^;]*\b(both|forwards)\b/);
    }
  }, 30_000);

  it('uses Anuphan everywhere except MapLibre glyph fonts', () => {
    const files = sourceFiles('src').filter((f) => !f.endsWith('map-style.ts') && !f.endsWith('theme.spec.ts'));
    expect(files.length).toBeGreaterThan(50);
    for (const file of files) {
      expect(read(file), file).not.toMatch(/'Prompt'|IBM Plex Sans Thai/);
    }
    expect(read('src/global.scss')).toMatch(/@fontsource\/anuphan\/400/);
  }, 30_000); // walks every source file, slow on the /mnt/d bind mount
});
