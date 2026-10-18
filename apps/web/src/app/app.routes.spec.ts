import { UrlSegment } from '@angular/router';
import { mapMatcher } from './app.routes';

const segs = (...paths: string[]) => paths.map((p) => new UrlSegment(p, {}));

describe('mapMatcher', () => {
  it('matches the root with no params', () => {
    const r = mapMatcher([]);
    expect(r?.consumed).toEqual([]);
    expect(r?.posParams).toBeUndefined();
  });

  it('matches /r/:id and exposes the id', () => {
    const s = segs('r', 'x');
    const r = mapMatcher(s);
    expect(r?.consumed).toEqual(s);
    expect(r?.posParams?.['id'].path).toBe('x');
  });

  it('rejects everything else', () => {
    expect(mapMatcher(segs('r'))).toBeNull();
    expect(mapMatcher(segs('r', 'x', 'y'))).toBeNull();
    expect(mapMatcher(segs('login'))).toBeNull();
  });
});
