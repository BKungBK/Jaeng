import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { PopoverController } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { IconComponent } from '../../shared/icon.component';

export type ReportMenuRole = 'copy' | 'flag' | 'hide';

/** The ⋯ menu of the report detail. It only reports the choice; the panel acts on it. */
@Component({
  selector: 'app-report-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [IconComponent],
  template: `
    <div class="report-menu-body" role="menu" aria-label="ตัวเลือกเพิ่มเติม">
      <button type="button" role="menuitem" class="report-menu-item" (click)="choose('copy')">
        <app-icon name="link" [size]="20" />
        คัดลอกลิงก์
      </button>
      <button type="button" role="menuitem" class="report-menu-item" (click)="choose('flag')">
        <app-icon name="flag" [size]="20" />
        รายงานเนื้อหาไม่เหมาะสม
      </button>
      @if (profile()?.role === 'admin') {
        <button type="button" role="menuitem" class="report-menu-item" (click)="choose('hide')">
          <app-icon name="eyeOff" [size]="20" />
          ซ่อนเรื่องนี้
        </button>
      }
    </div>
  `,
  styles: `
    ion-popover.report-menu {
      --width: 248px;
      --background: var(--surf);
      --box-shadow: var(--sh);
      --backdrop-opacity: 0;
    }
    ion-popover.report-menu::part(content) {
      border-radius: 18px;
    }
    .report-menu-body {
      display: grid;
      gap: 4px;
      padding: 8px;
      color: var(--ink);
    }
    .report-menu-item {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
      padding: 0 10px;
      border: 0;
      border-radius: 12px;
      background: none;
      color: var(--ink);
      font: 500 15px/1.4 'Prompt', 'IBM Plex Sans Thai', system-ui, sans-serif;
      text-align: left;
      cursor: pointer;
    }
    .report-menu-item:hover {
      background: var(--bg);
    }
    .report-menu-item:focus-visible {
      outline: 3px solid var(--pri);
      outline-offset: 2px;
    }
  `,
})
export class ReportMenuComponent {
  private popovers = inject(PopoverController);
  protected readonly profile = inject(AuthService).profile;

  protected choose(role: ReportMenuRole) {
    void this.popovers.dismiss(undefined, role);
  }
}
