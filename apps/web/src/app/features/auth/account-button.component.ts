import { ChangeDetectionStrategy, Component, computed, inject, ViewEncapsulation } from '@angular/core';
import { PopoverController } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { IconComponent } from '../../shared/icon.component';
import { LoginPromptService } from './login-prompt.service';

type MenuRole = 'switch' | 'signout';

/** The account popover: who you are, switch user, sign out. It only reports the choice. */
@Component({
  selector: 'app-account-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [IconComponent],
  template: `
    <div class="account-menu-body">
      <p class="account-menu-who">
        <span class="account-menu-name">{{ profile()?.display_name ?? 'บัญชีของฉัน' }}</span>
        @if (profile()?.role === 'admin') {
          <span class="tag">ผู้ดูแล</span>
        }
      </p>
      <button type="button" class="account-menu-item" (click)="choose('switch')">
        <app-icon name="circleUser" [size]="20" />
        สลับผู้ใช้
      </button>
      <button type="button" class="account-menu-item" (click)="choose('signout')">
        <app-icon name="logOut" [size]="20" />
        ออกจากระบบ
      </button>
    </div>
  `,
  styles: `
    ion-popover.account-menu {
      --width: 240px;
      --background: var(--surf);
      --box-shadow: 0 8px 28px rgba(60, 50, 40, 0.18);
      --backdrop-opacity: 0;
      --offset-x: -8px; /* the 8 px gap the floating elements keep (DESIGN.md Layout) */
    }
    ion-popover.account-menu::part(content) {
      border-radius: 18px;
    }
    .account-menu-body {
      display: grid;
      gap: 2px;
      padding: 8px;
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
      outline-offset: -3px;
    }
  `,
})
export class AccountMenuComponent {
  private popovers = inject(PopoverController);
  protected readonly profile = inject(AuthService).profile;

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
      <app-icon name="circleUser" [size]="22" />
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
    .ctl app-icon {
      pointer-events: none;
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

  protected readonly label = computed(() => {
    if (!this.auth.signedIn()) return 'เข้าสู่ระบบ';
    const name = this.auth.profile()?.display_name;
    return name ? `บัญชี: ${name}` : 'บัญชีของฉัน';
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
    if (role === 'switch') await this.prompt.ask();
    else if (role === 'signout') await this.auth.signOut();
  }
}
