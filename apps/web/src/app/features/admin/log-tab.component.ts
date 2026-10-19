import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LocationMode, LogEntry } from '@jaeng/shared/admin';
import { IconComponent } from '../../shared/icon.component';
import { formatAgo, formatDate } from '../../shared/time';
import { rejectReasonText } from '../me/reject-reason';
import { AdminService } from './admin.service';
import { LOCATION_MODE_TH, LOG_ACTION_TH } from './admin-labels';

/** The API answers 50 entries a page; a shorter page is the last one. */
export const LOG_PAGE = 50;

const KIND_TH: Record<string, string> = { report: 'เรื่อง', comment: 'ความคิดเห็น', user: 'ผู้ใช้' };

/** Tab "บันทึก" (spec 3.10.5): every moderation action, newest first. */
@Component({
  selector: 'app-log-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  template: `
    @if (failed()) {
      <p class="caption">โหลดบันทึกไม่สำเร็จ ลองอีกครั้งนะ</p>
      <button type="button" class="btn retry" (click)="loadMore()"><app-icon name="refreshCw" [size]="18" />ลองอีกครั้ง</button>
    }
    <ol class="list">
      @for (e of entries(); track e.id) {
        <li class="entry">
          <p class="line">
            <strong>{{ action(e) }}</strong>
            <span class="kind">{{ kind(e) }}</span>
            @if (e.target_name) {
              <span class="name">{{ e.target_name }}</span>
            }
            @if (e.target_type === 'report' && e.target_id) {
              <a [routerLink]="['/r', e.target_id]">เปิดเรื่องนี้</a>
            }
          </p>
          @for (d of details(e); track d) {
            <p class="detail">{{ d }}</p>
          }
          <p class="meta">
            {{ e.admin_name ?? 'ระบบ' }} ·
            <time [attr.datetime]="e.created_at" [title]="date(e.created_at)">{{ ago(e.created_at) }}</time>
          </p>
        </li>
      } @empty {
        @if (!loading()) {
          <li class="empty-line">ยังไม่มีบันทึก</li>
        }
      }
    </ol>
    @if (loading()) {
      <p class="caption">กำลังโหลด…</p>
    }
    @if (hasMore() && !loading()) {
      <button type="button" class="btn more" (click)="loadMore()"><app-icon name="history" [size]="18" />ดูเก่ากว่านี้</button>
    }
  `,
  styleUrl: 'log-tab.component.scss',
})
export class LogTabComponent {
  private admin = inject(AdminService);

  protected readonly entries = signal<LogEntry[]>([]);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly hasMore = signal(false);

  constructor() {
    void this.loadMore();
  }

  protected async loadMore() {
    if (this.loading()) return;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const last = this.entries().at(-1)?.id ?? null;
      const page = await this.admin.log(last);
      this.entries.update((list) => [...list, ...page]);
      this.hasMore.set(page.length >= LOG_PAGE);
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected action = (e: LogEntry) => (LOG_ACTION_TH as Record<string, string>)[e.action] ?? e.action;
  protected kind = (e: LogEntry) => KIND_TH[e.target_type] ?? e.target_type;

  /** Only the keys we know, as plain text. */
  protected details(e: LogEntry): string[] {
    const d = e.detail ?? {};
    const out: string[] = [];
    // only reject_report logs a reason (a REJECT_REASONS key)
    if (typeof d['reason'] === 'string') out.push(`เหตุผล: ${rejectReasonText(d['reason'])}`);
    if (typeof d['note'] === 'string') out.push(`หมายเหตุ: ${d['note']}`);
    if (typeof d['location_mode'] === 'string') {
      out.push(`ตำแหน่ง: ${LOCATION_MODE_TH[d['location_mode'] as LocationMode] ?? d['location_mode']}`);
    }
    return out;
  }

  protected ago = formatAgo;
  protected date = formatDate;
}
