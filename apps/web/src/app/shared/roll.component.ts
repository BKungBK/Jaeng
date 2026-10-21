import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** The digits of a count, left to right. Anything that is not a whole count (NaN, negative, a
 *  fraction) is read as the nearest whole count at or above 0. */
export function rollDigits(value: number): number[] {
  const n = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return String(n).split('').map(Number);
}

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
          <span class="strip"></span>
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
      display: block;
      transform: translateY(calc(var(--d) * -1.2em));
      transition: transform 420ms var(--ease, cubic-bezier(0.2, 0.8, 0.2, 1)) calc(var(--i) * 30ms);
    }
    /* the ten digits are drawn by CSS, so they are not text: copying or reading the count never sees them */
    .strip::before {
      content: '0\\A 1\\A 2\\A 3\\A 4\\A 5\\A 6\\A 7\\A 8\\A 9';
      display: block;
      white-space: pre;
    }
  `,
})
export class RollComponent {
  readonly value = input.required<number>();
  protected readonly digits = computed(() => rollDigits(this.value()));
  protected readonly shown = computed(() => this.digits().join(''));
  protected readonly cols = computed(() => {
    const digits = this.digits();
    return digits.map((d, i) => ({ d, place: digits.length - 1 - i }));
  });
}
