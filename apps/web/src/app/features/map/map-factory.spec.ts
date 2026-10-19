import type maplibregl from 'maplibre-gl';
import { clampCenter, lockToThailand } from './map-factory';

function fakeMap(center: { lng: number; lat: number }) {
  const handlers: Record<string, (() => void)[]> = {};
  return {
    center,
    on: (type: string, fn: () => void) => void (handlers[type] ??= []).push(fn),
    fire: (type: string) => handlers[type]?.forEach((fn) => fn()),
    cameraForBounds: () => ({ zoom: 5 }),
    getContainer: () => ({ clientWidth: 375 }),
    setMinZoom: vi.fn(),
    getCenter: vi.fn(function (this: void) {
      return center;
    }),
    setCenter: vi.fn(),
  };
}

describe('lockToThailand', () => {
  it('pulls a centre that wandered off back inside the bounds', () => {
    const map = fakeMap({ lng: 120, lat: 13 });
    lockToThailand(map as unknown as maplibregl.Map);
    map.fire('move');
    expect(map.setCenter).toHaveBeenCalledWith(clampCenter([120, 13]));
  });

  it('leaves a centre inside alone', () => {
    const map = fakeMap({ lng: 100.5, lat: 13.75 });
    lockToThailand(map as unknown as maplibregl.Map);
    map.fire('move');
    expect(map.setCenter).not.toHaveBeenCalled();
  });

  // a map too small for its padding ("Map cannot fit within canvas") reports a NaN centre; setting
  // it again fires `move` again, forever (Maximum call stack size exceeded)
  it('ignores a centre that is not a number instead of setting it in a loop', () => {
    const map = fakeMap({ lng: NaN, lat: NaN });
    lockToThailand(map as unknown as maplibregl.Map);
    map.fire('move');
    expect(map.setCenter).not.toHaveBeenCalled();
  });
});
