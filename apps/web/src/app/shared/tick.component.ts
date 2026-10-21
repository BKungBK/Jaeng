import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A tick that draws itself (plan 8). Decorative: the control or message around it says what happened.
 *  `play` false shows it fully drawn at once (a state that was already true when the page loaded). */
@Component({
  selector: 'app-tick',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [class.play]="play()"
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" pathLength="1" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
    svg {
      display: block;
    }
    path {
      stroke-dasharray: 1;
      stroke-dashoffset: 0;
    }
    svg.play path {
      animation: tick-draw 280ms var(--ease, cubic-bezier(0.2, 0.8, 0.2, 1)) backwards;
    }
  `,
})
export class TickComponent {
  readonly size = input(20);
  readonly play = input(true);
}
