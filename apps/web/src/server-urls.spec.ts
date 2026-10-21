import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// Plan 7: in the APK the page origin is http://localhost, so `/api`, `/sb` and `location.origin` only
// work through core/server-config.service.ts, the one place that knows where the server is.
const app = resolve(process.cwd(), 'src/app');
const OWNER = 'core/server-config.service.ts';
const BANNED = [/location\.origin/, /fetch\(\s*['"`]\/api/, /['"`]\/sb[/'"`]/];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|html)$/.test(name) ? [path] : [];
  });
}

/** strings are kept: a '//' inside a quoted URL must not eat the rest of the line */
function withoutComments(src: string, html: boolean): string {
  if (html) return src.replace(/<!--[\s\S]*?-->/g, '');
  return src.replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) =>
    m.startsWith('/') ? '' : m,
  );
}

describe('server URLs', () => {
  it('are built only by ServerConfigService', () => {
    const found = files(app)
      .map((f) => relative(app, f).replace(/\\/g, '/'))
      .filter((f) => !/\.(spec|testing)\.ts$/.test(f) && f !== OWNER)
      .filter((f) => {
        const code = withoutComments(readFileSync(join(app, f), 'utf8'), f.endsWith('.html'));
        return BANNED.some((re) => re.test(code));
      });
    expect(found).toEqual([]);
  }, 30_000);
});
