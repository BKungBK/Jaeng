import { SyncGate } from './sync-gate';

describe('SyncGate', () => {
  const view = { lng: 100.5, lat: 13.7, zoom: 6, bearing: 0, pitch: 0 };

  it('lets the first sync through and skips repeats while nothing moved', () => {
    const gate = new SyncGate();
    expect(gate.changed(view)).toBe(true);
    expect(gate.changed({ ...view })).toBe(false);
    expect(gate.changed({ ...view })).toBe(false);
  });

  it('syncs again after the camera moves or the data changes', () => {
    const gate = new SyncGate();
    gate.changed(view);
    expect(gate.changed({ ...view, zoom: 6.01 })).toBe(true);
    expect(gate.changed({ ...view, zoom: 6.01 })).toBe(false);
    gate.dataChanged();
    expect(gate.changed({ ...view, zoom: 6.01 })).toBe(true);
  });
});
