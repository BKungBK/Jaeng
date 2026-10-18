import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IconComponent } from '../../shared/icon.component';
import { MapReturnService } from './map-return.service';

/** After a report went in: it waits for the admin, and nothing is public yet. */
@Component({
  selector: 'app-sent-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <span class="disc" aria-hidden="true"><app-icon name="check" [size]="32" /></span>
    <h2 id="rn-sent-title" tabindex="-1">ส่งแล้ว รอผู้ดูแลตรวจ</h2>
    <p class="lede">ขอบคุณที่แจ้งนะ เดี๋ยวผู้ดูแลตรวจให้ พอผ่านแล้วเรื่องนี้จะขึ้นเป็นสัญญาณไฟบนแผนที่</p>
    <div class="actions">
      <button type="button" class="btn primary big" (click)="mine()">ดูเรื่องของฉัน</button>
      <button type="button" class="btn big" (click)="home()">กลับไปแผนที่</button>
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
