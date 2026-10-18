import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { IconComponent } from '../../shared/icon.component';
import { LoginPromptService } from '../auth/login-prompt.service';

/** The floating "แจ้ง" button on the map (.impeccable/surfaces/pp-features-report-new-*.md). The map
 *  page places it; this component only decides where a tap goes. */
@Component({
  selector: 'app-report-fab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <button type="button" class="fab" aria-label="แจ้งเรื่องใหม่" (click)="go()">
      <app-icon name="plus" [size]="24" />
      <span>แจ้ง</span>
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
      min-width: 116px;
      min-height: 56px;
      padding: 0 20px 0 16px;
      border: 0;
      border-radius: 14px;
      background: var(--pri);
      color: var(--onpri);
      box-shadow: var(--sh);
      font: 600 17px/1 'Prompt', 'IBM Plex Sans Thai', system-ui, sans-serif;
      cursor: pointer;
      transition: background-color 160ms ease-out;
    }
    .fab:hover {
      background: color-mix(in srgb, var(--pri) 88%, var(--ink));
    }
    .fab:active {
      transform: translateY(1px);
    }
    .fab:focus-visible {
      outline: 3px solid var(--pri);
      outline-offset: 2px;
    }
    .fab app-icon {
      pointer-events: none;
    }
  `,
})
export class ReportFabComponent {
  private auth = inject(AuthService);
  private prompt = inject(LoginPromptService);
  private router = inject(Router);

  protected async go() {
    if (!this.auth.signedIn() && !(await this.prompt.ask())) return;
    await this.router.navigate(['/report']);
  }
}
