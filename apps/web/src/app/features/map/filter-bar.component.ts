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
    <div class="chips">
      <div class="levels" role="group" [attr.aria-label]="'map.filterGroup' | t">
        @for (l of levelsInfo; track l.level) {
          <button
            type="button"
            class="chip"
            [style.--c]="l.color"
            [class.back]="backOn() === l.level"
            [attr.aria-pressed]="filters.levels().includes(l.level)"
            (click)="toggle(l.level)"
          >
            <app-level-shape [level]="l.level" />
            <span class="lbl">{{ i18n.levelName(l.level) }}</span>
          </button>
        }
      </div>
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
    /* the level group only matters on narrow phones, where it scrolls; elsewhere its chips are items of .chips */
    .levels {
      display: contents;
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
      transition: transform 200ms var(--ease);
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
      /* inside a glass panel a second blur sees nothing but the panel: those parents set none */
      backdrop-filter: var(--chip-blur, blur(16px) var(--glass-dim));
      -webkit-backdrop-filter: var(--chip-blur, blur(16px) var(--glass-dim));
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
    /* a dark rim keeps the shape (the cue that is not colour) at 3:1 on white glass: butter alone is 1.3:1 */
    .chip ::ng-deep app-level-shape svg {
      stroke: color-mix(in srgb, var(--c) 45%, #2b2a33);
      stroke-width: 1;
      paint-order: stroke;
    }
    /* off: drained and struck through, so it reads without colour. The strike is drawn left to right
       (a scaled line, not text-decoration) and the chip gives up a little; switched back on it settles. */
    .lbl {
      position: relative;
    }
    .lbl::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 1px;
      background: currentColor;
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 200ms var(--ease);
    }
    .chip[aria-pressed='false'] {
      color: var(--ink2);
      transform: scale(0.96);
    }
    .chip[aria-pressed='false'] .lbl::after {
      transform: scaleX(1);
    }
    .chip.back[aria-pressed='true'] {
      animation: settle var(--pop-dur) var(--pop) backwards;
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
    /* phones: a bigger chip to read and to press: 13 px type, a 34 px pill (the target stays 44) */
    @media (max-width: 819px) {
      .chip {
        font-size: 13px;
        padding: 0 10px;
      }
      .chip::before {
        inset: 5px 0;
        border-radius: 17px;
      }
      .more::before {
        inset: 5px;
      }
      .chip app-level-shape {
        font-size: 15px;
      }
    }
    /* phones: the four chips take the whole row; "more filters" is a round glass button in the column down the
       right edge (under the row, above locate), the same 48 px as the locate button */
    @media (max-width: 819px) {
      .chip {
        padding: 0 11px;
        gap: 6px;
      }
    }
    /* on the map the button leaves the row (the page gives its host .phone-chips) */
    @media (max-width: 819px) {
      :host(.phone-chips) .more {
        position: absolute;
        top: calc(100% + 3px);
        right: 0;
        width: 48px;
        height: 48px;
        min-height: 48px;
      }
      :host(.phone-chips) .more::before {
        inset: 0;
      }
      :host(.phone-chips) .count {
        top: -3px;
        right: -3px;
      }
    }
    /* narrow phones: the chips share the row evenly; a longer language that does not fit slides sideways */
    @media (max-width: 419px) {
      .levels {
        display: flex;
        flex: 1;
        min-width: 0;
        flex-wrap: nowrap;
        gap: 5px;
        padding: 0 3px; /* room for the focus ring at both ends */
        overflow-x: auto;
        scrollbar-width: none;
        overscroll-behavior-x: contain;
      }
      .levels::-webkit-scrollbar {
        display: none;
      }
      .levels .chip {
        flex: 1 1 auto;
      }
    }
  `,
  host: { '[class.open]': 'panelOpen()', '(document:pointerdown)': 'onPressAnywhere($event)' },
})
export class FilterBarComponent {
  protected readonly filters = inject(FilterState);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly panelOpen = signal(false);
  protected readonly levelsInfo = LEVELS;
  protected readonly i18n = inject(I18nService);

  /** the chip just switched back on: it settles once (and not when the map first loads with all four on) */
  protected readonly backOn = signal<DangerLevel | null>(null);

  protected toggle(level: DangerLevel) {
    const on = this.filters.levels();
    const turningOff = on.includes(level);
    this.filters.levels.set(turningOff ? on.filter((l) => l !== level) : [...on, level].sort((a, b) => a - b));
    if (!turningOff) this.backOn.set(level);
    else if (this.backOn() === level) this.backOn.set(null);
  }

  /** A press outside the tray and its panel closes the panel. The panel's own full-screen backdrop
   *  cannot do it inside a glass parent: backdrop-filter makes that parent the box of fixed children. */
  protected onPressAnywhere(e: Event) {
    if (this.panelOpen() && !this.host.nativeElement.contains(e.target as Node)) this.closePanel();
  }

  /** Done, Escape or a press outside: focus goes back to the button that opened it. */
  protected closePanel() {
    this.panelOpen.set(false);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.more')?.focus());
  }
}
