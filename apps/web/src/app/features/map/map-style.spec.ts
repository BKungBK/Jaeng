import { holdBaseLabels, MapLike, REPORT_SOURCE, setupReportLayers, setupToyLayers, tintBaseMap } from './map-style';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type { FeatureCollection } from 'geojson';
import { TOY_FADE } from './toy';

const fc: FeatureCollection = { type: 'FeatureCollection', features: [] };

function recorder(baseLayers: { id: string; type: string }[] = []) {
  const layers: any[] = [];
  const sources: Record<string, any> = {};
  const paint: [string, string, unknown][] = [];
  const map = {
    addSource: (id: string, spec: unknown) => void (sources[id] = spec),
    addLayer: (spec: unknown) => void layers.push(spec),
    getStyle: () => ({ layers: baseLayers }),
    setPaintProperty: (id: string, prop: string, value: unknown) => void paint.push([id, prop, value]),
  } as unknown as MapLike;
  return { map, layers, sources, paint };
}

describe('setupToyLayers', () => {
  it('adds the toy layers in drawing order', () => {
    const r = recorder();
    setupToyLayers(r.map, { provinces: fc, land: fc, mask: fc });
    expect(r.layers.map((l) => l.id)).toEqual([
      'toy-mask',
      'sea-foam',
      'toy-soil-3',
      'toy-soil-2',
      'toy-soil-1',
      'toy-land',
      'toy-lines',
      'toy-rim',
      'toy-ink',
    ]);
  });

  it('builds layers MapLibre accepts', () => {
    const r = recorder();
    setupReportLayers(r.map);
    setupToyLayers(r.map, { provinces: fc, land: fc, mask: fc });
    const errors = validateStyleMin({ version: 8, sources: r.sources, layers: r.layers } as never);
    expect(errors.map((e: { message: string }) => e.message)).toEqual([]);
  });

  it('gives the report source an invisible layer so MapLibre loads its tiles', () => {
    const r = recorder();
    setupReportLayers(r.map);
    const anchor = r.layers.find((l) => l.id === 'reports-anchor');
    expect(anchor).toMatchObject({ source: REPORT_SOURCE, paint: { 'circle-opacity': 0 } });
  });

  it('keeps the mask opaque at every zoom so only Thailand shows', () => {
    const r = recorder();
    setupToyLayers(r.map, { provinces: fc, land: fc, mask: fc });
    expect(r.layers.find((l) => l.id === 'toy-mask').paint['fill-opacity']).toBe(1);
  });

  it('fades every other toy layer out between zoom 6 and 8', () => {
    const r = recorder();
    setupToyLayers(r.map, { provinces: fc, land: fc, mask: fc });
    for (const layer of r.layers.filter((l) => l.id.startsWith('toy-') && l.id !== 'toy-mask' && l.id !== 'toy-lines')) {
      // sea-foam is not a toy layer: it fades in at street zoom
      const key = Object.keys(layer.paint).find((k) => k.endsWith('-opacity'));
      expect(layer.paint[key!]).toEqual(TOY_FADE);
    }
  });

  it('paints each province its flat cel tone, lighter on hover', () => {
    const r = recorder();
    setupToyLayers(r.map, { provinces: fc, land: fc, mask: fc });
    const land = r.layers.find((l) => l.id === 'toy-land');
    expect(land.paint['fill-color']).toEqual(['case', ['boolean', ['feature-state', 'hover'], false], ['get', 'hover'], ['get', 'fill']]);
    expect(r.sources['toy-provinces'].promoteId).toBe('pcode');
  });

  it('stacks the soil layers 8/16/24 px down', () => {
    const r = recorder();
    setupToyLayers(r.map, { provinces: fc, land: fc, mask: fc });
    const soil = (n: number) => r.layers.find((l) => l.id === `toy-soil-${n}`).paint;
    // full depth on the toy, flattening as it fades so the coast does not ghost at zoom 7
    const depth = (px: number) => ['interpolate', ['linear'], ['zoom'], 6, ['literal', [0, px]], 8, ['literal', [0, 0]]];
    expect([soil(1), soil(2), soil(3)].map((p) => [p['fill-color'], p['fill-translate']])).toEqual([
      ['#DDB487', depth(8)],
      ['#C99E72', depth(16)],
      ['#B0855C', depth(24)],
    ]);
  });

  it('adds a clustered report source that tracks the highest level', () => {
    const r = recorder();
    setupReportLayers(r.map);
    expect(r.sources[REPORT_SOURCE]).toMatchObject({
      type: 'geojson',
      cluster: true,
      clusterMaxZoom: 11,
      clusterProperties: { maxLevel: ['max', ['get', 'danger_level']] },
    });
  });
});

describe('tintBaseMap', () => {
  it('recolours only the base layers that exist, water in the sea shallows', () => {
    const r = recorder([
      { id: 'background', type: 'background' },
      { id: 'water', type: 'fill' },
      { id: 'road', type: 'line' },
    ]);
    tintBaseMap(r.map, 'light', '#3FD6C8');
    expect(r.paint).toEqual([
      ['background', 'background-color', '#F4ECDC'],
      ['water', 'fill-color', '#3FD6C8'],
    ]);
  });
});

describe('holdBaseLabels', () => {
  it('keeps the street map place names off until zoom 7.5', () => {
    const ranges: [string, number, number][] = [];
    const r = recorder([
      { id: 'label_city', type: 'symbol' },
      { id: 'highway-name-major', type: 'symbol' },
      { id: 'water', type: 'fill' },
    ]);
    (r.map as any).setLayerZoomRange = (id: string, min: number, max: number) => ranges.push([id, min, max]);
    holdBaseLabels(r.map);
    expect(ranges).toEqual([['label_city', 7.5, 24]]);
  });
});
