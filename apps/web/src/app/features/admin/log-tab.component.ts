import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LocationMode, LogEntry } from '@jaeng/shared/admin';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { rejectReasonText } from '../me/reject-reason';
import { AdminService } from './admin.service';
import { locationKey, logActionText } from './admin-labels';
import { I18nService } from '../../core/i18n.service';
import { LOCATION_MODES } from '@jaeng/shared/admin';

/** The API answers 50 entries a page; a shorter page is the last one. */
export const LOG_PAGE = 50;

/** Tab "Log" (spec 3.10.5): every moderation action, newest first. */
@Component({
  selector: 'app-log-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink, TPipe],
  template: `
    @if (failed()) {
      <p class="caption">{{ 'admin.logFailed' | t }}</p>
      <button type="button" class="btn retry" (click)="loadMore()"><app-icon name="refreshCw" [size]="18" />{{ 'common.tryAgain' | t }}</button>
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
              <a [routerLink]="['/r', e.target_id]">{{ 'admin.logTab.open' | t }}</a>
            }
          </p>
          @for (d of details(e); track d) {
            <p class="detail">{{ d }}</p>
          }
          <p class="meta">
            {{ e.admin_name ?? ('admin.logTab.system' | t) }} ·
            <time [attr.datetime]="e.created_at" [title]="date(e.created_at)">{{ ago(e.created_at) }}</time>
          </p>
        </li>
      } @empty {
        @if (!loading()) {
          <li class="empty-line">{{ 'admin.logTab.empty' | t }}</li>
        }
      }
    </ol>
    @if (loading()) {
      <p class="caption">{{ 'load.loading' | t }}</p>
    }
    @if (hasMore() && !loading()) {
      <button type="button" class="btn more" (click)="loadMore()"><app-icon name="history" [size]="18" />{{ 'admin.logTab.older' | t }}</button>
    }
  `,
  styleUrl: 'log-tab.component.scss',
})
export class LogTabComponent {
  private admin = inject(AdminService);
  private i18n = inject(I18nService);

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

  protected action = (e: LogEntry) => logActionText(e.action, (k) => this.i18n.t(k));
  protected kind = (e: LogEntry) =>
    e.target_type === 'report' || e.target_type === 'comment' || e.target_type === 'user'
      ? this.i18n.t(`admin.logTab.kind.${e.target_type}`)
      : e.target_type;

  /** Only the keys we know, as plain text. */
  protected details(e: LogEntry): string[] {
    const d = e.detail ?? {};
    const out: string[] = [];
    // only reject_report logs a reason (a REJECT_REASONS key)
    const t = this.i18n.t.bind(this.i18n);
    if (typeof d['reason'] === 'string') out.push(t('admin.logTab.reason', { v: rejectReasonText(d['reason'], t) }));
    if (typeof d['note'] === 'string') out.push(t('admin.logTab.note', { v: d['note'] }));
    const mode = d['location_mode'];
    if (typeof mode === 'string') {
      const known = (LOCATION_MODES as readonly string[]).includes(mode);
      out.push(t('admin.logTab.location', { v: known ? t(locationKey(mode as LocationMode)) : mode }));
    }
    return out;
  }

  protected ago = (iso: string) => this.i18n.ago(iso);
  protected date = (iso: string) => this.i18n.date(iso);
}
