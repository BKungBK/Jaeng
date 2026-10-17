import { MapLike, REPORT_SOURCE, setupMapLayers, tintBaseMap } from './map-style';
import type { FeatureCollection } from 'geojson';
import { TOY_FADE } from './toy';

const fc: FeatureCollection = { type: 'FeatureCollection', features: [] };

function recorder(baseLayers: { id: string; type: string }[] = []) {
  const layers: any[] = [];
  const sources: Record<string, any> = {};
  const paint: [string, string, unknown][] = [];
  const images: string[] = [];
  const map = {
    addSource: (id: string, spec: unknown) => void (sources[id] = spec),
    addLayer: (spec: unknown) => void layers.push(spec),
    getStyle: () => ({ layers: baseLayers }),
    setPaintProperty: (id: string, prop: string, value: unknown) => void paint.push([id, prop, value]),
    loadImage: async () => ({ data: {} }),
    addImage: (id: string) => void images.push(id),
    hasImage: (id: string) => images.includes(id),
  } as unknown as MapLike;
  return { map, layers, sources, paint, images };
}

describe('setupMapLayers', () => {
  it('adds the toy layers in drawing order', async () => {
    const r = recorder();
    await setupMapLayers(r.map, { provinces: fc, land: fc, mask: fc });
    expect(r.layers.map((l) => l.id)).toEqual([
      'toy-mask',
      'toy-soil-3',
      'toy-soil-2',
      'toy-soil-1',
      'toy-land',
      'toy-lines',
      'toy-rim',
      'toy-landmarks',
      'reports-anchor',
    ]);
  });

  it('gives the report source an invisible layer so MapLibre loads its tiles', async () => {
    const r = recorder();
    await setupMapLayers(r.map, { provinces: fc, land: fc, mask: fc });
    const anchor = r.layers.find((l) => l.id === 'reports-anchor');
    expect(anchor).toMatchObject({ source: REPORT_SOURCE, paint: { 'circle-opacity': 0 } });
  });

  it('fades every toy layer out between zoom 6 and 8', async () => {
    const r = recorder();
    await setupMapLayers(r.map, { provinces: fc, land: fc, mask: fc });
    for (const layer of r.layers.filter((l) => l.id.startsWith('toy-'))) {
      const key = Object.keys(layer.paint).find((k) => k.endsWith('-opacity'));
      expect(layer.paint[key!]).toEqual(TOY_FADE);
    }
  });

  it('paints Isan orange and the rest green', async () => {
    const r = recorder();
    await setupMapLayers(r.map, { provinces: fc, land: fc, mask: fc });
    const land = r.layers.find((l) => l.id === 'toy-land');
    expect(land.paint['fill-color']).toEqual(['match', ['get', 'region'], 'isan', '#F5A04A', '#79B83C']);
  });

  it('stacks the soil layers 8/16/24 px down', async () => {
    const r = recorder();
    await setupMapLayers(r.map, { provinces: fc, land: fc, mask: fc });
    const soil = (n: number) => r.layers.find((l) => l.id === `toy-soil-${n}`).paint;
    expect([soil(1), soil(2), soil(3)].map((p) => [p['fill-color'], p['fill-translate']])).toEqual([
      ['#AB7B42', [0, 8]],
      ['#946636', [0, 16]],
      ['#7B5430', [0, 24]],
    ]);
  });

  it('adds a clustered report source that tracks the highest level', async () => {
    const r = recorder();
    await setupMapLayers(r.map, { provinces: fc, land: fc, mask: fc });
    expect(r.sources[REPORT_SOURCE]).toMatchObject({
      type: 'geojson',
      cluster: true,
      clusterMaxZoom: 11,
      clusterProperties: { maxLevel: ['max', ['get', 'danger_level']] },
    });
  });

  it('loads every landmark image once', async () => {
    const r = recorder();
    await setupMapLayers(r.map, { provinces: fc, land: fc, mask: fc });
    expect(r.images).toContain('mountain');
    expect(new Set(r.images).size).toBe(r.images.length);
  });
});

describe('tintBaseMap', () => {
  it('recolours the base background and water into the palette', () => {
    const r = recorder([
      { id: 'background', type: 'background' },
      { id: 'water', type: 'fill' },
      { id: 'road', type: 'line' },
    ]);
    tintBaseMap(r.map);
    expect(r.paint).toEqual([
      ['background', 'background-color', '#F3EBDD'],
      ['water', 'fill-color', '#CFE3F0'],
    ]);
  });
});
