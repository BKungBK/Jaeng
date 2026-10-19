import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import type { FlagAction, HiddenItem, QueueFlag } from '@jaeng/shared/admin';
import { MSG_INTERNAL_TH } from '@jaeng/shared/api';
import { ApiError } from '../../core/api.service';
import { IconComponent } from '../../shared/icon.component';
import { formatAgo, formatDate } from '../../shared/time';
import { STATUS_ICON, STATUS_TH } from '../me/reject-reason';
import { FLAG_REASON_TH } from '../report-detail/flag-reason';
import { AdminService } from './admin.service';

type LoadState = 'loading' | 'ready' | 'error';

const DONE: Record<FlagAction, string> = {
  dismiss: 'ยกเลิกรายงานแล้ว',
  hide: 'ซ่อนแล้ว',
  ban: 'ซ่อนและแบนเจ้าของแล้ว',
};

/** Tab "ถูกรายงาน" (spec 3.10.3): one card per reported target, then what is hidden now. */
@Component({
  selector: 'app-flags-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <p class="status" role="status">{{ message() }}</p>
    @switch (state()) {
      @case ('loading') {
        <p class="caption">กำลังโหลด…</p>
        <div class="ghost"></div>
      }
      @case ('error') {
        <p class="caption">โหลดรายการไม่สำเร็จ ลองอีกครั้งนะ</p>
        <button type="button" class="btn retry" (click)="load()"><app-icon name="refreshCw" [size]="18" />ลองอีกครั้ง</button>
      }
      @case ('ready') {
        @for (t of items(); track t.flag_id) {
          <article class="item">
            <ul class="tags">
              <li class="tag"><app-icon [name]="t.target_type === 'report' ? 'fileText' : 'messageCircle'" [size]="16" />{{ t.target_type === 'report' ? 'เรื่อง' : 'ความคิดเห็น' }}</li>
              <li class="tag"><app-icon [name]="statusIcon(t)" [size]="16" />{{ statusWord(t) }}</li>
              @if (t.hidden) {
                <li class="tag"><app-icon name="eyeOff" [size]="16" />ซ่อนอยู่</li>
              }
              <li class="tag"><app-icon name="flag" [size]="16" />{{ t.flags.length }} รายงาน</li>
            </ul>
            <h2>{{ t.report.title }}</h2>
            @if (t.comment; as cm) {
              <blockquote class="body">{{ cm.body }}</blockquote>
              @if (cm.photo?.thumb_url) {
                <img class="attached" [src]="cm.photo!.thumb_url" alt="รูปที่แนบในความคิดเห็น" />
              }
            } @else if (t.report.photo?.thumb_url) {
              <img class="attached" [src]="t.report.photo!.thumb_url" alt="รูปของเรื่องนี้" />
            }
            <ul class="reasons-list">
              @for (f of t.flags; track $index) {
                <li>
                  <strong>{{ reasonWord(f.reason) }}</strong>
                  @if (f.note) {
                    <span class="note-text">{{ f.note }}</span>
                  }
                  <span class="meta">โดย {{ f.reporter_name }} · <time [attr.datetime]="f.created_at" [title]="date(f.created_at)">{{ ago(f.created_at) }}</time></span>
                </li>
              }
            </ul>
            <p class="who">
              เจ้าของ <strong>{{ t.author.display_name }}</strong>
              @if (t.author.email) {
                <span class="email">{{ t.author.email }}</span>
              }
              @if (t.author.banned) {
                <span class="tag"><app-icon name="ban" [size]="16" />ถูกแบน</span>
              }
            </p>
            @if (confirming() === t.flag_id) {
              <div class="decide confirm">
                <button type="button" class="btn" [disabled]="busy()" (click)="confirming.set(null)">ยกเลิก</button>
                <button type="button" class="btn" [disabled]="busy()" (click)="resolve(t, 'ban')">
                  <app-icon name="ban" [size]="18" />แน่ใจ แบนเลย
                </button>
              </div>
            } @else {
              <div class="decide actions">
                <button type="button" class="btn" [disabled]="busy()" (click)="resolve(t, 'dismiss')">
                  <app-icon name="undo2" [size]="18" />{{ t.hidden ? 'ยกเลิกรายงานและคืน' : 'ยกเลิกรายงาน' }}
                </button>
                @if (!t.hidden) {
                  <button type="button" class="btn" [disabled]="busy()" (click)="resolve(t, 'hide')">
                    <app-icon name="eyeOff" [size]="18" />ซ่อน
                  </button>
                }
                @if (t.author.role !== 'admin') {
                  <button type="button" class="btn" [disabled]="busy()" (click)="confirming.set(t.flag_id)">
                    <app-icon name="ban" [size]="18" />ซ่อนและแบนเจ้าของ
                  </button>
                }
              </div>
            }
          </article>
        } @empty {
          <div class="empty">
            <span class="disc"><app-icon name="circleCheck" [size]="30" /></span>
            <p>ไม่มีรายงานค้าง</p>
          </div>
        }

        @if (hidden().length) {
          <section class="hidden-list" aria-labelledby="flags-hidden-title">
            <h2 id="flags-hidden-title"><app-icon name="eyeOff" [size]="18" />ซ่อนอยู่ · {{ hidden().length }}</h2>
            <ul>
              @for (h of hidden(); track h.target_type + h.target_id) {
                <li class="hidden-row">
                  <span class="what">
                    <span class="kind">{{ h.target_type === 'report' ? 'เรื่อง' : 'ความคิดเห็นใน' }}</span>
                    {{ h.report.title }}
                    @if (h.comment) {
                      <span class="body">“{{ h.comment.body }}”</span>
                    }
                  </span>
                  <button type="button" class="btn" [disabled]="busy()" (click)="restore(h)">
                    <app-icon name="undo2" [size]="18" />คืน
                  </button>
                </li>
              }
            </ul>
          </section>
        }
      }
    }
  `,
  styleUrl: 'flags-queue.component.scss',
})
export class FlagsQueueComponent {
  private admin = inject(AdminService);
  readonly changed = output<void>();

  protected readonly state = signal<LoadState>('loading');
  protected readonly items = signal<QueueFlag[]>([]);
  protected readonly hidden = signal<HiddenItem[]>([]);
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  /** The flag whose "hide and ban" waits for its second press. */
  protected readonly confirming = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  protected async load() {
    this.state.set('loading');
    try {
      const [flags, hidden] = await Promise.all([this.admin.queue('flags'), this.admin.queue('hidden')]);
      this.items.set(flags);
      this.hidden.set(hidden);
      this.confirming.set(null);
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  protected async resolve(t: QueueFlag, action: FlagAction) {
    const done = action === 'dismiss' && t.hidden ? 'ยกเลิกรายงานและคืนแล้ว' : DONE[action];
    await this.run(() => this.admin.resolveFlags(t.flag_id, action), done);
  }

  protected async restore(h: HiddenItem) {
    await this.run(() => this.admin.restore(h.target_type, h.target_id), 'คืนแล้ว');
  }

  /** Every action changes both lists (a hide adds to "ซ่อนอยู่"), so both are read again after it. */
  private async run(act: () => Promise<void>, done: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.message.set('');
    try {
      await act();
      await this.load();
      this.message.set(done);
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

  protected statusWord = (t: QueueFlag) => STATUS_TH[t.report.status];
  protected statusIcon = (t: QueueFlag) => STATUS_ICON[t.report.status];
  protected reasonWord = (r: QueueFlag['flags'][number]['reason']) => FLAG_REASON_TH[r] ?? r;
  protected ago = formatAgo;
  protected date = formatDate;
}
