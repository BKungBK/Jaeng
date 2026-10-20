import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { DangerLevel, LEVELS } from '@jaeng/shared/levels';
import { FilterState } from '../../core/filter-state.service';
import { I18nService } from '../../core/i18n.service';
import { IconComponent } from '../../shared/icon.component';
import { FiltersPanelComponent } from './filters-panel.component';
import { TPipe } from '../../i18n/t.pipe';
import { LevelShapeComponent } from './level-shape';

// The four danger-level chips (spec 3.9, DESIGN.md "Chips"): small glass pills led by the level's
// shape in its colour (plan 6b). Off is struck through and drained of colour, so it reads without colour.
@Component({
  selector: 'app-filter-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LevelShapeComponent, TPipe, IconComponent, FiltersPanelComponent],
  template: `
    <div class="chips" role="group" [attr.aria-label]="'map.filterGroup' | t">
      @for (l of levelsInfo; track l.level) {
        <button
          type="button"
          class="chip"
          [style.--c]="l.color"
          [attr.aria-pressed]="filters.levels().includes(l.level)"
          (click)="toggle(l.level)"
        >
          <app-level-shape [level]="l.level" />
          {{ i18n.levelName(l.level) }}
        </button>
      }
      @let n = filters.extraCount();
      <button
        type="button"
        class="more"
        aria-haspopup="dialog"
        [attr.aria-expanded]="panelOpen()"
        [attr.aria-label]="n ? ('filters.buttonOn' | t: { n }) : ('filters.button' | t)"
        (click)="panelOpen.set(!panelOpen())"
      >
        <app-icon name="slidersHorizontal" [size]="20" />
        @if (n) {
          <span class="count" aria-hidden="true">{{ n }}</span>
        }
      </button>
    </div>
    @if (panelOpen()) {
      <app-filters-panel (closed)="closePanel()" />
    }
  `,
  styles: `
    /* plan 6b: no card behind the chips; each chip is a small glass pill (30 px seen, 44 px to press) */
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip,
    .more {
      position: relative;
      isolation: isolate;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      flex: none;
      min-height: 44px;
      padding: 0 11px;
      border: 0;
      background: transparent;
      color: var(--ink);
      font: 500 12px/1 var(--font);
      white-space: nowrap;
      cursor: pointer;
      transition: transform 120ms ease-out;
    }
    .chip::before,
    .more::before {
      content: '';
      position: absolute;
      z-index: -1;
      inset: 7px 0;
      border: 1px solid var(--glass-edge);
      border-radius: 15px;
      /* the map page sets a quieter ground for chips that already sit inside a glass panel */
      background: var(--chip-bg, var(--glass-bg));
      backdrop-filter: blur(16px) var(--glass-dim);
      -webkit-backdrop-filter: blur(16px) var(--glass-dim);
      transition:
        background-color 160ms ease-out,
        opacity 160ms ease-out;
    }
    .chip:hover::before,
    .more:hover::before {
      background-color: color-mix(in srgb, var(--ink) 10%, transparent);
    }
    .chip:active,
    .more:active {
      transform: scale(0.96);
    }
    .chip app-level-shape {
      color: var(--c);
      font-size: 14px;
    }
    /* off: drained and struck through, so it reads without colour */
    .chip[aria-pressed='false'] {
      color: var(--ink2);
      text-decoration: line-through;
    }
    .chip[aria-pressed='false']::before {
      opacity: 0.55;
    }
    .chip[aria-pressed='false'] app-level-shape {
      color: var(--ink2);
      opacity: 0.55;
    }
    .chip:focus-visible,
    .more:focus-visible {
      outline: none;
    }
    .chip:focus-visible::before,
    .more:focus-visible::before {
      box-shadow: 0 0 0 3px var(--pri);
    }
    :host {
      position: relative;
      display: block;
    }
    /* "more filters": a glass circle, 30 px seen inside the 44 px target */
    .more {
      width: 44px;
      padding: 0;
    }
    .more::before {
      inset: 7px;
      border-radius: 50%;
    }
    .more[aria-expanded='true']::before {
      border-color: var(--pri);
    }
    .count {
      position: absolute;
      top: 1px;
      right: 1px;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      box-sizing: border-box;
      border-radius: 10px;
      background: var(--pri);
      color: var(--onpri);
      font: 600 12px/20px var(--font);
      text-align: center;
    }
    /* narrow phones: one row that scrolls sideways */
    @media (max-width: 419px) {
      .chips {
        flex-wrap: nowrap;
        gap: 4px;
        padding: 0 3px; /* room for the focus ring at both ends */
        overflow-x: auto;
        scrollbar-width: none;
      }
      .chips::-webkit-scrollbar {
        display: none;
      }
      .chip {
        padding: 0 10px;
      }
    }
  `,
})
export class FilterBarComponent {
  protected readonly filters = inject(FilterState);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly panelOpen = signal(false);
  protected readonly levelsInfo = LEVELS;
  protected readonly i18n = inject(I18nService);

  protected toggle(level: DangerLevel) {
    const on = this.filters.levels();
    this.filters.levels.set(on.includes(level) ? on.filter((l) => l !== level) : [...on, level].sort((a, b) => a - b));
  }

  /** Done, Escape or a press outside: focus goes back to the button that opened it. */
  protected closePanel() {
    this.panelOpen.set(false);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.more')?.focus());
  }
}
