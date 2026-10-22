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
import { liftAboveKeyboard } from './keyboard-lift';
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
  styleUrl: 'login-sheet.scss',
})
export class LoginSheetComponent {
  private modals = inject(ModalController);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private form = viewChild(LoginFormComponent);

  constructor() {
    // Ionic focuses the modal itself once it is shown; then move on to the email field
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => liftAboveKeyboard(this.host.nativeElement, destroyRef, () => this.form()?.focusFirst()));
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

  /** Resolves once no login sheet is open (at once when none is). */
  whenIdle(): Promise<void> {
    return this.pending ? this.pending.then(() => undefined) : Promise.resolve();
  }

  private async open(): Promise<boolean> {
    const modal = await this.modals.create({ component: LoginSheetComponent, cssClass: 'login-sheet' });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    return role === 'done';
  }
}
