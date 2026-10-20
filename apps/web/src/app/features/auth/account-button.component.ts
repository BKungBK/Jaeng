import { ChangeDetectionStrategy, Component, computed, inject, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { PopoverController } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { I18nService } from '../../core/i18n.service';
import { LOCALE_NAMES, type Locale } from '../../i18n/keys';
import { TPipe } from '../../i18n/t.pipe';
import { MeService } from '../me/me.service';
import { IconComponent } from '../../shared/icon.component';
import { ReportDraftService } from '../report-new/report-draft.service';
import { LoginPromptService } from './login-prompt.service';

type MenuRole = 'mine' | 'admin' | 'switch' | 'signout' | 'about';

// Thai leading vowels (เ แ โ ใ ไ) are written before the consonant they belong to; alone they are not a letter
const THAI_LEADING_VOWEL = /^[\u0E40-\u0E44]$/u;
const graphemes = new Intl.Segmenter('th', { granularity: 'grapheme' });

/** The first letter of a name as one whole grapheme (a Thai consonant keeps its vowel and tone marks). */
export function initialOf(name: string): string {
  for (const { segment } of graphemes.segment(name.trim())) {
    if (!THAI_LEADING_VOWEL.test(segment)) return segment.toLocaleUpperCase('th');
  }
  return '';
}

/** The account popover: who you are, switch user, sign out. It only reports the choice. */
@Component({
  selector: 'app-account-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [IconComponent, TPipe],
  template: `
    <div class="account-menu-body">
      <p class="account-menu-who">
        <span class="account-menu-name">{{ profile()?.display_name ?? ('account.mine' | t) }}</span>
        @if (profile()?.role === 'admin') {
          <span class="tag">{{ 'account.admin' | t }}</span>
        }
      </p>
      <button type="button" class="account-menu-item" (click)="choose('mine')">
        <app-icon name="fileText" [size]="20" />
        {{ 'account.myReports' | t }}
      </button>
      @if (profile()?.role === 'admin') {
        <button type="button" class="account-menu-item" (click)="choose('admin')">
          <app-icon name="shieldCheck" [size]="20" />
          {{ 'account.adminPage' | t }}
        </button>
      }
      <!-- switches in place: the menu stays open so the reader sees the change -->
      <button type="button" class="account-menu-item" [attr.lang]="other()" (click)="switchLanguage()">
        <app-icon name="languages" [size]="20" />
        {{ names[other()] }}
      </button>
      <button type="button" class="account-menu-item" (click)="choose('about')">
        <app-icon name="info" [size]="20" />
        {{ 'account.about' | t }}
      </button>
      <button type="button" class="account-menu-item" (click)="choose('switch')">
        <app-icon name="circleUser" [size]="20" />
        {{ 'account.switch' | t }}
      </button>
      <button type="button" class="account-menu-item" (click)="choose('signout')">
        <app-icon name="logOut" [size]="20" />
        {{ 'account.signOut' | t }}
      </button>
    </div>
  `,
  styles: `
    ion-popover.account-menu {
      --width: 240px;
      --background: var(--surf);
      --box-shadow: var(--sh);
      --backdrop-opacity: 0;
      --offset-x: -8px; /* the 8 px gap the floating elements keep (DESIGN.md Layout) */
    }
    ion-popover.account-menu::part(content) {
      border-radius: 18px;
    }
    .account-menu-body {
      display: grid;
      gap: 6px;
      padding: 8px; /* room for the 3 px + 2 px focus ring inside the popover's clipped content */
      color: var(--ink);
      font: 400 16px/1.6 'IBM Plex Sans Thai', system-ui, sans-serif;
    }
    .account-menu-who {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      margin: 0 0 4px;
      padding: 6px 8px 10px;
      border-bottom: 1px solid var(--line);
    }
    .account-menu-name {
      font: 500 15px/1.4 'Prompt', 'IBM Plex Sans Thai', system-ui, sans-serif;
      overflow-wrap: anywhere;
    }
    .account-menu-body .tag {
      padding: 1px 8px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--pri) 14%, var(--surf));
      color: var(--ink);
      font: 500 13px/1.5 'IBM Plex Sans Thai', system-ui, sans-serif;
    }
    .account-menu-item {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
      padding: 0 10px;
      border: 0;
      border-radius: 12px;
      background: none;
      color: var(--ink);
      font: 500 15px/1.4 'Prompt', 'IBM Plex Sans Thai', system-ui, sans-serif;
      text-align: left;
      cursor: pointer;
    }
    .account-menu-item:hover {
      background: var(--bg);
    }
    .account-menu-item:focus-visible {
      outline: 3px solid var(--pri);
      outline-offset: 2px;
    }
  `,
})
export class AccountMenuComponent {
  private popovers = inject(PopoverController);
  private i18n = inject(I18nService);
  private me = inject(MeService);
  protected readonly profile = inject(AuthService).profile;
  protected readonly names = LOCALE_NAMES;
  protected readonly other = computed<Locale>(() => (this.i18n.locale() === 'th' ? 'en' : 'th'));

  protected switchLanguage() {
    const l = this.other();
    this.i18n.setLocale(l);
    this.me.setLocale(l).catch((e) => console.warn('language not saved to the account', e));
  }

  protected choose(role: MenuRole) {
    void this.popovers.dismiss(undefined, role);
  }
}

/** The account control in the map's control column: log in when signed out, the account menu when signed in. */
@Component({
  selector: 'app-account-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <button type="button" class="ctl" [class.in]="auth.signedIn()" [attr.aria-label]="label()" (click)="open($event)">
      <!-- signed in shows the name's initial, so the state is told by shape as well as colour -->
      @if (initial(); as letter) {
        <span class="initial" aria-hidden="true">{{ letter }}</span>
      } @else {
        <app-icon name="circleUser" [size]="22" />
      }
    </button>
  `,
  styles: `
    :host {
      display: block;
    }
    .ctl {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      padding: 0;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surf);
      color: var(--ink);
      box-shadow: var(--sh);
      cursor: pointer;
    }
    /* the click target is the button, so the popover lines up with it, not with the icon */
    .ctl app-icon,
    .initial {
      pointer-events: none;
    }
    .initial {
      font: 600 19px/1 'Prompt', 'IBM Plex Sans Thai', system-ui, sans-serif;
    }
    .ctl:hover {
      background: var(--bg);
    }
    .ctl:focus-visible {
      outline: 3px solid var(--pri);
      outline-offset: 2px;
    }
    /* signed in: the icon takes the "me" blue, like the my-location dot */
    .ctl.in {
      border-color: color-mix(in srgb, var(--pri) 45%, var(--line));
      background: color-mix(in srgb, var(--pri) 14%, var(--surf));
      color: var(--pri);
    }
    .ctl.in:hover {
      background: color-mix(in srgb, var(--pri) 22%, var(--surf));
    }
  `,
})
export class AccountButtonComponent {
  protected readonly auth = inject(AuthService);
  private prompt = inject(LoginPromptService);
  private popovers = inject(PopoverController);
  private router = inject(Router);
  private draft = inject(ReportDraftService);
  private i18n = inject(I18nService);

  protected readonly label = computed(() => {
    if (!this.auth.signedIn()) return this.i18n.t('auth.login');
    const name = this.auth.profile()?.display_name;
    return name ? this.i18n.t('account.of', { name }) : this.i18n.t('account.mine');
  });

  /** Empty while signed out or while the profile loads: the icon shows instead. */
  protected readonly initial = computed(() => {
    const name = this.auth.signedIn() ? this.auth.profile()?.display_name : undefined;
    return name ? initialOf(name) : '';
  });

  protected async open(event: Event) {
    if (!this.auth.signedIn()) {
      await this.prompt.ask();
      return;
    }
    const popover = await this.popovers.create({
      component: AccountMenuComponent,
      cssClass: 'account-menu',
      event,
      side: 'left',
      alignment: 'end',
    });
    await popover.present();
    const { role } = await popover.onDidDismiss();
    if (role === 'mine') await this.router.navigate(['/me']);
    else if (role === 'admin') await this.router.navigate(['/admin']);
    else if (role === 'switch') await this.prompt.ask();
    else if (role === 'about') await this.router.navigate(['/about']);
    else if (role === 'signout') {
      // leaving on purpose: an unsent report draft goes too (a lapsed session keeps it, see ReportDraftService)
      this.draft.reset();
      await this.auth.signOut();
    }
  }
}
