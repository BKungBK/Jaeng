import { TestBed } from '@angular/core/testing';
import { MAP_FACTORY } from '../map/map-factory';
import { fakeMap } from '../report-new/fake-map.testing';
import { PlaceMapComponent } from './place-map.component';

function setup() {
  const map = { ...fakeMap(16), project: vi.fn((ll: [number, number]) => ({ x: ll[0], y: ll[1] })) };
  const factory = vi.fn(async () => map);
  TestBed.configureTestingModule({ providers: [{ provide: MAP_FACTORY, useValue: factory }] });
  const fixture = TestBed.createComponent(PlaceMapComponent);
  const set = (truePoint: [number, number], publicPoint: [number, number], picking = false) => {
    fixture.componentRef.setInput('truePoint', { lng: truePoint[0], lat: truePoint[1] });
    fixture.componentRef.setInput('publicPoint', { lng: publicPoint[0], lat: publicPoint[1] });
    fixture.componentRef.setInput('picking', picking);
  };
  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      fixture.detectChanges();
      await Promise.resolve();
    }
  };
  const root = fixture.nativeElement as HTMLElement;
  return { fixture, map, factory, set, settle, root };
}

describe('PlaceMapComponent', () => {
  it('labels both markers with words, not colour alone', async () => {
    const { set, settle, root } = setup();
    set([100.5, 13.7], [100.501, 13.7]);
    await settle();
    expect(root.querySelector('.marker.true')?.textContent).toContain('จุดจริง');
    expect(root.querySelector('.marker.shown')?.textContent).toContain('จุดที่แสดง');
  });

  it('shows one marker when the points are the same', async () => {
    const { set, settle, root } = setup();
    set([100.5, 13.7], [100.5, 13.7]);
    await settle();
    expect(root.querySelector('.marker.shown')).toBeNull();
    expect(root.querySelector('.marker.true')?.textContent).toContain('จุดจริง (แสดงตรงนี้)');
  });

  it('creates the map once and moves it when the report changes', async () => {
    const { set, settle, factory, map } = setup();
    set([100.5, 13.7], [100.5, 13.7]);
    await settle();
    set([101, 14], [101, 14]);
    await settle();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(map.jumpTo).toHaveBeenLastCalledWith({ center: [101, 14], zoom: 16 });
  });

  it('while picking, reports the centre when the map comes to rest', async () => {
    const { fixture, set, settle, map, root } = setup();
    const picked = vi.fn();
    fixture.componentInstance.picked.subscribe(picked);
    set([100.5, 13.7], [100.5, 13.7], true);
    await settle();
    expect(root.querySelector('.pin')).not.toBeNull();
    map.cam.center = { lng: 100.52, lat: 13.71 };
    map.fire('moveend');
    expect(picked).toHaveBeenCalledWith({ lng: 100.52, lat: 13.71 });
  });

  it('starting to pick moves to the shown point and reports it at once (never the true point)', async () => {
    const { fixture, set, settle, map } = setup();
    const picked = vi.fn();
    fixture.componentInstance.picked.subscribe(picked);
    set([100.5, 13.7], [100.501, 13.701]);
    await settle();
    set([100.5, 13.7], [100.501, 13.701], true);
    await settle();
    expect(map.jumpTo).toHaveBeenLastCalledWith({ center: [100.501, 13.701], zoom: 16 });
    expect(picked).toHaveBeenCalledWith({ lng: 100.501, lat: 13.701 });
  });

  it('frames both points when the shown one was moved away, never closer than street level', async () => {
    const { set, settle, map } = setup();
    set([100.5, 13.7], [100.51, 13.71]);
    await settle();
    expect(map.fitBounds).toHaveBeenLastCalledWith(
      [
        [100.5, 13.7],
        [100.51, 13.71],
      ],
      expect.objectContaining({ maxZoom: 16, duration: 0 }),
    );
  });

  it('frames the points again when picking ends', async () => {
    const { set, settle, map } = setup();
    set([100.5, 13.7], [100.51, 13.71], true);
    await settle();
    map.fitBounds.mockClear();
    set([100.5, 13.7], [100.51, 13.71], false);
    await settle();
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('has zoom buttons', async () => {
    const { set, settle, map, root } = setup();
    set([100.5, 13.7], [100.5, 13.7]);
    await settle();
    const buttons = root.querySelectorAll<HTMLButtonElement>('.zoom button');
    expect(buttons).toHaveLength(2);
    buttons[0].click();
    buttons[1].click();
    expect(map.zoomIn).toHaveBeenCalledTimes(1);
    expect(map.zoomOut).toHaveBeenCalledTimes(1);
  });

  it('anchors a marker on its point, with the pin and the word hanging off it', async () => {
    const { set, settle, root } = setup();
    set([100.5, 13.7], [100.5, 13.7]);
    await settle();
    const marker = root.querySelector<HTMLElement>('.marker.true')!;
    expect(marker.style.left).toBe('100.5px');
    expect(marker.querySelector('.badge app-icon')).not.toBeNull();
  });

  it('sends each word to the outer side of its marker when the points are apart', async () => {
    const { set, settle, root } = setup();
    set([100.5, 13.7], [100.51, 13.7]); // the shown point is to the right of the true one
    await settle();
    expect(root.querySelector('.marker.true')?.classList.contains('flip')).toBe(true);
    expect(root.querySelector('.marker.shown')?.classList.contains('flip')).toBe(false);
    set([100.5, 13.7], [100.49, 13.7]);
    await settle();
    expect(root.querySelector('.marker.true')?.classList.contains('flip')).toBe(false);
    expect(root.querySelector('.marker.shown')?.classList.contains('flip')).toBe(true);
  });

  it('removes the map when destroyed', async () => {
    const { fixture, set, settle, map } = setup();
    set([100.5, 13.7], [100.5, 13.7]);
    await settle();
    fixture.destroy();
    expect(map.remove).toHaveBeenCalled();
  });
});
