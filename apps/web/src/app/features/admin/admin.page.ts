import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type { AdminCounts } from '@jaeng/shared/admin';
import { map } from 'rxjs';
import { IconComponent } from '../../shared/icon.component';
import { MapReturnService } from '../report-new/map-return.service';
import { AdminService } from './admin.service';
import { ADMIN_TABS, TAB_ICON, TAB_TH, type AdminTab } from './admin-labels';
import { ClaimsQueueComponent } from './claims-queue.component';
import { FlagsQueueComponent } from './flags-queue.component';
import { ReviewQueueComponent } from './review-queue.component';

const isTab = (v: string | null): v is AdminTab => (ADMIN_TABS as readonly string[]).includes(v ?? '');

/**
 * `/admin` (docs/design/admin-handoff.md): five tabs, the open one in ?tab=, the waiting counts on
 * the first three. Each tab body reports `changed` after an action so the counts are read again.
 */
@Component({
  selector: 'app-admin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ReviewQueueComponent, ClaimsQueueComponent, FlagsQueueComponent],
  templateUrl: 'admin.page.html',
  styleUrl: 'admin.page.scss',
  host: { class: 'ion-page' },
})
export class AdminPage {
  private admin = inject(AdminService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private back = inject(MapReturnService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly tabs = ADMIN_TABS;
  protected readonly words = TAB_TH;
  protected readonly icons = TAB_ICON;
  protected readonly counts = signal<AdminCounts | null>(null);

  private readonly param = toSignal(this.route.queryParamMap.pipe(map((q) => q.get('tab'))), { initialValue: null });
  protected readonly tab = computed<AdminTab>(() => {
    const t = this.param();
    return isTab(t) ? t : 'reports';
  });

  constructor() {
    void this.refreshCounts();
  }

  ionViewDidEnter() {
    this.host.nativeElement.querySelector<HTMLElement>('#admin-title')?.focus({ preventScroll: true });
  }

  protected async refreshCounts() {
    try {
      this.counts.set(await this.admin.counts());
    } catch {
      // the tabs still work without their numbers
    }
  }

  protected count(t: AdminTab): number | null {
    const c = this.counts();
    if (t === 'users' || t === 'log') return null;
    return c ? c[t === 'reports' ? 'reports' : t === 'claims' ? 'claims' : 'flags'] : null;
  }

  protected select(t: AdminTab) {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: t }, replaceUrl: true });
  }

  /** Arrow keys, Home and End move between tabs (roving tabindex). */
  protected onKey(event: KeyboardEvent) {
    const i = ADMIN_TABS.indexOf(this.tab());
    const n = ADMIN_TABS.length;
    const to =
      event.key === 'ArrowRight' ? (i + 1) % n :
      event.key === 'ArrowLeft' ? (i - 1 + n) % n :
      event.key === 'Home' ? 0 :
      event.key === 'End' ? n - 1 : -1;
    if (to < 0) return;
    event.preventDefault();
    this.select(ADMIN_TABS[to]);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(`#admin-tab-${ADMIN_TABS[to]}`)?.focus());
  }

  protected goBack() {
    void this.back.go();
  }
}
