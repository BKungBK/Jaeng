import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NavController } from '@ionic/angular';
import { MSG_INTERNAL_TH } from '@jaeng/shared/api';
import { LEVELS, type DangerLevel } from '@jaeng/shared/levels';
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN, type MyReport } from '@jaeng/shared/report';
import { ApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { IconComponent } from '../../shared/icon.component';
import { formatAgo, formatDate } from '../../shared/time';
import { categoryIcon } from '../map/beacon';
import { LevelShapeComponent } from '../map/level-shape';
import { MapReturnService } from '../report-new/map-return.service';
import { ReportDraftService } from '../report-new/report-draft.service';
import { MeService } from './me.service';
import { PUBLIC_STATUS, rejectReasonText, STATUS_ICON, STATUS_TH } from './reject-reason';

type State = 'loading' | 'ready' | 'error';

const MSG_LOAD = 'โหลดเรื่องของคุณไม่สำเร็จ ลองอีกครั้งนะ';

/**
 * `/me` (.impeccable/surfaces/apps-web-src-app-features-me-me-page-ts.md): the display name and every
 * report the user made, newest first, up to the API's 100. Each row says its status in words and a
 * Lucide shape; only the public ones open on the map.
 */
@Component({
  selector: 'app-me',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, LevelShapeComponent, NgTemplateOutlet, RouterLink],
  templateUrl: 'me.page.html',
  styleUrl: 'me.page.scss',
  host: { class: 'ion-page' },
})
export class MePage {
  private svc = inject(MeService);
  protected readonly auth = inject(AuthService);
  private nav = inject(NavController);
  private router = inject(Router);
  private draft = inject(ReportDraftService);
  private back = inject(MapReturnService);
  private injector = inject(Injector);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly state = signal<State>('loading');
  protected readonly reports = signal<MyReport[]>([]);
  protected readonly editing = signal(false);
  protected readonly name = signal('');
  protected readonly saving = signal(false);
  protected readonly nameError = signal('');
  protected readonly signingOut = signal(false);

  protected readonly msgLoad = MSG_LOAD;
  protected readonly min = DISPLAY_NAME_MIN;
  protected readonly max = DISPLAY_NAME_MAX;
  protected readonly canSave = computed(() => {
    const n = this.name().trim().length;
    return !this.saving() && n >= DISPLAY_NAME_MIN && n <= DISPLAY_NAME_MAX && this.name().trim() !== this.auth.profile()?.display_name;
  });

  /** Bumped on every load, so a slow answer for an earlier press of "ลองอีกครั้ง" is dropped. */
  private seq = 0;
  private shown = false;

  constructor() {
    void this.load();
  }

  /** Ionic keeps this page in its stack: coming back to it (after sending a report) reads the list again, quietly. */
  ionViewWillEnter() {
    if (this.shown) void this.load(true);
  }

  ionViewDidEnter() {
    this.host.nativeElement.querySelector<HTMLElement>('#me-title')?.focus({ preventScroll: true });
  }

  protected async load(quiet = false) {
    const seq = ++this.seq;
    if (!quiet) this.state.set('loading');
    try {
      const list = await this.svc.reports();
      if (seq !== this.seq) return;
      this.reports.set(list);
      this.state.set('ready');
      this.shown = true;
    } catch {
      if (seq !== this.seq || quiet) return; // a quiet refresh that fails keeps what is shown
      this.state.set('error');
    }
  }

  protected edit() {
    this.name.set(this.auth.profile()?.display_name ?? '');
    this.nameError.set('');
    this.editing.set(true);
    this.focusAfterRender('#me-name-input');
  }

  protected cancel() {
    this.editing.set(false);
    this.nameError.set('');
    this.focusAfterRender('#me-edit-btn');
  }

  protected onInput(event: Event) {
    this.name.set((event.target as HTMLInputElement).value);
  }

  protected async save() {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.nameError.set('');
    try {
      const stored = await this.svc.rename(this.name().trim());
      this.auth.setDisplayName(stored);
      this.editing.set(false);
      this.focusAfterRender('#me-edit-btn');
    } catch (e) {
      this.nameError.set(e instanceof ApiError ? e.messageTh : MSG_INTERNAL_TH);
    } finally {
      this.saving.set(false);
    }
  }

  protected goBack() {
    void this.back.go();
  }

  protected newReport() {
    void this.router.navigate(['/report']);
  }

  protected async signOut() {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    try {
      // leaving on purpose: an unsent report draft goes too (same as the account menu)
      this.draft.reset();
      await this.auth.signOut();
      await this.nav.navigateRoot('/');
    } finally {
      this.signingOut.set(false);
    }
  }

  private focusAfterRender(selector: string) {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true }), {
      injector: this.injector,
    });
  }

  // template helpers
  protected isPublic = (r: MyReport) => PUBLIC_STATUS.includes(r.status);
  protected level = (r: MyReport) => LEVELS[r.danger_level as DangerLevel] ?? LEVELS[0];
  protected icon = (r: MyReport) => categoryIcon(r.category);
  protected statusWord = (r: MyReport) => STATUS_TH[r.status];
  protected statusIcon = (r: MyReport) => STATUS_ICON[r.status];
  protected reason = (r: MyReport) => rejectReasonText(r.reject_reason);
  protected ago = formatAgo;
  protected date = formatDate;
}
