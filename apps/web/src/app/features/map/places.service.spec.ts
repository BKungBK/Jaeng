import { TestBed } from '@angular/core/testing';
import { PlacesService } from './places.service';

describe('PlacesService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks /api/places with the query and language, without a token', async () => {
    const answer = { places: [], online: true };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(answer), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await TestBed.inject(PlacesService).search('เชียง ใหม่', 'en')).toEqual(answer);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/places?q=${encodeURIComponent('เชียง ใหม่')}&lang=en`);
    expect(init).toBeUndefined();
  });

  it('adds more=1 only when OpenStreetMap is asked for', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"places":[],"online":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await TestBed.inject(PlacesService).search('ab', 'th', true);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/places?q=ab&lang=th&more=1');
  });

  it('rejects on an error answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 400 })));
    await expect(TestBed.inject(PlacesService).search('x', 'th')).rejects.toThrow('400');
  });
});
