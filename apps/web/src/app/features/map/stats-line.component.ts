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
      <span class="n"><app-icon name="circleCheck" [size]="16" />{{ 'map.stats.resolved' | t: { n: s.resolved } }}</span>
      <span class="sr-only"> · </span>
      <span class="n"><app-icon name="clock" [size]="16" />{{ 'map.stats.open' | t: { n: s.open } }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 2px 14px;
      color: var(--ink);
      font: 500 14px/1.5 'IBM Plex Sans Thai', system-ui, sans-serif;
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
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
})
export class StatsLineComponent {
  readonly state = input.required<StatsState>();

  protected numbers() {
    const s = this.state();
    return typeof s === 'object' ? { resolved: s.resolved_this_month, open: s.open_count } : { resolved: '—', open: '—' };
  }
}
