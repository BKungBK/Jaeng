import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';
import { MeService } from '../features/me/me.service';
import { LOCALE_SWITCH, type Locale } from '../i18n/keys';

/**
 * The brand card's one-tap language switch ("EN" while Thai shows, "ไทย" while English shows). It
 * works signed out, which is when the demo switches. The same button stays, so focus stays on it.
 */
@Component({
  selector: 'app-language-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="ctl lang" [attr.aria-label]="target().label" (click)="toggle()">
      <span [attr.lang]="other()">{{ target().short }}</span>
    </button>
  `,
  styles: `
    :host {
      display: block;
    }
    .lang {
      display: grid;
      place-items: center;
      min-width: 44px;
      height: 44px;
      padding: 0 8px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surf);
      color: var(--ink);
      font: 600 14px/1 'Prompt', 'IBM Plex Sans Thai', system-ui, sans-serif;
      cursor: pointer;
    }
    .lang:hover {
      background: var(--bg);
    }
    .lang:focus-visible {
      outline: 3px solid var(--pri);
      outline-offset: 2px;
    }
  `,
})
export class LanguageToggleComponent {
  private i18n = inject(I18nService);
  private auth = inject(AuthService);
  private me = inject(MeService);

  protected readonly other = computed<Locale>(() => (this.i18n.locale() === 'th' ? 'en' : 'th'));
  protected readonly target = computed(() => LOCALE_SWITCH[this.other()]);

  protected toggle() {
    const l = this.other();
    this.i18n.setLocale(l);
    if (this.auth.signedIn()) this.me.setLocale(l).catch((e) => console.warn('language not saved to the account', e));
  }
}
