import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TPipe } from '../i18n/t.pipe';
import { IconComponent } from './icon.component';

/**
 * "This is not an emergency channel" with the three numbers to call (spec 3.4): on every critical
 * report and on /about. Rose means danger here, which is the only thing it may mean.
 */
@Component({
  selector: 'app-emergency-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, IconComponent],
  template: `
    <div class="emergency">
      <app-icon name="phone" [size]="20" />
      <p>
        {{ 'detail.emergency' | t }}
        <span class="numbers">
          <a href="tel:191">191</a><span class="sep" aria-hidden="true"> / </span><a href="tel:199">199</a
          ><span class="sep" aria-hidden="true"> / </span><a href="tel:1669">1669</a>
        </span>
      </p>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    p {
      margin: 0;
    }
    .emergency {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding: 12px 14px;
      border-radius: 18px; /* plan 6b: rounder like the glass around it; the warning colours stay */
      background: color-mix(in srgb, var(--s3) 24%, #fff);
      color: #2b2a33;
      font-size: 14px;
      line-height: 1.6;
    }
    app-icon {
      flex: none;
      margin-top: 2px;
    }
    a {
      display: inline-grid;
      place-items: center;
      min-width: 56px;
      min-height: 44px;
      padding: 0 6px;
      border-radius: 12px;
      background: transparent; /* plain links, not white pills inside the card (finish review) */
      color: #2b2a33;
      font: 600 18px/1 var(--font);
      font-variant-numeric: tabular-nums;
      text-decoration: underline;
      text-decoration-thickness: 2px;
      text-underline-offset: 4px;
      transition: background-color 160ms ease-out;
    }
    a:hover {
      background: color-mix(in srgb, var(--s3) 18%, transparent);
    }
    a:focus-visible {
      outline: 3px solid #2b2a33;
      outline-offset: 2px;
    }
    .numbers {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
      margin-top: 6px;
    }
    .sep {
      color: color-mix(in srgb, #2b2a33 60%, transparent);
    }
  `,
})
export class EmergencyBoxComponent {}
