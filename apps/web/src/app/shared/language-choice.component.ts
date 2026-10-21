import { ApplicationRef, ChangeDetectionStrategy, Component, ElementRef, inject } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../core/i18n.service';
import { viewTransition } from '../core/motion';
import { MeService } from '../features/me/me.service';
import { LOCALE_NAMES, LOCALES, type Locale } from '../i18n/keys';
import { TPipe } from '../i18n/t.pipe';

/** Thai or English, as a radiogroup (arrow keys move and choose). Signed in, the account keeps it too. */
@Component({
  selector: 'app-language-choice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe],
  template: `
    <div class="seg" role="radiogroup" [attr.aria-label]="'display.language' | t" (keydown)="onKey($event)">
      @for (l of locales; track l) {
        <button
          type="button"
          role="radio"
          class="opt"
          [attr.lang]="l"
          [attr.aria-checked]="i18n.locale() === l"
          [tabIndex]="i18n.locale() === l ? 0 : -1"
          (click)="choose(l)"
        >
          {{ names[l] }}
        </button>
      }
    </div>
  `,
  styleUrl: 'choice.scss',
})
export class LanguageChoiceComponent {
  protected readonly i18n = inject(I18nService);
  private auth = inject(AuthService);
  private app = inject(ApplicationRef);
  private me = inject(MeService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly locales = LOCALES;
  protected readonly names = LOCALE_NAMES;

  protected choose(l: Locale) {
    if (l === this.i18n.locale()) return;
    // the words cross-fade (no circle: a language is not a light switch)
    viewTransition(async () => {
      this.i18n.setLocale(l);
      await this.app.whenStable(); // the new words must be on the page when the transition looks
    }).catch(() => undefined);
    // the device already switched; the account follows when it can
    if (this.auth.signedIn()) this.me.setLocale(l).catch((e) => console.warn('language not saved to the account', e));
  }

  protected onKey(e: KeyboardEvent) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = LOCALES.indexOf(this.i18n.locale());
    const next = LOCALES[(i + step + LOCALES.length) % LOCALES.length];
    this.choose(next);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(`[lang="${next}"]`)?.focus());
  }
}
