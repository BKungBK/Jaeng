// HTML parts of the toy map: Thai province labels (MapLibre's glyph renderer misplaces Thai
// vowel and tone marks) and the slow movers (train, planes, ships, clouds). All fade with the toy.
import maplibregl from 'maplibre-gl';
import { emojiUrl } from './emoji';
import { placeLabels, Rect } from './declutter';
import { toyLabelOpacity, toyOpacity } from './toy';
import { PROVINCE_LABELS, ROUTES } from './toy-places';

type LngLat = [number, number];
type Mover = { marker: maplibregl.Marker; path: LngLat[]; seconds: number; loop: boolean; lengths: number[]; total: number };

const dist = (a: LngLat, b: LngLat) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Point at fraction t (0..1) of a polyline. */
export function along(path: LngLat[], lengths: number[], total: number, t: number): LngLat {
  let d = t * total;
  for (let i = 0; i < lengths.length; i++) {
    if (d <= lengths[i] || i === lengths.length - 1) {
      const k = lengths[i] ? Math.min(1, d / lengths[i]) : 0;
      const [a, b] = [path[i], path[i + 1]];
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
    d -= lengths[i];
  }
  return path[0];
}

export class ToyOverlay {
  private labels: maplibregl.Marker[] = [];
  private movers: Mover[] = [];
  private raf = 0;
  private readonly onZoom = () => this.applyZoom();

  constructor(
    private map: maplibregl.Map,
    private reducedMotion: boolean,
  ) {
    for (const l of PROVINCE_LABELS) {
      const el = document.createElement('div');
      el.className = 'toy-label';
      // inner span carries the declutter offset; MapLibre owns the marker element's transform
      const text = document.createElement('span');
      text.textContent = l.name;
      el.appendChild(text);
      this.labels.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(l.lngLat).addTo(map));
    }
    for (const r of ROUTES) {
      const el = document.createElement('div');
      el.className = `toy-mover ${r.slug}`;
      const img = document.createElement('img');
      img.src = emojiUrl(r.slug);
      img.alt = '';
      el.appendChild(img);
      const lengths = r.path.slice(1).map((p, i) => dist(r.path[i], p));
      const first = r.path[0];
      const last = r.path[r.path.length - 1];
      const mover: Mover = {
        marker: new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(first).addTo(map),
        path: r.path,
        seconds: r.seconds,
        loop: first[0] === last[0] && first[1] === last[1],
        lengths,
        total: lengths.reduce((s, x) => s + x, 0),
      };
      this.movers.push(mover);
    }
    map.on('zoom', this.onZoom);
    this.applyZoom();
  }

  private applyZoom() {
    const zoom = this.map.getZoom();
    const opacity = toyOpacity(zoom);
    const labelOpacity = toyLabelOpacity(zoom);
    const k = Math.max(0, Math.min(1, (zoom - 4) / 2.5));
    for (const m of this.labels) {
      const el = m.getElement();
      el.style.opacity = String(labelOpacity);
      el.style.setProperty('--k', String(k));
      el.style.visibility = labelOpacity === 0 ? 'hidden' : '';
    }
    for (const m of this.movers) {
      const el = m.marker.getElement();
      el.style.opacity = String(opacity);
      el.style.visibility = opacity === 0 ? 'hidden' : '';
    }
    if (this.reducedMotion) this.place(0.3);
    else if (opacity > 0 && !this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  /** Move province names off clusters, beacons, movers and each other; hide one only when no
   *  nearby spot is free. */
  declutter(obstacles: readonly Rect[]): void {
    const spans = this.labels.map((m) => m.getElement().firstElementChild as HTMLElement);
    const movers = this.movers.map((m) => m.marker.getElement().getBoundingClientRect());
    const home = spans.map((s) => {
      const r = s.getBoundingClientRect();
      const dx = Number(s.dataset['dx'] ?? 0);
      const dy = Number(s.dataset['dy'] ?? 0);
      return { left: r.left - dx, right: r.right - dx, top: r.top - dy, bottom: r.bottom - dy };
    });
    const spots = placeLabels(home, [...obstacles, ...movers]);
    spans.forEach((s, i) => {
      const spot = spots[i];
      s.parentElement!.classList.toggle('clash', !spot);
      const [dx, dy] = spot ?? [0, 0];
      s.dataset['dx'] = String(dx);
      s.dataset['dy'] = String(dy);
      s.style.transform = dx || dy ? `translate(${dx}px, ${dy}px)` : '';
    });
  }

  private place(fixed?: number) {
    const now = performance.now() / 1000;
    for (const m of this.movers) {
      let t = fixed ?? (now % m.seconds) / m.seconds;
      if (!m.loop && fixed === undefined) t = t < 0.5 ? t * 2 : 2 - t * 2; // there and back
      m.marker.setLngLat(along(m.path, m.lengths, m.total, t));
    }
  }

  private readonly tick = () => {
    this.raf = 0;
    if (toyOpacity(this.map.getZoom()) === 0) return; // resumes from applyZoom
    this.place();
    this.raf = requestAnimationFrame(this.tick);
  };

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.map.off('zoom', this.onZoom);
    for (const m of [...this.labels, ...this.movers.map((x) => x.marker)]) m.remove();
  }
}
