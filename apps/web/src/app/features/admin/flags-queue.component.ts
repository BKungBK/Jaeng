import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import type { FlagAction, HiddenItem, QueueFlag } from '@jaeng/shared/admin';
import { ApiError } from '../../core/api.service';
import type { MessageKey } from '../../i18n/keys';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { STATUS_ICON, statusKey } from '../me/reject-reason';
import { I18nService, type Said } from '../../core/i18n.service';
import { flagReasonText } from '../report-detail/flag-reason';
import { AdminService } from './admin.service';

type LoadState = 'loading' | 'ready' | 'error';

const DONE: Record<FlagAction, MessageKey> = {
  dismiss: 'admin.flags.done.dismiss',
  hide: 'admin.flags.done.hide',
  ban: 'admin.flags.done.ban',
};

/** Tab "Flagged" (spec 3.10.3): one card per reported target, then what is hidden now. */
@Component({
  selector: 'app-flags-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TPipe],
  template: `
    <p class="status" role="status">{{ i18n.say(message()) }}</p>
    @switch (state()) {
      @case ('loading') {
        <p class="caption">{{ 'load.loading' | t }}</p>
        <div class="ghost"></div>
      }
      @case ('error') {
        <p class="caption">{{ 'admin.listFailed' | t }}</p>
        <button type="button" class="btn retry" (click)="load()"><app-icon name="refreshCw" [size]="18" />{{ 'common.tryAgain' | t }}</button>
      }
      @case ('ready') {
        @for (t of items(); track t.flag_id) {
          <article class="item">
            <ul class="tags">
              <li class="tag"><app-icon [name]="t.target_type === 'report' ? 'fileText' : 'messageCircle'" [size]="16" />{{ (t.target_type === 'report' ? 'admin.flags.report' : 'admin.flags.comment') | t }}</li>
              <li class="tag"><app-icon [name]="statusIcon(t)" [size]="16" />{{ statusWord(t) }}</li>
              @if (t.hidden) {
                <li class="tag"><app-icon name="eyeOff" [size]="16" />{{ 'admin.flags.hidden' | t }}</li>
              }
              <li class="tag"><app-icon name="flag" [size]="16" />{{ 'admin.flags.count' | t: { n: t.flags.length } }}</li>
            </ul>
            <h2>{{ t.report.title }}</h2>
            @if (t.comment; as cm) {
              <blockquote class="body">{{ cm.body }}</blockquote>
              @if (cm.photo?.thumb_url) {
                <img class="attached" [src]="cm.photo!.thumb_url" [attr.alt]="'detail.attached' | t" />
              }
            } @else if (t.report.photo?.thumb_url) {
              <img class="attached" [src]="t.report.photo!.thumb_url" [attr.alt]="'detail.photos' | t" />
            }
            <ul class="reasons-list">
              @for (f of t.flags; track $index) {
                <li>
                  <strong>{{ reasonWord(f.reason) }}</strong>
                  @if (f.note) {
                    <span class="note-text">{{ f.note }}</span>
                  }
                  <span class="meta">{{ 'admin.flags.by' | t: { name: f.reporter_name } }} · <time [attr.datetime]="f.created_at" [title]="date(f.created_at)">{{ ago(f.created_at) }}</time></span>
                </li>
              }
            </ul>
            <p class="who">
              {{ 'admin.flags.owner' | t }} <strong>{{ t.author.display_name }}</strong>
              @if (t.author.email) {
                <span class="email">{{ t.author.email }}</span>
              }
              @if (t.author.banned) {
                <span class="tag"><app-icon name="ban" [size]="16" />{{ 'admin.banned' | t }}</span>
              }
            </p>
            @if (confirming() === t.flag_id) {
              <div class="decide confirm">
                <button type="button" class="btn" [disabled]="busy()" (click)="confirming.set(null)">{{ 'common.cancel' | t }}</button>
                <button type="button" class="btn" [disabled]="busy()" (click)="resolve(t, 'ban')">
                  <app-icon name="ban" [size]="18" />{{ 'admin.sureBan' | t }}
                </button>
              </div>
            } @else {
              <div class="decide actions">
                <button type="button" class="btn" [disabled]="busy()" (click)="resolve(t, 'dismiss')">
                  <app-icon name="undo2" [size]="18" />{{ (t.hidden ? 'admin.flags.dismissRestore' : 'admin.flags.dismiss') | t }}
                </button>
                @if (!t.hidden) {
                  <button type="button" class="btn" [disabled]="busy()" (click)="resolve(t, 'hide')">
                    <app-icon name="eyeOff" [size]="18" />{{ 'admin.flags.hide' | t }}
                  </button>
                }
                @if (t.author.role !== 'admin') {
                  <button type="button" class="btn" [disabled]="busy()" (click)="confirming.set(t.flag_id)">
                    <app-icon name="ban" [size]="18" />{{ 'admin.flags.hideBan' | t }}
                  </button>
                }
              </div>
            }
          </article>
        } @empty {
          <div class="empty">
            <span class="disc"><app-icon name="circleCheck" [size]="30" /></span>
            <p>{{ 'admin.flags.empty' | t }}</p>
          </div>
        }

        @if (hidden().length) {
          <section class="hidden-list" aria-labelledby="flags-hidden-title">
            <h2 id="flags-hidden-title"><app-icon name="eyeOff" [size]="18" />{{ 'admin.flags.hiddenTitle' | t: { n: hidden().length } }}</h2>
            <ul>
              @for (h of hidden(); track h.target_type + h.target_id) {
                <li class="hidden-row">
                  <span class="what">
                    <span class="kind">{{ (h.target_type === 'report' ? 'admin.flags.report' : 'admin.flags.commentIn') | t }}</span>
                    {{ h.report.title }}
                    @if (h.comment) {
                      <span class="body">“{{ h.comment.body }}”</span>
                    }
                  </span>
                  <button type="button" class="btn" [disabled]="busy()" (click)="restore(h)">
                    <app-icon name="undo2" [size]="18" />{{ 'admin.flags.restore' | t }}
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
  protected readonly i18n = inject(I18nService);
  readonly changed = output<void>();

  protected readonly state = signal<LoadState>('loading');
  protected readonly items = signal<QueueFlag[]>([]);
  protected readonly hidden = signal<HiddenItem[]>([]);
  protected readonly busy = signal(false);
  protected readonly message = signal<Said>(null);
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
    const done: MessageKey = action === 'dismiss' && t.hidden ? 'admin.flags.done.dismissRestored' : DONE[action];
    await this.run(() => this.admin.resolveFlags(t.flag_id, action), done);
  }

  protected async restore(h: HiddenItem) {
    await this.run(() => this.admin.restore(h.target_type, h.target_id), 'admin.flags.done.restored');
  }

  /** Every action changes both lists (a hide adds to "Hidden"), so both are read again after it. */
  private async run(act: () => Promise<void>, done: MessageKey) {
    if (this.busy()) return;
    this.busy.set(true);
    this.message.set(null);
    try {
      await act();
      await this.load();
      this.message.set(done);
      this.changed.emit();
    } catch (e) {
      this.message.set({ error: e });
      if (e instanceof ApiError && e.status === 409) {
        await this.load();
        this.changed.emit();
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected statusWord = (t: QueueFlag) => this.i18n.t(statusKey(t.report.status));
  protected statusIcon = (t: QueueFlag) => STATUS_ICON[t.report.status];
  protected reasonWord = (r: QueueFlag['flags'][number]['reason']) => flagReasonText(r, (k) => this.i18n.t(k));
  protected ago = (iso: string) => this.i18n.ago(iso);
  protected date = (iso: string) => this.i18n.date(iso);
}
