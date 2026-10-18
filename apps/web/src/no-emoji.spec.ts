import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Owner decision 2026-10-17: no emoji anywhere in the app; icons are Lucide SVG.
const PICTO = /\p{Extended_Pictographic}/u;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|html|scss)$/.test(name) && !path.endsWith('no-emoji.spec.ts') ? [path] : [];
  });
}

// the web container mounts packages at /packages; a local checkout has them two levels up
const shared = [resolve(process.cwd(), '../packages/shared'), resolve(process.cwd(), '../../packages/shared')].find(existsSync);

describe('no emoji in source', () => {
  it('finds the shared package', () => {
    expect(shared).toBeDefined();
  });

  it('has no pictographic characters in the web app or shared code', () => {
    const roots = [resolve(process.cwd(), 'src'), ...(shared ? [shared] : [])];
    const offenders = roots
      .flatMap((root) => files(root).filter((f) => !f.includes('node_modules')))
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .flatMap((line, i) => (PICTO.test(line) ? [`${f}:${i + 1}`] : [])),
      );
    expect(offenders).toEqual([]);
    // sync reads over the /mnt/d bind mount: ~1 s alone, past 5 s while other spec files run in parallel
  }, 30_000);
});
