import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

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
});
