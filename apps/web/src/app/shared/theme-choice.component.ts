import { ChangeDetectionStrategy, Component, ElementRef, inject } from '@angular/core';
import { ThemeService, type ThemeChoice } from '../core/theme.service';
import type { IconName } from '../features/map/icons';
import type { MessageKey } from '../i18n/keys';
import { TPipe } from '../i18n/t.pipe';
import { IconComponent } from './icon.component';

const OPTIONS: readonly { value: ThemeChoice; icon: IconName; key: MessageKey }[] = [
  { value: 'system', icon: 'sunMoon', key: 'display.themeSystem' },
  { value: 'light', icon: 'sun', key: 'display.themeLight' },
  { value: 'dark', icon: 'moon', key: 'display.themeDark' },
];

/** Match device, light or dark, as a radiogroup (arrow keys move and choose). Kept on this device only. */
@Component({
  selector: 'app-theme-choice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, IconComponent],
  template: `
    <div class="seg" role="radiogroup" [attr.aria-label]="'display.theme' | t" (keydown)="onKey($event)">
      @for (o of options; track o.value) {
        <button
          type="button"
          role="radio"
          class="opt"
          [attr.data-value]="o.value"
          [attr.aria-checked]="theme.choice() === o.value"
          [tabIndex]="theme.choice() === o.value ? 0 : -1"
          (click)="pick(o.value, $event)"
        >
          <app-icon [name]="o.icon" [size]="18" />
          {{ o.key | t }}
        </button>
      }
    </div>
  `,
  styleUrl: 'choice.scss',
})
export class ThemeChoiceComponent {
  protected readonly theme = inject(ThemeService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly options = OPTIONS;

  /** the new theme grows from the middle of the button that was pressed */
  protected pick(value: ThemeChoice, e: Event) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.theme.set(value, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }

  protected onKey(e: KeyboardEvent) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = OPTIONS.findIndex((o) => o.value === this.theme.choice());
    const next = OPTIONS[(i + step + OPTIONS.length) % OPTIONS.length].value;
    const from = (e.target as HTMLElement).closest('[role="radio"]')?.getBoundingClientRect();
    this.theme.set(next, from && { x: from.left + from.width / 2, y: from.top + from.height / 2 });
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(`[data-value="${next}"]`)?.focus());
  }
}
