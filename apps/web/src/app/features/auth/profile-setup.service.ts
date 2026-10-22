import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injectable,
  untracked,
  ViewEncapsulation,
  afterNextRender,
} from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { liftAboveKeyboard } from './keyboard-lift';
import { LoginPromptService } from './login-prompt.service';
import { ProfileFormComponent } from './profile-form.component';

/**
 * The profile step as its own sheet, for a member who is signed in but has not set up their profile (they closed
 * the login sheet on that step, reloaded, or signed in some other way). It has no close button and cannot be
 * dismissed by the backdrop or a swipe: the way out is saving the profile, or signing out. It wears the login
 * sheet's styles, so it looks like the step it replaces.
 */
@Component({
  selector: 'app-profile-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ProfileFormComponent],
  template: `
    <div class="login-sheet-body">
      <app-profile-form [signOutLink]="true" (done)="finish()" />
    </div>
  `,
  styleUrl: 'login-sheet.scss',
})
export class ProfileSheetComponent {
  private modals = inject(ModalController);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => liftAboveKeyboard(this.host.nativeElement, destroyRef));
    // signing out from the link (or in another tab) ends the sheet too
    const auth = inject(AuthService);
    effect(() => {
      if (!auth.signedIn()) untracked(() => void this.modals.dismiss(undefined, 'signout'));
    });
  }

  finish() {
    void this.modals.dismiss(undefined, 'done');
  }
}

/** Opens the profile sheet whenever a member is signed in and their profile is not set up yet. Created at boot. */
@Injectable({ providedIn: 'root' })
export class ProfileSetupService {
  private modals = inject(ModalController);
  private auth = inject(AuthService);
  private login = inject(LoginPromptService);
  private router = inject(Router);
  private open = false;

  constructor() {
    effect(() => {
      const profile = this.auth.profile();
      if (this.auth.signedIn() && profile && !profile.onboarded_at) untracked(() => void this.ensure());
    });
  }

  /** Shows the sheet unless it is already up, the login sheet is still doing the same job, or /login is. */
  async ensure(): Promise<void> {
    if (this.open) return;
    this.open = true;
    try {
      // the login sheet and the /login page have this step themselves: let them finish first
      await this.login.whenIdle();
      if (this.router.url.startsWith('/login') || !this.needed()) return;
      const modal = await this.modals.create({
        component: ProfileSheetComponent,
        cssClass: 'login-sheet',
        backdropDismiss: false,
        canDismiss: async (_data, role) => role === 'done' || role === 'signout',
      });
      await modal.present();
      await modal.onDidDismiss();
    } finally {
      this.open = false;
    }
  }

  private needed(): boolean {
    const profile = this.auth.profile();
    return this.auth.signedIn() && !!profile && !profile.onboarded_at;
  }
}
