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
        <span class="marker true" [style.left.px]="p.x" [style.top.px]="p.y">
          <app-icon name="mapPin" [size]="28" />
          <span class="word">{{ (together() ? 'admin.place.trueHere' : 'admin.place.trueSpot') | t }}</span>
        </span>
      }
      @if (!together() && shownPx(); as p) {
        <span class="marker shown" [style.left.px]="p.x" [style.top.px]="p.y">
          <span class="disc"></span>
          <span class="word">{{ 'admin.place.shown' | t }}</span>
        </span>
      }
    }
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
    .marker {
      position: absolute;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 2px;
      transform: translate(-50%, -100%);
      pointer-events: none;
      color: #2b2a33;
    }
    .marker.shown {
      transform: translate(-7px, -50%);
    }
    .disc {
      width: 14px;
      height: 14px;
      border: 3px solid #fff;
      border-radius: 50%;
      background: #2b2a33;
      box-sizing: border-box;
    }
    .word {
      padding: 1px 8px;
      border-radius: 10px;
      background: #fff;
      color: #2b2a33;
      font: 500 12px/1.5 var(--font);
      white-space: nowrap;
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

  constructor() {
    afterNextRender(() => void this.start());
    effect(() => {
      const p = this.truePoint();
      untracked(() => this.map?.jumpTo({ center: [p.lng, p.lat], zoom: ZOOM }));
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
    map.on('load', () => {
      // the attribution starts folded to its info button, so it does not cover a small map
      map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
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
    const p = this.truePoint();
    map.jumpTo({ center: [p.lng, p.lat], zoom: ZOOM });
    this.frame.update((n) => n + 1);
  }
}
