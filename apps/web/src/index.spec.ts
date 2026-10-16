import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('index.html', () => {
  it('declares Thai as the document language', () => {
    const html = readFileSync(resolve(process.cwd(), 'src/index.html'), 'utf8');
    expect(html).toMatch(/<html[^>]*\slang="th"/);
  });
});
