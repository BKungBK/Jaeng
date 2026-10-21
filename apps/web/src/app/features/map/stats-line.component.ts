import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import type { Stats } from './stats.service';

export type StatsState = 'loading' | 'error' | Stats;

/** The numbers line of the hint card. Not live: it would chatter while the map pans. */
@Component({
  selector: 'app-stats-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, IconComponent],
  template: `
    @if (state() !== 'error') {
      @let s = numbers();
      @if (compact()) {
        <!-- the ring shows the share fixed; the words carry the numbers, so it is decoration -->
        <span class="ring" aria-hidden="true" [style.--p]="ratio()"></span>
        <b class="open">{{ 'map.stats.openShort' | t: { n: s.open } }}</b>
        <span class="fixed"><span aria-hidden="true">· </span>{{ 'map.stats.resolvedShort' | t: { n: s.resolved } }}</span>
      } @else {
        <span class="n"><app-icon name="circleCheck" [size]="16" />{{ 'map.stats.resolved' | t: { n: s.resolved } }}</span>
        <span class="sr-only"> · </span>
        <span class="n"><app-icon name="clock" [size]="16" />{{ 'map.stats.open' | t: { n: s.open } }}</span>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 2px 14px;
      color: var(--ink);
      font: 500 14px/1.5 var(--font);
      font-variant-numeric: tabular-nums;
    }
    :host:empty {
      display: none;
    }
    .n {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }
    /* compact: one line, the ring then "34 open · 4 fixed" */
    :host(.compact) {
      flex-wrap: nowrap;
      gap: 10px;
      min-width: 0;
      font: 400 13px/1.4 var(--font);
    }
    .ring {
      flex: none;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: conic-gradient(#f4b49a 0 calc(var(--p) * 100%), color-mix(in srgb, var(--ink) 14%, transparent) 0);
      -webkit-mask: radial-gradient(circle, transparent 9px, #000 10px);
      mask: radial-gradient(circle, transparent 9px, #000 10px);
      /* --p is a registered number (theme/_motion.scss), so the ring sweeps to a new share */
      transition: --p 700ms var(--ease, cubic-bezier(0.2, 0.8, 0.2, 1));
    }
    .open {
      flex: none;
      font-weight: 500;
      white-space: nowrap;
    }
    /* the numbers are not here yet: the placeholder dashes shimmer (ink gradient clipped to the text) until they are */
    :host(.loading) :is(.open, .fixed, .n) {
      background: linear-gradient(100deg, var(--ink2) 30%, var(--ink) 50%, var(--ink2) 70%) 150% 0 / 300% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: shimmer 1.4s linear infinite;
    }
    .fixed {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--ink2);
    }
  `,
  host: { '[class.compact]': 'compact()', '[class.loading]': "state() === 'loading'" },
})
export class StatsLineComponent {
  readonly state = input.required<StatsState>();
  /** the map's one-line summary: a ring and short words */
  readonly compact = input(false);

  /** fixed this month / (fixed + still open), 0 until there are numbers */
  ratio(): number {
    const s = this.state();
    if (typeof s !== 'object') return 0;
    const total = s.resolved_this_month + s.open_count;
    return total ? s.resolved_this_month / total : 0;
  }

  protected numbers() {
    const s = this.state();
    return typeof s === 'object' ? { resolved: s.resolved_this_month, open: s.open_count } : { resolved: '—', open: '—' };
  }
}
