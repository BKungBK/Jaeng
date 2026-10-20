import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { NavController } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { TPipe } from '../../i18n/t.pipe';
import { LoginFormComponent } from './login-form.component';
import { safeNext } from './safe-next';

// /login?next=… for direct links. Logging in from the map uses the sheet instead (LoginPromptService).
@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoginFormComponent, TPipe],
  host: { class: 'ion-page' },
  template: `
    <main class="wrap">
      <h1 class="brand">{{ 'app.title' | t }}</h1>
      <div class="card">
        <app-login-form (done)="finish()" />
      </div>
      <a class="back" href="/" (click)="home($event)">{{ 'auth.backToMap' | t }}</a>
    </main>
  `,
  styles: `
    :host {
      background: var(--bg);
      color: var(--ink);
    }
    .wrap {
      box-sizing: border-box;
      display: grid;
      align-content: safe center; /* "safe": a taller card starts at the top instead of being cut off above */
      justify-items: center;
      gap: 16px;
      height: 100%; /* a fixed height so a short phone scrolls inside the page to its bottom */
      overflow-y: auto;
      padding: calc(24px + env(safe-area-inset-top, 0px)) 16px calc(24px + env(safe-area-inset-bottom, 0px));
    }
    .brand {
      margin: 0;
      font: 600 32px/1.2 var(--font);
    }
    .card {
      box-sizing: border-box;
      width: min(420px, 100%);
      padding: 24px 20px 20px;
      border-radius: 24px;
      background: var(--surf);
      box-shadow: var(--sh);
    }
    .back {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding: 0 8px;
      border-radius: 10px;
      color: var(--pri);
      font: 500 14px/1.4 var(--font);
      text-underline-offset: 3px;
    }
    .back:focus-visible {
      outline: 3px solid var(--pri);
      outline-offset: 2px;
    }
  `,
})
export class LoginPage {
  private nav = inject(NavController);
  private auth = inject(AuthService);

  /** Where to go after login (query param, bound by withComponentInputBinding). */
  readonly next = input<string | null | undefined>(null);

  constructor() {
    // already signed in (an old tab or a shared link): skip the form
    void this.auth.ready.then(() => {
      if (this.auth.signedIn()) this.finish();
    });
  }

  finish() {
    void this.nav.navigateRoot(safeNext(this.next()));
  }

  protected home(e: Event) {
    e.preventDefault();
    void this.nav.navigateRoot('/');
  }
}
