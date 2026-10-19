import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import type { QueueClaim } from '@jaeng/shared/admin';
import { MSG_INTERNAL_TH } from '@jaeng/shared/api';
import { LEVELS, type DangerLevel } from '@jaeng/shared/levels';
import { ApiError } from '../../core/api.service';
import { IconComponent } from '../../shared/icon.component';
import { formatAgo, formatDate } from '../../shared/time';
import { categoryIcon } from '../map/beacon';
import { LevelShapeComponent } from '../map/level-shape';
import { AdminService } from './admin.service';

type LoadState = 'loading' | 'ready' | 'error';

/** Tab "แจ้งว่าแก้แล้ว" (spec 3.10.2): each claim with the before and after photos side by side. */
@Component({
  selector: 'app-claims-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, LevelShapeComponent],
  template: `
    <p class="status" role="status">{{ message() }}</p>
    @switch (state()) {
      @case ('loading') {
        <p class="caption">กำลังโหลด…</p>
        <div class="ghost"></div>
      }
      @case ('error') {
        <p class="caption">โหลดคิวไม่สำเร็จ ลองอีกครั้งนะ</p>
        <button type="button" class="btn retry" (click)="load()"><app-icon name="refreshCw" [size]="18" />ลองอีกครั้ง</button>
      }
      @case ('ready') {
        @for (c of items(); track c.id) {
          <article class="item" [style.--c]="level(c.report.danger_level).color">
            <div class="compare">
              <figure>
                @if (c.report.photos[0]; as p) {
                  <img [src]="p.url" alt="รูปก่อนแก้" />
                } @else {
                  <span class="tile"><app-icon [name]="icon(c.report.category)" [size]="36" /></span>
                }
                <figcaption>ก่อนแก้</figcaption>
              </figure>
              <figure>
                @if (c.photo; as p) {
                  <img [src]="p.url" alt="รูปหลังแก้" />
                } @else {
                  <span class="none">ไม่ได้แนบรูปหลังแก้</span>
                }
                <figcaption>หลังแก้</figcaption>
              </figure>
            </div>
            <h2>{{ c.report.title }}</h2>
            <ul class="tags">
              <li class="tag lvl"><app-level-shape [level]="level(c.report.danger_level).level" />ระดับ{{ level(c.report.danger_level).nameTh }}</li>
              <li class="tag"><app-icon name="clock" [size]="16" />ค้างมา {{ c.report.days_open }} วัน</li>
              @if (c.report.place_name) {
                <li class="tag"><app-icon name="mapPin" [size]="16" />{{ c.report.place_name }}</li>
              }
            </ul>
            <p class="who">
              แจ้งว่าแก้แล้วโดย <strong>{{ c.claimant.display_name }}</strong>
              @if (c.claimant.email) {
                <span class="email">{{ c.claimant.email }}</span>
              }
              <time [attr.datetime]="c.created_at" [title]="date(c.created_at)">{{ ago(c.created_at) }}</time>
            </p>
            @if (c.note) {
              <p class="note-text">{{ c.note }}</p>
            }
            <div class="decide">
              <button type="button" class="btn" [disabled]="busy()" (click)="review(c, false)">
                <app-icon name="circleX" [size]="18" />ยังไม่แก้
              </button>
              <button type="button" class="btn primary" [disabled]="busy()" (click)="review(c, true)">
                <app-icon name="circleCheck" [size]="18" />ยืนยันว่าแก้แล้ว
              </button>
            </div>
          </article>
        } @empty {
          <div class="empty">
            <span class="disc"><app-icon name="circleCheck" [size]="30" /></span>
            <p>ไม่มีคำขอรอตรวจ</p>
          </div>
        }
      }
    }
  `,
  styleUrl: 'claims-queue.component.scss',
})
export class ClaimsQueueComponent {
  private admin = inject(AdminService);
  readonly changed = output<void>();

  protected readonly state = signal<LoadState>('loading');
  protected readonly items = signal<QueueClaim[]>([]);
  protected readonly busy = signal(false);
  protected readonly message = signal('');

  constructor() {
    void this.load();
  }

  protected async load() {
    this.state.set('loading');
    try {
      this.items.set(await this.admin.queue('claims'));
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  protected async review(c: QueueClaim, approve: boolean) {
    if (this.busy()) return;
    this.busy.set(true);
    this.message.set('');
    try {
      await this.admin.reviewClaim(c.id, approve);
      this.items.update((list) => list.filter((x) => x.id !== c.id));
      this.message.set(approve ? 'ยืนยันแล้ว ลำแสงดับ เหลือเครื่องหมายถูก' : 'ส่งกลับเป็นยังไม่แก้แล้ว');
      this.changed.emit();
    } catch (e) {
      this.message.set(e instanceof ApiError ? e.messageTh : MSG_INTERNAL_TH);
      if (e instanceof ApiError && e.status === 409) {
        await this.load();
        this.changed.emit();
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected level = (n: number) => LEVELS[n as DangerLevel] ?? LEVELS[0];
  protected icon = categoryIcon;
  protected ago = formatAgo;
  protected date = formatDate;
}
