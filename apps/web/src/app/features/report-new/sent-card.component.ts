import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { MapReturnService } from './map-return.service';

/** After a report went in: it waits for the admin, and nothing is public yet. */
@Component({
  selector: 'app-sent-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TPipe],
  template: `
    <span class="disc" aria-hidden="true"><app-icon name="check" [size]="32" /></span>
    <h2 id="rn-sent-title" tabindex="-1">{{ 'sent.title' | t }}</h2>
    <p class="lede">{{ 'sent.lede' | t }}</p>
    <div class="actions">
      <button type="button" class="btn primary big" (click)="mine()">{{ 'sent.mine' | t }}</button>
      <button type="button" class="btn big" (click)="home()">{{ 'load.backToMap' | t }}</button>
    </div>
  `,
  styleUrl: 'sent-card.component.scss',
})
export class SentCardComponent {
  private router = inject(Router);
  private back = inject(MapReturnService);

  protected mine() {
    void this.router.navigate(['/me']);
  }

  protected home() {
    void this.back.go();
  }
}
