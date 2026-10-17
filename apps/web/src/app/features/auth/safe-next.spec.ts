import { safeNext } from './safe-next';

describe('safeNext', () => {
  it.each(['/r/abc', '/', '/login?x=1', '/r/abc#c'])('keeps the in-app path %s', (next) => {
    expect(safeNext(next)).toBe(next);
  });

  it.each([
    '//evil.example',
    '/\\evil',
    'https://evil.example',
    'javascript:alert(1)',
    'r/abc',
    '/\t/evil.example', // browsers drop tabs and newlines, which would turn this into //evil.example
    '/\n/evil.example',
    '',
    null,
    undefined,
  ])('falls back to / for %j', (next) => {
    expect(safeNext(next)).toBe('/');
  });
});
