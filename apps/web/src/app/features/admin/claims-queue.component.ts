import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import type { QueueClaim } from '@jaeng/shared/admin';
import { LEVELS, type DangerLevel } from '@jaeng/shared/levels';
import { ApiError } from '../../core/api.service';
import { I18nService, type Said } from '../../core/i18n.service';
import { playDone } from '../../core/motion';
import { TPipe } from '../../i18n/t.pipe';
import { ServerUrlPipe } from '../../shared/server-url.pipe';
import { IconComponent } from '../../shared/icon.component';
import { categoryIcon } from '../map/beacon';
import { LevelShapeComponent } from '../map/level-shape';
import { AdminService } from './admin.service';

type LoadState = 'loading' | 'ready' | 'error';

/** Tab "Fix claims" (spec 3.10.2): each claim with the before and after photos side by side. */
@Component({
  selector: 'app-claims-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, LevelShapeComponent, ServerUrlPipe, TPipe],
  template: `
    <p class="status" role="status">{{ i18n.say(message()) }}</p>
    @switch (state()) {
      @case ('loading') {
        <p class="caption">{{ 'load.loading' | t }}</p>
        <div class="ghost skel"></div>
      }
      @case ('error') {
        <p class="caption">{{ 'admin.queueFailed' | t }}</p>
        <button type="button" class="btn retry" (click)="load()"><app-icon name="refreshCw" [size]="18" />{{ 'common.tryAgain' | t }}</button>
      }
      @case ('ready') {
        @for (c of items(); track c.id) {
          <article class="item" [style.--c]="level(c.report.danger_level).color">
            <div class="compare">
              <figure>
                @if (c.report.photos[0]; as p) {
                  <img [src]="p.url | serverUrl" [attr.alt]="'admin.claims.beforeAlt' | t" />
                } @else {
                  <span class="tile"><app-icon [name]="icon(c.report.category)" [size]="36" /></span>
                }
                <figcaption>{{ 'detail.photoKind.before' | t }}</figcaption>
              </figure>
              <figure>
                @if (c.photo; as p) {
                  <img [src]="p.url | serverUrl" [attr.alt]="'admin.claims.afterAlt' | t" />
                } @else {
                  <span class="none">{{ 'admin.claims.noAfter' | t }}</span>
                }
                <figcaption>{{ 'detail.photoKind.after' | t }}</figcaption>
              </figure>
            </div>
            <h2>{{ c.report.title }}</h2>
            <ul class="tags">
              <li class="tag lvl"><app-level-shape [level]="level(c.report.danger_level).level" />{{ 'detail.level' | t: { level: i18n.levelName(level(c.report.danger_level).level) } }}</li>
              <li class="tag"><app-icon name="clock" [size]="16" />{{ 'age.days' | t: { n: c.report.days_open } }}</li>
              @if (c.report.place_name) {
                <li class="tag"><app-icon name="mapPin" [size]="16" />{{ c.report.place_name }}</li>
              }
            </ul>
            <p class="who">
              {{ 'admin.claims.claimedBy' | t }} <strong>{{ c.claimant.display_name }}</strong>
              @if (c.claimant.email) {
                <span class="email">{{ c.claimant.email }}</span>
              }
              <time [attr.datetime]="c.created_at" [title]="date(c.created_at)">{{ ago(c.created_at) }}</time>
            </p>
            @if (c.note) {
              <p class="note-text">{{ c.note }}</p>
            }
            <div class="decide">
              <button type="button" class="btn" [disabled]="busy()" [attr.aria-busy]="deciding() === 'no'" (click)="review(c, false, $event)">
                <app-icon name="circleX" [size]="18" />{{ 'admin.claims.notFixed' | t }}
              </button>
              <button type="button" class="btn primary" [disabled]="busy()" [attr.aria-busy]="deciding() === 'yes'" (click)="review(c, true, $event)">
                <app-icon name="circleCheck" [size]="18" />{{ 'admin.claims.confirm' | t }}
              </button>
            </div>
          </article>
        } @empty {
          <div class="empty">
            <span class="disc"><app-icon name="circleCheck" [size]="30" /></span>
            <p>{{ 'admin.claims.empty' | t }}</p>
          </div>
        }
      }
    }
  `,
  styleUrl: 'claims-queue.component.scss',
})
export class ClaimsQueueComponent {
  private admin = inject(AdminService);
  protected readonly i18n = inject(I18nService);
  readonly changed = output<void>();

  protected readonly state = signal<LoadState>('loading');
  protected readonly items = signal<QueueClaim[]>([]);
  protected readonly busy = signal(false);
  protected readonly deciding = signal<'yes' | 'no' | null>(null);
  protected readonly message = signal<Said>(null);

  constructor() {
    void this.load();
  }

  /** quiet: a re-read after an action keeps the list on screen instead of turning it into a placeholder. */
  protected async load(quiet = false) {
    if (!quiet) this.state.set('loading');
    try {
      this.items.set(await this.admin.queue('claims'));
      this.state.set('ready');
    } catch {
      if (!quiet) this.state.set('error'); // a failed re-read keeps what is on screen
    }
  }

  /** How a decided card leaves (a tick and sparks for a confirmation, a slide for "not fixed"). */
  protected playDone: (el: HTMLElement, kind: 'approve' | 'reject') => Promise<void> = playDone;

  protected async review(c: QueueClaim, approve: boolean, event?: Event) {
    if (this.busy()) return;
    this.busy.set(true);
    this.deciding.set(approve ? 'yes' : 'no'); // only the button that was pressed shows it is working
    this.message.set(null);
    try {
      await this.admin.reviewClaim(c.id, approve);
      const card = (event?.target as HTMLElement | undefined)?.closest<HTMLElement>('article');
      if (card) await this.playDone(card, approve ? 'approve' : 'reject').catch(() => undefined);
      this.items.update((list) => list.filter((x) => x.id !== c.id));
      this.message.set(approve ? 'admin.claims.confirmed' : 'admin.claims.sentBack');
      this.changed.emit();
    } catch (e) {
      this.message.set({ error: e });
      if (e instanceof ApiError && e.status === 409) {
        await this.load(true);
        this.changed.emit();
      }
    } finally {
      this.busy.set(false);
      this.deciding.set(null);
    }
  }

  protected level = (n: number) => LEVELS[n as DangerLevel] ?? LEVELS[0];
  protected icon = categoryIcon;
  protected ago = (iso: string) => this.i18n.ago(iso);
  protected date = (iso: string) => this.i18n.date(iso);
}
