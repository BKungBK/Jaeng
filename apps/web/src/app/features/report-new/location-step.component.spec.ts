import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAP_FACTORY } from '../map/map-factory';
import { fakeMap } from './fake-map.testing';
import { LocationStepComponent } from './location-step.component';
import { ReportDraftService, type LocationSource } from './report-draft.service';

type Loc = { lng: number; lat: number; source: LocationSource } | null;

async function setup(opts: { location?: Loc; suggests?: Loc } = {}) {
  const map = fakeMap();
  const factory = vi.fn(() => map);
  const location = signal<Loc>(opts.location ?? null);
  const draft = {
    location,
    suggestLocation: vi.fn(async () => location.set(opts.suggests ?? null)),
    setLocation: vi.fn((p: { lng: number; lat: number }, source: LocationSource) => location.set({ ...p, source })),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: ReportDraftService, useValue: draft },
      { provide: MAP_FACTORY, useValue: factory },
    ],
  });
  const fixture = TestBed.createComponent(LocationStepComponent);
  const zooms: number[] = [];
  fixture.componentInstance.zoomChange.subscribe((z: number) => zooms.push(z));
  fixture.detectChanges();
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
    fixture.detectChanges();
  }
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  return { fixture, root, map, draft, zooms, factory };
}

describe('LocationStepComponent', () => {
  it('starts at the pin the draft already has, at street zoom, without asking again', async () => {
    const { map, draft, root } = await setup({ location: { lng: 100.5, lat: 13.75, source: 'exif' } });
    expect(map.jumpTo).toHaveBeenCalledWith({ center: [100.5, 13.75], zoom: 17 });
    expect(draft.suggestLocation).not.toHaveBeenCalled();
    expect(root.textContent).toContain('หมุดอยู่ตามตำแหน่งในรูป');
  });

  it('asks for a suggestion and goes there', async () => {
    const { map, draft, root } = await setup({ suggests: { lng: 100.6, lat: 13.8, source: 'device' } });
    expect(draft.suggestLocation).toHaveBeenCalled();
    expect(map.jumpTo).toHaveBeenCalledWith({ center: [100.6, 13.8], zoom: 17 });
    expect(root.textContent).toContain('หมุดอยู่ตามตำแหน่งของเครื่อง');
  });

  it('stays on the national view with no position, and the pin follows the map as a fallback', async () => {
    const { map, draft, root, zooms } = await setup({ suggests: null });
    expect(map.jumpTo).not.toHaveBeenCalled();
    expect(root.textContent).toContain('ไม่เจอตำแหน่งจากรูปหรือเครื่อง');
    expect(zooms.at(-1)).toBeCloseTo(5.2);
    map.cam.center = { lng: 100.52, lat: 13.74 };
    map.cam.zoom = 15;
    map.fire('zoom');
    map.fire('moveend');
    expect(draft.setLocation).toHaveBeenLastCalledWith({ lng: 100.52, lat: 13.74 }, 'fallback');
    expect(zooms.at(-1)).toBe(15);
  });

  it('keeps the source of the suggestion when the reporter nudges the pin', async () => {
    const { map, draft } = await setup({ location: { lng: 100.5, lat: 13.75, source: 'exif' } });
    map.cam.center = { lng: 100.501, lat: 13.751 };
    map.fire('moveend');
    expect(draft.setLocation).toHaveBeenLastCalledWith({ lng: 100.501, lat: 13.751 }, 'exif');
  });

  it('zooms with its own buttons and has a centre pin', async () => {
    const { root, map } = await setup({ location: { lng: 100.5, lat: 13.75, source: 'exif' } });
    root.querySelector<HTMLButtonElement>('button[aria-label="ซูมเข้า"]')!.click();
    root.querySelector<HTMLButtonElement>('button[aria-label="ซูมออก"]')!.click();
    expect(map.zoomIn).toHaveBeenCalled();
    expect(map.zoomOut).toHaveBeenCalled();
    expect(root.querySelector('.pin svg.icon-mapPin')).not.toBeNull();
  });

  it('asks for a map that fits Thailand into its small frame, not the home map’s padding', async () => {
    const { factory } = await setup({ location: { lng: 100.5, lat: 13.75, source: 'exif' } });
    expect(factory).toHaveBeenCalledWith(expect.any(HTMLElement), { padding: 12 });
  });

  it('removes its map when it goes away', async () => {
    const { fixture, map } = await setup({ location: { lng: 100.5, lat: 13.75, source: 'exif' } });
    fixture.destroy();
    expect(map.remove).toHaveBeenCalled();
  });
});
