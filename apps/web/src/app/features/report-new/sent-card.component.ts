import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { burst } from '../../core/motion';
import { TPipe } from '../../i18n/t.pipe';
import { TickComponent } from '../../shared/tick.component';
import { MapReturnService } from './map-return.service';

/** When the sparks leave the disc: the ring has drawn and the tick is on its way (sent-card.component.scss). */
export const SPARK_AT_MS = 400;

/**
 * After a report went in: it waits for the admin, and nothing is public yet. The one big moment of the
 * app (plan 8): a ring draws round the disc, the tick draws, a beam rises from it and sparks scatter,
 * and only then do the words float up, in the same language as the intro.
 */
@Component({
  selector: 'app-sent-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TickComponent, TPipe],
  template: `
    <span class="disc" #disc aria-hidden="true">
      <svg class="ring" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <circle cx="32" cy="32" r="30" pathLength="1" />
      </svg>
      <span class="beam"></span>
      <app-tick class="check" [size]="32" />
    </span>
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
  private disc = viewChild.required<ElementRef<HTMLElement>>('disc');

  constructor() {
    const timer = setTimeout(() => burst(this.disc().nativeElement, { count: 10, radius: 44, color: 'var(--pri)' }), SPARK_AT_MS);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }

  protected mine() {
    void this.router.navigate(['/me']);
  }

  protected home() {
    void this.back.go();
  }
}
