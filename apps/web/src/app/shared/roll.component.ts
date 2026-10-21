import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** The digits of a count, left to right. Anything that is not a whole count (NaN, negative, a
 *  fraction) is read as the nearest whole count at or above 0. */
export function rollDigits(value: number): number[] {
  const n = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return String(n).split('').map(Number);
}

const TEN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * A count whose digits roll to their new value (plan 8). One column per place value, so 9 -> 10
 * rolls the units and brings a tens column in, and a screen reader hears the number once.
 * Size follows the text around it (1em columns).
 */
@Component({
  selector: 'app-roll',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="sr-only">{{ shown() }}</span>
    <span class="cols" aria-hidden="true">
      @for (c of cols(); track c.place) {
        <span class="col" [style.--d]="c.d" [style.--i]="c.place">
          <span class="strip">
            @for (k of ten; track k) {
              <i>{{ k }}</i>
            }
          </span>
        </span>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      font-variant-numeric: tabular-nums;
    }
    .cols {
      display: inline-flex;
    }
    .col {
      display: inline-block;
      height: 1.2em;
      overflow: hidden;
      line-height: 1.2;
    }
    .strip {
      display: flex;
      flex-direction: column;
      transform: translateY(calc(var(--d) * -1.2em));
      transition: transform 420ms var(--ease, cubic-bezier(0.2, 0.8, 0.2, 1)) calc(var(--i) * 30ms);
    }
    i {
      font-style: normal;
      height: 1.2em;
    }
  `,
})
export class RollComponent {
  readonly value = input.required<number>();
  protected readonly ten = TEN;
  protected readonly digits = computed(() => rollDigits(this.value()));
  protected readonly shown = computed(() => this.digits().join(''));
  protected readonly cols = computed(() => {
    const digits = this.digits();
    return digits.map((d, i) => ({ d, place: digits.length - 1 - i }));
  });
}
