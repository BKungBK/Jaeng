import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  isDevMode,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type maplibregl from 'maplibre-gl';
import { IconComponent } from '../../shared/icon.component';
import { MAP_FACTORY } from '../map/map-factory';
import { tintBaseMap } from '../map/map-style';
import { currentSeaTheme, SEA_HEX, watchSeaTheme, type SeaTheme } from '../map/sea/sea-palette';
import { ReportDraftService } from './report-draft.service';

/** A suggested pin opens at street level, close enough to nudge it onto the right spot. */
export const PIN_ZOOM = 17;

const WHERE: Record<'looking' | 'exif' | 'device' | 'fallback', string> = {
  looking: 'กำลังหาตำแหน่ง…',
  exif: 'หมุดอยู่ตามตำแหน่งในรูป เลื่อนแผนที่ให้หมุดตรงจุดได้เลย',
  device: 'หมุดอยู่ตามตำแหน่งของเครื่อง เลื่อนแผนที่ให้หมุดตรงจุดได้เลย',
  fallback: 'ไม่เจอตำแหน่งจากรูปหรือเครื่อง เลื่อนและซูมแผนที่ไปยังจุดที่เจอปัญหานะ',
};

/**
 * Step 3's map: a plain street map (the same MAP_FACTORY as home, without the toy, the sea or the
 * beacons, so it stays one light WebGL context) under a fixed centre pin. Moving the map moves the pin.
 * Starts at the EXIF position, else the device, else the national view (then the page holds the send
 * button until zoom 14).
 */
@Component({
  selector: 'app-location-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <p class="caption where" aria-live="polite">{{ where() }}</p>
    <div class="frame">
      <div class="map" #map></div>
      <span class="pin" aria-hidden="true">
        <app-icon name="mapPin" [size]="44" />
        <span class="foot"></span>
      </span>
      <div class="zoom">
        <button type="button" class="ctl" aria-label="ซูมเข้า" (click)="zoomIn()"><app-icon name="plus" [size]="22" /></button>
        <button type="button" class="ctl" aria-label="ซูมออก" (click)="zoomOut()"><app-icon name="minus" [size]="22" /></button>
      </div>
    </div>
  `,
  styleUrl: 'location-step.component.scss',
})
export class LocationStepComponent {
  private createMap = inject(MAP_FACTORY);
  private draft = inject(ReportDraftService);
  private container = viewChild.required<ElementRef<HTMLElement>>('map');
  private map?: maplibregl.Map;
  private destroyed = false;
  private stopTheme?: () => void;

  readonly zoomChange = output<number>();
  protected readonly looking = signal(false);
  protected readonly where = computed(() => (this.looking() ? WHERE.looking : WHERE[this.draft.location()?.source ?? 'fallback']));

  constructor() {
    afterNextRender(() => void this.start());
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.stopTheme?.();
      this.map?.remove();
    });
  }

  private async start() {
    // a small map in a card: Thailand fills it, without the home map's room for floating cards
    const map = await this.createMap(this.container().nativeElement, { padding: 12 });
    if (this.destroyed) {
      map.remove();
      return;
    }
    this.map = map;
    map.getCanvas().setAttribute('aria-label', 'แผนที่ปักหมุด ใช้ลูกศรเลื่อนแผนที่ และปุ่ม + − ซูม');
    // dev builds expose the pin map for manual checks (window.__pinMap), like the home map's __map
    if (isDevMode()) (window as unknown as { __pinMap: maplibregl.Map }).__pinMap = map;
    map.on('load', () => {
      // the attribution starts folded to its info button, so it does not cover the bottom of a small map
      map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      const tint = (theme: SeaTheme) => tintBaseMap(map, theme, SEA_HEX[theme].shallow);
      tint(currentSeaTheme());
      this.stopTheme = watchSeaTheme(tint);
    });
    map.on('zoom', () => this.zoomChange.emit(map.getZoom()));
    map.on('moveend', () => this.follow());
    this.zoomChange.emit(map.getZoom());

    let at = this.draft.location();
    if (!at) {
      this.looking.set(true);
      await this.draft.suggestLocation();
      this.looking.set(false);
      if (this.destroyed) return;
      at = this.draft.location();
    }
    if (at) {
      map.jumpTo({ center: [at.lng, at.lat], zoom: PIN_ZOOM });
      this.zoomChange.emit(map.getZoom());
    }
  }

  /** The pin is the centre of the map: record it whenever the map comes to rest. */
  private follow() {
    const map = this.map;
    if (!map || this.looking()) return;
    const c = map.getCenter();
    this.draft.setLocation({ lng: c.lng, lat: c.lat }, this.draft.location()?.source ?? 'fallback');
  }

  protected zoomIn() {
    this.map?.zoomIn();
  }

  protected zoomOut() {
    this.map?.zoomOut();
  }
}
