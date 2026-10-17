// Keeps one HTML marker per visible cluster or report in step with the clustered source
// (spec 4.4: HTML beacons, at most 150 on screen).
import type { DangerLevel } from '@jaeng/shared/levels';
import maplibregl, { GeoJSONFeature, GeoJSONSource } from 'maplibre-gl';
import { beaconView, createBeaconElement, createClusterElement, pickLabelIds, updateBeaconElement } from './beacon';
import { REPORT_SOURCE } from './map-style';
import type { ReportProps } from './report';

export const MAX_MARKERS = 150;

export type BeaconHandlers = {
  hover(p: ReportProps, el: HTMLElement): void;
  leave(): void;
  select(p: ReportProps): void;
  /** After each sync, with the screen boxes of every cluster and disc (for decluttering labels). */
  synced?(obstacles: DOMRect[]): void;
};

type Entry = { marker: maplibregl.Marker; el: HTMLElement; kind: 'beacon' | 'cluster'; props?: ReportProps; count?: number; maxLevel?: number };

type Item =
  | { kind: 'cluster'; key: string; lngLat: [number, number]; clusterId: number; count: number; maxLevel: DangerLevel }
  | { kind: 'beacon'; key: string; lngLat: [number, number]; props: ReportProps };

export class BeaconLayer {
  private entries = new Map<string, Entry>();
  private queued = false;
  private readonly onRender = () => this.queue();

  constructor(
    private map: maplibregl.Map,
    private handlers: BeaconHandlers,
  ) {
    map.on('render', this.onRender);
  }

  /** Coalesce bursts of render events into one sync per frame. */
  private queue() {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => {
      this.queued = false;
      this.sync();
    });
  }

  sync(): void {
    const map = this.map;
    if (!map.getSource(REPORT_SOURCE) || !map.isSourceLoaded(REPORT_SOURCE)) return;
    const zoom = map.getZoom();
    const bounds = map.getBounds();
    const items = this.collect(map.querySourceFeatures(REPORT_SOURCE)).filter((i) => bounds.contains(i.lngLat));

    const weight = (i: Item) => (i.kind === 'cluster' ? i.count : i.props.confirm_count);
    items.sort((a, b) => weight(b) - weight(a));
    const shown = items.slice(0, MAX_MARKERS);

    const full = shown.filter((i): i is Extract<Item, { kind: 'beacon' }> => i.kind === 'beacon' && !beaconView(i.props, zoom).compact);
    const labels = pickLabelIds(full.map((i) => i.props));

    const keep = new Set<string>();
    for (const item of shown) {
      keep.add(item.key);
      if (item.kind === 'beacon') this.showBeacon(item, zoom, labels.has(item.props.id));
      else this.showCluster(item);
    }
    for (const [key, entry] of this.entries) {
      if (!keep.has(key)) {
        if (entry.el.contains(document.activeElement)) this.handlers.leave();
        entry.marker.remove();
        this.entries.delete(key);
      }
    }
    if (this.handlers.synced) {
      const boxes = [...this.entries.values()].map((e) => e.el.querySelector('.disc, .count')!.getBoundingClientRect());
      this.handlers.synced(boxes);
    }
  }

  /** querySourceFeatures repeats features across tiles; keep one per cluster or report. */
  private collect(features: GeoJSONFeature[]): Item[] {
    const seen = new Map<string, Item>();
    for (const f of features) {
      if (f.geometry.type !== 'Point') continue;
      const lngLat = f.geometry.coordinates as [number, number];
      const p = f.properties as Record<string, unknown>;
      if (p['cluster']) {
        const key = `c${p['cluster_id']}`;
        if (!seen.has(key))
          seen.set(key, {
            kind: 'cluster',
            key,
            lngLat,
            clusterId: p['cluster_id'] as number,
            count: p['point_count'] as number,
            maxLevel: p['maxLevel'] as DangerLevel,
          });
      } else {
        const key = `r${p['id']}`;
        if (!seen.has(key)) seen.set(key, { kind: 'beacon', key, lngLat, props: p as unknown as ReportProps });
      }
    }
    return [...seen.values()];
  }

  private showBeacon(item: Extract<Item, { kind: 'beacon' }>, zoom: number, label: boolean) {
    const view = beaconView(item.props, zoom);
    const entry = this.entries.get(item.key);
    if (entry) {
      entry.props = item.props;
      updateBeaconElement(entry.el, item.props, view, label);
      entry.marker.setLngLat(item.lngLat);
      return;
    }
    const el = createBeaconElement(item.props, view, label);
    const created: Entry = { el, kind: 'beacon', props: item.props, marker: this.place(el, item.lngLat) };
    this.wireBeacon(created);
    this.entries.set(item.key, created);
  }

  private wireBeacon(entry: Entry) {
    const disc = () => entry.el.querySelector<HTMLElement>('.disc');
    entry.el.addEventListener('pointerover', (e) => {
      const d = disc();
      if (e.pointerType === 'mouse' && d && d.contains(e.target as Node)) this.handlers.hover(entry.props!, d);
    });
    entry.el.addEventListener('pointerout', (e) => {
      if (!entry.el.contains(e.relatedTarget as Node)) this.handlers.leave();
    });
    // keyboard users get the same summary as mouse hover
    entry.el.addEventListener('focusin', () => {
      const d = disc();
      if (d) this.handlers.hover(entry.props!, d);
    });
    entry.el.addEventListener('focusout', () => this.handlers.leave());
    entry.el.addEventListener('click', (e) => {
      if (disc()?.contains(e.target as Node)) this.handlers.select(entry.props!);
    });
    entry.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.handlers.select(entry.props!);
      }
    });
  }

  private showCluster(item: Extract<Item, { kind: 'cluster' }>) {
    const entry = this.entries.get(item.key);
    if (entry && entry.count === item.count && entry.maxLevel === item.maxLevel) {
      entry.marker.setLngLat(item.lngLat);
      return;
    }
    entry?.marker.remove();
    const el = createClusterElement(item.count, item.maxLevel);
    el.querySelector('button')!.addEventListener('click', () => this.expand(item.clusterId, item.lngLat));
    this.entries.set(item.key, { el, kind: 'cluster', count: item.count, maxLevel: item.maxLevel, marker: this.place(el, item.lngLat) });
  }

  private place(el: HTMLElement, lngLat: [number, number]) {
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(this.map);
    // MapLibre names every marker wrapper "Map marker"; the disc or count button inside is the real control
    el.removeAttribute('role');
    el.removeAttribute('aria-label');
    el.removeAttribute('tabindex');
    return marker;
  }

  private async expand(clusterId: number, center: [number, number]) {
    const source = this.map.getSource<GeoJSONSource>(REPORT_SOURCE);
    if (!source) return;
    const zoom = await source.getClusterExpansionZoom(clusterId);
    this.map.easeTo({ center, zoom: zoom + 0.5, duration: 700 });
  }

  destroy(): void {
    this.map.off('render', this.onRender);
    for (const entry of this.entries.values()) entry.marker.remove();
    this.entries.clear();
  }
}
