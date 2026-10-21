import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injectable,
  ViewEncapsulation,
  afterNextRender,
  viewChild,
} from '@angular/core';
import { ModalController } from '@ionic/angular';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { LoginFormComponent } from './login-form.component';

/**
 * The login form in an Ionic modal: a bottom sheet that grows to its content on phones (and rides
 * above the on-screen keyboard), a centred 420 px card from 820 px. Styles are global because Ionic
 * renders the modal outside this component; they are scoped by the `login-sheet` class.
 */
@Component({
  selector: 'app-login-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [LoginFormComponent, IconComponent, TPipe],
  template: `
    <div class="login-sheet-body">
      <button type="button" class="login-sheet-close" [attr.aria-label]="'common.close' | t" (click)="close()">
        <app-icon name="x" [size]="22" />
      </button>
      <app-login-form (done)="finish()" />
    </div>
  `,
  styles: `
    ion-modal.login-sheet {
      --width: 100%;
      --height: auto;
      --max-height: calc(100% - 24px - env(safe-area-inset-top, 0px));
      --border-radius: 24px 24px 0 0;
      --background: var(--surf);
      --box-shadow: var(--glass-shadow);
      --backdrop-opacity: 0.32;
      align-items: flex-end;
    }
    /* Ionic gives the component .ion-page (absolute, full size); auto height needs it in the flow */
    ion-modal.login-sheet .ion-page {
      position: relative;
      display: block;
      contain: content;
    }
    ion-modal.login-sheet::part(content) {
      margin-bottom: var(--kb, 0px);
      transition: margin-bottom 120ms ease-out;
    }
    @media (min-width: 820px) {
      ion-modal.login-sheet {
        --width: 420px;
        --border-radius: 24px;
        align-items: center;
      }
    }
    .login-sheet-body {
      position: relative;
      max-height: calc(100dvh - 24px - var(--kb, 0px) - env(safe-area-inset-top, 0px));
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 24px 20px calc(20px + env(safe-area-inset-bottom, 0px));
      box-sizing: border-box;
      color: var(--ink);
    }
    @media (min-width: 820px) {
      .login-sheet-body {
        padding: 28px 28px 24px;
      }
      .login-sheet-close {
        top: 18px;
        right: 18px;
      }
    }
    .login-sheet-close {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 1;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      padding: 0;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--surf);
      color: var(--ink);
      cursor: pointer;
    }
    .login-sheet-close:hover {
      background: var(--bg);
    }
    .login-sheet-close:focus-visible {
      outline: 3px solid var(--pri);
      outline-offset: 2px;
    }
    /* the title keeps clear of the close button */
    .login-sheet-body app-login-form .head {
      padding-right: 52px;
    }
  `,
})
export class LoginSheetComponent {
  private modals = inject(ModalController);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private form = viewChild(LoginFormComponent);

  constructor() {
    const destroyRef = inject(DestroyRef);
    // browsers that overlay the keyboard (Android Chrome's default) shrink only the visual
    // viewport, so lift the sheet by the part the keyboard covers
    afterNextRender(() => {
      const vv = window.visualViewport;
      const modal = this.host.nativeElement.closest<HTMLElement>('ion-modal');
      if (!modal) return;
      // Ionic focuses the modal itself once it is shown; then move on to the email field
      modal.addEventListener('ionModalDidPresent', () => this.form()?.focusFirst(), { once: true });
      if (!vv) return;
      const update = () => {
        const covered = Math.max(0, innerHeight - vv.height - vv.offsetTop);
        modal.style.setProperty('--kb', `${Math.round(covered)}px`);
      };
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
      update();
      destroyRef.onDestroy(() => {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      });
    });
  }

  close() {
    void this.modals.dismiss(undefined, 'cancel');
  }

  finish() {
    void this.modals.dismiss(undefined, 'done');
  }
}

/** Asks the visitor to log in without leaving the page. */
@Injectable({ providedIn: 'root' })
export class LoginPromptService {
  private modals = inject(ModalController);
  private pending?: Promise<boolean>;

  /** Resolves true once logged in, false when the sheet is closed. Calls while it is open share it. */
  ask(): Promise<boolean> {
    this.pending ??= this.open().finally(() => (this.pending = undefined));
    return this.pending;
  }

  private async open(): Promise<boolean> {
    const modal = await this.modals.create({ component: LoginSheetComponent, cssClass: 'login-sheet' });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    return role === 'done';
  }
}
