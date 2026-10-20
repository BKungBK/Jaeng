import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { DangerLevel, LEVELS } from '@jaeng/shared/levels';
import { FilterState } from '../../core/filter-state.service';
import { I18nService } from '../../core/i18n.service';
import { IconComponent } from '../../shared/icon.component';
import { FiltersPanelComponent } from './filters-panel.component';
import { TPipe } from '../../i18n/t.pipe';
import { LevelShapeComponent } from './level-shape';

// The four danger-level chips (spec 3.9, DESIGN.md "Chips"). Off is struck through and drained of
// colour, so it reads without colour. Text on pastel is always Slate Ink (DESIGN.md "Ink On Pastel"),
// in both themes.
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
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 6px;
      border-radius: 18px;
      background: var(--surf);
      box-shadow: var(--sh);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 44px;
      padding: 0 12px;
      border: 0;
      border-radius: 14px;
      background: color-mix(in srgb, var(--c) 55%, #fff);
      color: #2b2a33;
      font: 500 14px/1.4 var(--font);
      cursor: pointer;
    }
    .chip:hover {
      background: color-mix(in srgb, var(--c) 75%, #fff);
    }
    .chip[aria-pressed='false'] {
      background: transparent;
      box-shadow: inset 0 0 0 1px var(--line);
      color: var(--ink2);
      text-decoration: line-through;
    }
    .chip:focus-visible,
    .more:focus-visible {
      outline: 3px solid var(--pri);
      outline-offset: 2px;
    }
    :host {
      position: relative;
      display: block;
    }
    .more {
      position: relative;
      display: grid;
      place-items: center;
      flex: none;
      width: 44px;
      min-height: 44px;
      padding: 0;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surf);
      color: var(--ink);
      cursor: pointer;
    }
    .more:hover {
      background: var(--bg);
    }
    .more[aria-expanded='true'] {
      border-color: var(--pri);
    }
    .count {
      position: absolute;
      top: -6px;
      right: -6px;
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
    @media (max-width: 419px) {
      .chips {
        flex-wrap: nowrap;
        gap: 4px;
        padding: 4px;
      }
      .chip {
        gap: 4px;
        padding: 0 8px;
        font-size: 13px;
        white-space: nowrap;
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
