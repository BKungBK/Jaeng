import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import type { AdminUser } from '@jaeng/shared/admin';
import { I18nService, type Said } from '../../core/i18n.service';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { AdminService } from './admin.service';

export const SEARCH_DEBOUNCE_MS = 300;

/** Tab "Users" (spec 3.10.4): find a member by name or e-mail, ban or unban. Admins cannot be banned. */
@Component({
  selector: 'app-users-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TPipe],
  template: `
    <label class="search">
      <app-icon name="search" [size]="20" />
      <input type="search" [placeholder]="'admin.users.search' | t" [attr.aria-label]="'admin.users.search' | t" [value]="q()" (input)="onInput($event)" />
    </label>
    <p class="status" role="status">{{ i18n.say(message()) }}</p>

    @if (loading()) {
      <p class="caption">{{ 'load.loading' | t }}</p>
    } @else if (failed()) {
      <p class="caption">{{ 'admin.usersFailed' | t }}</p>
      <button type="button" class="btn retry" (click)="search()"><app-icon name="refreshCw" [size]="18" />{{ 'common.tryAgain' | t }}</button>
    } @else {
      <ul class="list">
        @for (u of users(); track u.id) {
          <li class="user item">
            <div class="who">
              <strong>{{ u.display_name }}</strong>
              @if (u.role === 'admin') {
                <span class="tag"><app-icon name="shieldCheck" [size]="16" />{{ 'account.admin' | t }}</span>
              }
              <span class="state">
                @if (u.banned_at) {
                  <app-icon name="ban" [size]="16" />{{ 'admin.banned' | t }}
                } @else {
                  <app-icon name="circleCheck" [size]="16" />{{ 'admin.users.active' | t }}
                }
              </span>
            </div>
            @if (u.email) {
              <span class="email">{{ u.email }}</span>
            }
            <p class="meta">{{ 'admin.users.meta' | t: { r: u.report_count, c: u.comment_count, date: date(u.created_at) } }}</p>
            @if (u.role !== 'admin') {
              @if (u.banned_at) {
                <div class="decide">
                  <button type="button" class="btn" [disabled]="busy()" (click)="setBan(u, false)">
                    <app-icon name="undo2" [size]="18" />{{ 'admin.users.unban' | t }}
                  </button>
                </div>
              } @else if (confirming() === u.id) {
                <div class="decide">
                  <button type="button" class="btn" [disabled]="busy()" (click)="confirming.set(null)">{{ 'common.cancel' | t }}</button>
                  <button type="button" class="btn" [disabled]="busy()" (click)="setBan(u, true)">
                    <app-icon name="ban" [size]="18" />{{ 'admin.sureBan' | t }}
                  </button>
                </div>
              } @else {
                <div class="decide">
                  <button type="button" class="btn" [disabled]="busy()" (click)="confirming.set(u.id)">
                    <app-icon name="ban" [size]="18" />{{ 'admin.users.ban' | t }}
                  </button>
                </div>
              }
            }
          </li>
        } @empty {
          <li class="empty-line">{{ 'admin.users.none' | t }}</li>
        }
      </ul>
    }
  `,
  styleUrl: 'users-tab.component.scss',
})
export class UsersTabComponent {
  private admin = inject(AdminService);
  protected readonly i18n = inject(I18nService);

  protected readonly q = signal('');
  protected readonly users = signal<AdminUser[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly message = signal<Said>(null);
  protected readonly confirming = signal<string | null>(null);

  private timer?: ReturnType<typeof setTimeout>;
  /** Bumped per search, so a slow answer for an older query is dropped. */
  private seq = 0;

  constructor() {
    void this.search();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected onInput(e: Event) {
    this.q.set((e.target as HTMLInputElement).value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.search(), SEARCH_DEBOUNCE_MS);
  }

  protected async search() {
    const seq = ++this.seq;
    this.failed.set(false);
    try {
      const list = await this.admin.users(this.q().trim());
      if (seq !== this.seq) return;
      this.users.set(list);
      this.confirming.set(null);
    } catch {
      if (seq === this.seq) this.failed.set(true);
    } finally {
      if (seq === this.seq) this.loading.set(false);
    }
  }

  protected async setBan(u: AdminUser, banned: boolean) {
    if (this.busy()) return;
    this.busy.set(true);
    this.message.set(null);
    try {
      await this.admin.setBan(u.id, banned);
      const at = banned ? new Date().toISOString() : null;
      this.users.update((list) => list.map((x) => (x.id === u.id ? { ...x, banned_at: at } : x)));
      this.confirming.set(null);
      this.message.set({ key: banned ? 'admin.users.bannedDone' : 'admin.users.unbannedDone', params: { name: u.display_name } });
    } catch (e) {
      this.message.set({ error: e });
    } finally {
      this.busy.set(false);
    }
  }

  protected date = (iso: string) => this.i18n.date(iso);
}
