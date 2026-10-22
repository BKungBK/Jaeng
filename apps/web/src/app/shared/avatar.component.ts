import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { avatarUrl } from '../core/server-config.service';
import { IconComponent } from './icon.component';
import { initialOf } from './initial-of';

/**
 * A member's face: their picture in a circle, else the first letter of their name on the same accent
 * tint the account button always used for a signed-in member, else the `circleUser` icon (no name yet).
 * Decorative (`aria-hidden`): the name is always written next to it or on the control that holds it.
 */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    'aria-hidden': 'true',
    '[style.--avatar-size.px]': 'size()',
  },
  template: `
    @if (src(); as url) {
      <img [src]="url" alt="" draggable="false" (error)="failed.set(path() ?? null)" />
    } @else if (initial(); as letter) {
      <span class="initial">{{ letter }}</span>
    } @else {
      <app-icon name="circleUser" [size]="iconSize()" />
    }
  `,
  styles: `
    :host {
      display: grid;
      flex: none;
      place-items: center;
      width: var(--avatar-size);
      height: var(--avatar-size);
      overflow: hidden;
      border-radius: 50%;
      background: color-mix(in srgb, var(--pri) 24%, transparent);
      color: var(--ink);
      font: 600 calc(var(--avatar-size) * 0.47) / 1 var(--font);
      user-select: none;
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
})
export class AvatarComponent {
  readonly name = input<string | null | undefined>(null);
  /** the path in the `avatars` bucket (`profiles.avatar_path`) */
  readonly path = input<string | null | undefined>(null);
  readonly size = input(32);

  /** The path whose picture could not be loaded: that one shows the letter instead until the path changes. */
  protected readonly failed = signal<string | null>(null);
  protected readonly src = computed(() => {
    const path = this.path();
    return path && this.failed() !== path ? avatarUrl(path) : null;
  });
  protected readonly initial = computed(() => {
    const name = this.name();
    return name ? initialOf(name) : '';
  });
  protected readonly iconSize = computed(() => Math.round(this.size() * 0.6));
}
