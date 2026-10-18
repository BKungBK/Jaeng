// Test helper: a stand-in for maplibregl.Map, a camera the test can move and events it can fire.
export function fakeMap(zoom = 5.2) {
  const handlers: Record<string, (() => void)[]> = {};
  const cam = { center: { lng: 100.9, lat: 13.2 }, zoom };
  return {
    cam,
    on: (type: string, fn: () => void) => void (handlers[type] ??= []).push(fn),
    off: () => undefined,
    fire: (type: string) => handlers[type]?.forEach((fn) => fn()),
    getZoom: () => cam.zoom,
    getCenter: () => cam.center,
    jumpTo: vi.fn((o: { center: [number, number]; zoom: number }) => {
      cam.center = { lng: o.center[0], lat: o.center[1] };
      cam.zoom = o.zoom;
    }),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    getStyle: () => ({ layers: [] }),
    setPaintProperty: vi.fn(),
    getCanvas: () => document.createElement('canvas'),
    remove: vi.fn(),
  };
}
