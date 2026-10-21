import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { LoginPromptService } from '../auth/login-prompt.service';

/** The "Report" button on the map (.impeccable/surfaces/pp-features-report-new-*.md): the one warm
 *  dawn-gradient control. A pill on desktop, a round + in the phone dock. The map page places it;
 *  this component only decides where a tap goes. */
@Component({
  selector: 'app-report-fab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TPipe],
  template: `
    <button
      type="button"
      class="fab"
      [class.round]="variant() === 'round'"
      [attr.aria-label]="'newReport.fabLabel' | t"
      (click)="go()"
    >
      <app-icon name="plus" [size]="24" />
      @if (variant() === 'pill') {
        <span>{{ 'newReport.fab' | t }}</span>
      }
    </button>
  `,
  styles: `
    :host {
      display: block;
    }
    .fab {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-sizing: border-box;
      min-width: 46px;
      min-height: 46px;
      padding: 0 20px 0 16px;
      border: 0;
      border-radius: 23px;
      background: var(--dawn);
      color: var(--dawn-ink);
      box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.35),
        0 12px 30px -10px rgba(160, 112, 86, 0.42);
      font: 600 15px/1 var(--font);
      cursor: pointer;
      transition:
        filter 160ms ease-out,
        transform 120ms ease-out;
    }
    .fab.round {
      width: 46px;
      padding: 0;
      border-radius: 50%;
      box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.4),
        0 8px 22px -6px rgba(160, 112, 86, 0.48);
    }
    .fab:hover {
      filter: brightness(1.06) saturate(1.05);
    }
    .fab:active {
      transform: scale(0.96);
    }
    .fab:focus-visible {
      /* ink, not the accent: a peach ring would vanish against the dawn gradient */
      outline: 3px solid var(--ink);
      outline-offset: 2px;
    }
    .fab app-icon {
      pointer-events: none;
    }
  `,
})
export class ReportFabComponent {
  /** 'pill' = + and the word; 'round' = + only (the phone dock) */
  readonly variant = input<'pill' | 'round'>('pill');
  private auth = inject(AuthService);
  private prompt = inject(LoginPromptService);
  private router = inject(Router);

  protected async go() {
    if (!this.auth.signedIn() && !(await this.prompt.ask())) return;
    await this.router.navigate(['/report']);
  }
}
