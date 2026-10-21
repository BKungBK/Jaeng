import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ServerConfigService } from '../core/server-config.service';
import { TPipe } from '../i18n/t.pipe';
import { IconComponent } from './icon.component';

/** A button to `/server`, shown only in the APK: on the web the server is the page you are on. */
@Component({
  selector: 'app-server-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink, TPipe],
  template: `
    @if (server.native) {
      <a class="btn" routerLink="/server"><app-icon name="link" [size]="18" />{{ 'server.title' | t }}</a>
    }
  `,
  styles: ':host { display: contents; }',
})
export class ServerLinkComponent {
  protected readonly server = inject(ServerConfigService);
}
