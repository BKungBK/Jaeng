import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input } from '@angular/core';
import { iconElement, IconName } from '../features/map/icons';

/** A Lucide icon in currentColor. Decorative: label the control that holds it. */
@Component({
  selector: 'app-icon',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: inline-flex; line-height: 0; }',
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    effect(() => this.host.nativeElement.replaceChildren(iconElement(this.name(), this.size())));
  }
}
