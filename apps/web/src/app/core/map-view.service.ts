import { Injectable, signal } from '@angular/core';
import type { Bbox } from '../features/map/report';

/** The map's last loaded view, so /list can show the same area (and the map can come back to it). */
@Injectable({ providedIn: 'root' })
export class MapViewService {
  private readonly _bbox = signal<Bbox | null>(null);
  private readonly _center = signal<[number, number] | null>(null);

  readonly bbox = this._bbox.asReadonly();
  readonly center = this._center.asReadonly();

  set(bbox: Bbox, center: [number, number]): void {
    this._bbox.set(bbox);
    this._center.set(center);
  }
}
