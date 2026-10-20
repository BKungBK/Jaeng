import { TestBed } from '@angular/core/testing';
import { MapViewService } from './map-view.service';

describe('MapViewService', () => {
  it('is empty until the map reports a view, then remembers the last one', () => {
    const view = TestBed.inject(MapViewService);
    expect(view.bbox()).toBeNull();
    expect(view.center()).toBeNull();
    view.set([100, 13, 101, 14], [100.5, 13.5]);
    view.set([98, 18, 99, 19], [98.5, 18.5]);
    expect(view.bbox()).toEqual([98, 18, 99, 19]);
    expect(view.center()).toEqual([98.5, 18.5]);
  });
});
