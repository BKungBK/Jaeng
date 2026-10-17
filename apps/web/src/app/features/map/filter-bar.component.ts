import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { DangerLevel, LEVELS } from '@jaeng/shared/levels';

// The four danger-level chips (spec 3.9, DESIGN.md "Chips"). Off is struck through, so it reads
// without colour.
@Component({
  selector: 'app-filter-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
          {{ l.symbol }} {{ l.nameTh }}
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
      min-height: 44px;
      padding: 0 12px;
      border: 0;
      border-radius: 14px;
      background: color-mix(in srgb, var(--c) 55%, var(--surf));
      color: var(--ink);
      font: 500 14px/1.4 'IBM Plex Sans Thai', system-ui, sans-serif;
      cursor: pointer;
      transition: opacity 150ms ease-out;
    }
    .chip:hover {
      background: color-mix(in srgb, var(--c) 70%, var(--surf));
    }
    .chip[aria-pressed='false'] {
      opacity: 0.45;
      text-decoration: line-through;
    }
    .chip:focus-visible {
      outline: 3px solid var(--pri);
      outline-offset: 2px;
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
