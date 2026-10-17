import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { DangerLevel, LEVELS } from '@jaeng/shared/levels';
import { LevelShapeComponent } from './level-shape';

// The four danger-level chips (spec 3.9, DESIGN.md "Chips"). Off is struck through and drained of
// colour, so it reads without colour. Text on pastel is always Slate Ink (DESIGN.md "Ink On Pastel"),
// in both themes.
@Component({
  selector: 'app-filter-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LevelShapeComponent],
  template: `
    <div class="chips" role="group" aria-label="กรองตามระดับอันตราย">
      @for (l of levelsInfo; track l.level) {
        <button
          type="button"
          class="chip"
          [style.--c]="l.color"
          [attr.aria-pressed]="levels().includes(l.level)"
          (click)="toggle(l.level)"
        >
          <app-level-shape [level]="l.level" />
          {{ l.nameTh }}
        </button>
      }
    </div>
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
      font: 500 14px/1.4 'IBM Plex Sans Thai', system-ui, sans-serif;
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
    .chip:focus-visible {
      outline: 3px solid var(--pri);
      outline-offset: 2px;
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
  readonly levels = model<readonly DangerLevel[]>([0, 1, 2, 3]);
  protected readonly levelsInfo = LEVELS;

  protected toggle(level: DangerLevel) {
    const on = this.levels();
    this.levels.set(on.includes(level) ? on.filter((l) => l !== level) : [...on, level].sort((a, b) => a - b));
  }
}
