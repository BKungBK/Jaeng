import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type maplibregl from 'maplibre-gl';
import { I18nService } from '../../core/i18n.service';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { MAP_FACTORY } from '../map/map-factory';
import { tintBaseMap } from '../map/map-style';
import { currentSeaTheme, SEA_HEX, watchSeaTheme, type SeaTheme } from '../map/sea/sea-palette';

export type LngLat = { lng: number; lat: number };

/** Street level, close enough to tell the two points apart. */
const ZOOM = 16;
const same = (a: LngLat, b: LngLat) => Math.abs(a.lng - b.lng) < 1e-7 && Math.abs(a.lat - b.lat) < 1e-7;

/**
 * The review queue's small map: the only MapLibre map on /admin, made once and moved between reports.
 * The true point and the shown point are HTML markers told apart by shape and a word. While picking,
 * a fixed centre pin replaces the markers and the centre is reported whenever the map rests.
 */
@Component({
  selector: 'app-place-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TPipe],
  template: `
    <div class="map" #map></div>
    @if (picking()) {
      <span class="pin" aria-hidden="true"><app-icon name="mapPin" [size]="40" /></span>
    } @else {
      @if (truePx(); as p) {
        <span class="marker true" [class.flip]="!together() && shownAtRight()" [style.left.px]="p.x" [style.top.px]="p.y">
          <span class="badge"><app-icon name="mapPin" [size]="20" /></span>
          <span class="word">{{ (together() ? 'admin.place.trueHere' : 'admin.place.trueSpot') | t }}</span>
        </span>
      }
      @if (!together() && shownPx(); as p) {
        <span class="marker shown" [class.flip]="!shownAtRight()" [style.left.px]="p.x" [style.top.px]="p.y">
          <span class="disc"></span>
          <span class="word">{{ 'admin.place.shown' | t }}</span>
        </span>
      }
    }
    <div class="zoom">
      <button type="button" [attr.aria-label]="'map.zoomIn' | t" (click)="zoomIn()"><app-icon name="plus" [size]="20" /></button>
      <button type="button" [attr.aria-label]="'map.zoomOut' | t" (click)="zoomOut()"><app-icon name="minus" [size]="20" /></button>
    </div>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      overflow: hidden;
      border-radius: 12px;
      background: var(--bg);
    }
    .map {
      position: absolute;
      inset: 0;
    }
    /* A marker is a zero-size anchor sitting exactly on its point; the pin and the word hang off it,
       so the point is the pin's tip (not the middle of the pin and its word). */
    .marker {
      position: absolute;
      z-index: 1;
      width: 0;
      height: 0;
      pointer-events: none;
      color: #2b2a33;
    }
    /* a white badge, so the pin reads on a dark map as well as a light one */
    .badge {
      position: absolute;
      left: -16px;
      top: -40px;
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
      isolation: isolate;
    }
    .badge::after {
      content: '';
      position: absolute;
      z-index: -1;
      left: 50%;
      bottom: -4px;
      width: 10px;
      height: 10px;
      margin-left: -5px;
      background: #fff;
      transform: rotate(45deg);
    }
    .disc {
      position: absolute;
      left: -8px;
      top: -8px;
      width: 16px;
      height: 16px;
      border: 3px solid #fff;
      border-radius: 50%;
      background: #2b2a33;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
      box-sizing: border-box;
    }
    .word {
      position: absolute;
      padding: 1px 8px;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      color: #2b2a33;
      font: 500 12px/1.5 var(--font);
      white-space: nowrap;
    }
    .true .word {
      left: 22px;
      top: -35px;
    }
    .shown .word {
      left: 14px;
      top: -11px;
    }
    /* apart, each word goes to the outer side of its marker, so the two never sit on each other */
    .true.flip .word {
      left: auto;
      right: 22px;
    }
    .shown.flip .word {
      left: auto;
      right: 14px;
    }
    /* top left: the words and the credits button take the right side */
    .zoom {
      position: absolute;
      z-index: 2;
      top: 8px;
      left: 8px;
      display: grid;
      gap: 4px;
    }
    .zoom button {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
      color: #2b2a33;
      cursor: pointer;
    }
    .zoom button:active {
      transform: scale(0.94);
    }
    .zoom button:focus-visible {
      outline: 3px solid var(--pri);
      outline-offset: 2px;
    }
    .pin {
      position: absolute;
      z-index: 1;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -100%);
      color: var(--pri);
      pointer-events: none;
    }
  `,
})
export class PlaceMapComponent {
  private createMap = inject(MAP_FACTORY);
  private i18n = inject(I18nService);
  private container = viewChild.required<ElementRef<HTMLElement>>('map');
  private map?: maplibregl.Map;
  private destroyed = false;
  private stopTheme?: () => void;

  readonly truePoint = input.required<LngLat>();
  readonly publicPoint = input.required<LngLat>();
  readonly picking = input(false);
  readonly picked = output<LngLat>();

  /** Bumped on every camera move so the marker positions follow the map. */
  private readonly frame = signal(0);
  protected readonly together = computed(() => same(this.truePoint(), this.publicPoint()));
  protected readonly truePx = computed(() => this.px(this.truePoint()));
  protected readonly shownPx = computed(() => this.px(this.publicPoint()));
  /** which side of the true marker the shown one is on (decides where each word goes) */
  protected readonly shownAtRight = computed(() => {
    const t = this.truePx();
    const s = this.shownPx();
    return !t || !s || s.x >= t.x;
  });

  constructor() {
    afterNextRender(() => void this.start());
    // a new report, or leaving the pin picker: frame the points again (picking has its own effect below)
    effect(() => {
      this.truePoint();
      this.picking();
      untracked(() => this.frameView());
    });
    // Picking starts from the shown point, never the true one (a hazard's true point must not be one
    // click away), and that start is reported at once so what is sent is what the pin shows.
    effect(() => {
      if (!this.picking()) return;
      untracked(() => this.startPicking());
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.stopTheme?.();
      this.map?.remove();
    });
  }

  private startPicking() {
    const p = this.publicPoint();
    this.map?.jumpTo({ center: [p.lng, p.lat], zoom: ZOOM });
    this.picked.emit({ lng: p.lng, lat: p.lat });
  }

  /** Street level on the true point, or both points in view when the shown one was moved away from it. */
  private frameView() {
    const map = this.map;
    if (!map || this.picking()) return;
    const t = this.truePoint();
    const s = this.publicPoint();
    if (same(t, s)) {
      map.jumpTo({ center: [t.lng, t.lat], zoom: ZOOM });
      return;
    }
    const side = Math.min(110, Math.round(map.getContainer().clientWidth * 0.3));
    map.fitBounds(
      [
        [Math.min(t.lng, s.lng), Math.min(t.lat, s.lat)],
        [Math.max(t.lng, s.lng), Math.max(t.lat, s.lat)],
      ],
      // room for the words beside the markers (but never so much that nothing fits); never closer than street level
      { padding: { top: 56, bottom: 28, left: side, right: side }, maxZoom: ZOOM, duration: 0 },
    );
  }

  protected zoomIn() {
    this.map?.zoomIn();
  }

  protected zoomOut() {
    this.map?.zoomOut();
  }

  /** The attribution starts open (and over a small map); fold it to its info button. */
  private foldAttribution(map: maplibregl.Map) {
    map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
  }

  private px(p: LngLat): { x: number; y: number } | null {
    this.frame();
    if (!this.map) return null;
    const { x, y } = this.map.project([p.lng, p.lat]);
    return { x, y };
  }

  private async start() {
    const map = await this.createMap(this.container().nativeElement, { padding: 12 });
    if (this.destroyed) {
      map.remove();
      return;
    }
    this.map = map;
    map.getCanvas().setAttribute('aria-label', this.i18n.t('admin.place.mapLabel'));
    this.foldAttribution(map);
    map.on('load', () => {
      this.foldAttribution(map);
      this.frame.update((n) => n + 1);
      const tint = (theme: SeaTheme) => tintBaseMap(map, theme, SEA_HEX[theme].shallow);
      tint(currentSeaTheme());
      this.stopTheme = watchSeaTheme(tint);
    });
    // markers follow the camera and the container size (the map can start before its box is laid out)
    for (const type of ['move', 'resize'] as const) map.on(type, () => this.frame.update((n) => n + 1));
    map.on('moveend', () => {
      if (!this.picking()) return;
      const c = map.getCenter();
      this.picked.emit({ lng: c.lng, lat: c.lat });
    });
    if (this.picking()) this.startPicking();
    else this.frameView();
    this.frame.update((n) => n + 1);
  }
}
