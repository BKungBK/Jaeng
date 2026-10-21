import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { FlagTarget } from '@jaeng/shared/admin';
import { COMMENT_MAX, LiveSignal, PublicComment, ReportSignal } from '@jaeng/shared/api';
import { LEVELS } from '@jaeng/shared/levels';
import { thumbPath } from '@jaeng/shared/report';
import { PopoverController } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { CategoriesService } from '../../core/categories.service';
import { I18nService, type Said } from '../../core/i18n.service';
import { RealtimeService } from '../../core/realtime.service';
import { TPipe } from '../../i18n/t.pipe';
import { EmergencyBoxComponent } from '../../shared/emergency-box.component';
import { IconComponent } from '../../shared/icon.component';
import { AdminService } from '../admin/admin.service';
import { LoginPromptService } from '../auth/login-prompt.service';
import { categoryIcon } from '../map/beacon';
import { LevelShapeComponent } from '../map/level-shape';
import { coverPhotoUrl } from '../map/report';
import { serverOrigin } from '../../core/server-config.service';
import type { ReportDetail } from './report-detail';
import { FixClaimFormComponent } from './fix-claim-form.component';
import { FlagFormComponent } from './flag-form.component';
import { ReportDetailService } from './report-detail.service';
import { ReportMenuComponent, type ReportMenuRole } from './report-menu.component';

/** Live signals for the open report are coalesced over this window into one refetch. */
export const SIGNAL_DEBOUNCE_MS = 250;
const LONG_WAIT_DAYS = 30;

type State = 'loading' | 'ready' | 'error';
/** The inline form that replaces the action row (or sits under one comment). */
type OpenForm = { kind: 'fix' } | { kind: 'flag'; type: FlagTarget; id: string };

/**
 * The report detail (spec 3.4): one component for the 380 px right panel and the phone's bottom sheet.
 * The host decides where it sits; it reports what happened through its outputs.
 */
@Component({
  selector: 'app-report-detail',
  templateUrl: 'report-detail.component.html',
  styleUrls: ['report-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, LevelShapeComponent, FixClaimFormComponent, FlagFormComponent, TPipe, EmergencyBoxComponent],
})
export class ReportDetailComponent {
  private svc = inject(ReportDetailService);
  private prompt = inject(LoginPromptService);
  protected readonly auth = inject(AuthService);
  private closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');
  private moreBtn = viewChild<ElementRef<HTMLButtonElement>>('moreBtn');
  private popovers = inject(PopoverController);
  private admin = inject(AdminService);
  protected readonly i18n = inject(I18nService);
  private categories = inject(CategoriesService);

  readonly reportId = input.required<string>();
  readonly closed = output<void>();
  readonly loaded = output<ReportDetail>();
  /** The report is not public (any more); a message when the panel knows why. */
  readonly missing = output<Said | void>();
  readonly changed = output<ReportSignal>();

  protected readonly state = signal<State>('loading');
  protected readonly detail = signal<ReportDetail | null>(null);
  protected readonly comments = signal<PublicComment[]>([]);
  protected readonly confirmed = signal(false);
  protected readonly confirming = signal(false);
  protected readonly sending = signal(false);
  protected readonly draft = signal('');
  protected readonly message = signal<Said>(null);
  protected readonly form = signal<OpenForm | null>(null);
  /** The control that opened the form: focus goes back to it when the form closes. */
  private opener: HTMLElement | null = null;

  protected readonly max = COMMENT_MAX;
  protected readonly canSend = computed(() => {
    const n = this.draft().length;
    return this.draft().trim().length > 0 && n <= COMMENT_MAX && !this.sending();
  });

  /** Bumped on every load so a slow answer for a previous report is dropped. */
  private seq = 0;
  /** Bumped on every "did I press it" read, so an answer for the previous user cannot land last. */
  private mineSeq = 0;
  /** Bumped on every live refetch, so only the newest one is applied. */
  private liveSeq = 0;
  private liveTimer?: ReturnType<typeof setTimeout>;
  private realtime = inject(RealtimeService);
  private readonly userId = computed(() => this.auth.session()?.user.id ?? null);

  constructor() {
    const stop = this.realtime.listen((s) => this.onSignal(s));
    inject(DestroyRef).onDestroy(() => {
      stop();
      clearTimeout(this.liveTimer);
    });
    effect(() => {
      const id = this.reportId();
      untracked(() => void this.load(id));
    });
    // logging in, out, or as someone else (quick login, OTP: SIGNED_IN without SIGNED_OUT)
    // changes whose "me too" this is, so watch the user id, not just "signed in"
    effect(() => {
      this.userId(); // a computed: a token refresh for the same user does not re-run this
      untracked(() => {
        if (this.detail()) void this.refreshMine(this.seq);
      });
    });
  }

  protected async load(id: string) {
    const seq = ++this.seq;
    clearTimeout(this.liveTimer); // a pending live refetch belongs to the previous report
    this.state.set('loading');
    this.detail.set(null);
    this.comments.set([]);
    this.confirmed.set(false);
    this.message.set(null);
    this.draft.set('');
    this.form.set(null);
    this.confirming.set(false); // flags belong to the report on screen, not to the panel
    this.sending.set(false);
    let d: ReportDetail | null;
    try {
      d = await this.svc.get(id);
    } catch {
      if (seq !== this.seq) return;
      this.state.set('error');
      this.message.set('detail.loadFailed');
      return;
    }
    if (seq !== this.seq) return;
    if (!d) {
      this.missing.emit();
      return;
    }
    this.detail.set({ ...d, photos: d.photos ?? [], tags: d.tags ?? [] });
    this.state.set('ready');
    this.loaded.emit(d);
    // keyboard and screen-reader users land inside the panel
    setTimeout(() => this.closeBtn()?.nativeElement.focus({ preventScroll: true }));
    void this.refreshMine(seq);
    await this.loadComments(id, seq);
  }

  /** Merges instead of replacing, so a comment that arrived by another route meanwhile is kept. */
  private async loadComments(id: string, seq: number) {
    try {
      const list = await this.svc.comments(id);
      if (seq !== this.seq) return;
      this.comments.update((have) => {
        const ids = new Set(list.map((c) => c.id));
        return [...list, ...have.filter((c) => !ids.has(c.id))];
      });
    } catch {
      // the report is still worth showing without its comments
    }
  }

  /**
   * A live signal (Realtime Broadcast) only says "this report changed": the channel is public, so
   * anyone with the anon key can send one. A burst is coalesced into one refetch, and the refetched
   * report is what gets shown.
   */
  private onSignal(s: LiveSignal) {
    const d = this.detail();
    if (!d || s.id !== this.reportId() || s.id !== d.id) return;
    clearTimeout(this.liveTimer);
    const seq = this.seq;
    this.liveTimer = setTimeout(() => void this.refetch(d.id, seq), SIGNAL_DEBOUNCE_MS);
  }

  private async refetch(id: string, seq: number) {
    const live = ++this.liveSeq;
    let fresh: ReportDetail | null;
    try {
      fresh = await this.svc.get(id);
    } catch {
      return; // keep what is shown; the next signal tries again
    }
    if (seq !== this.seq || live !== this.liveSeq) return;
    if (!fresh) {
      this.missing.emit(); // hidden or removed meanwhile
      return;
    }
    const shown = this.detail()?.comment_count;
    this.detail.set({ ...fresh, photos: fresh.photos ?? [], tags: fresh.tags ?? [] });
    if (fresh.comment_count !== shown) await this.loadComments(id, seq);
  }

  protected retry() {
    void this.load(this.reportId());
  }

  private async refreshMine(seq: number): Promise<boolean> {
    const mineSeq = ++this.mineSeq;
    try {
      const mine = await this.svc.myConfirmation(this.reportId());
      if (seq === this.seq && mineSeq === this.mineSeq) this.confirmed.set(mine);
      return mine;
    } catch {
      return this.confirmed();
    }
  }

  protected async toggle() {
    const d = this.detail();
    if (!d || this.confirming()) return;
    this.confirming.set(true); // before any await: a second quick click is ignored
    this.message.set('');
    const seq = this.seq;
    try {
      if (!this.auth.signedIn()) {
        if (!(await this.prompt.ask())) return;
        // whoever just logged in may have pressed it before; never undo that by surprise
        if (await this.refreshMine(seq)) return;
      }
      const res = await this.svc.toggleConfirm(d.id);
      if (seq !== this.seq) return;
      this.confirmed.set(res.confirmed);
      this.apply(res.report);
    } catch (e) {
      if (seq === this.seq) this.message.set({ error: e });
    } finally {
      if (seq === this.seq) this.confirming.set(false);
    }
  }

  protected async send() {
    const d = this.detail();
    const body = this.draft().trim();
    if (!d || !body || this.draft().length > COMMENT_MAX || this.sending()) return;
    this.sending.set(true);
    this.message.set('');
    const seq = this.seq;
    try {
      const res = await this.svc.addComment(d.id, body);
      if (seq !== this.seq) return;
      this.comments.update((list) => (list.some((c) => c.id === res.comment.id) ? list : [...list, res.comment]));
      this.draft.set('');
      this.apply(res.report);
    } catch (e) {
      if (seq === this.seq) this.message.set({ error: e });
    } finally {
      if (seq === this.seq) this.sending.set(false);
    }
  }

  protected login() {
    void this.prompt.ask();
  }

  protected async copyLink() {
    const url = `${serverOrigin()}/r/${this.reportId()}`;
    try {
      await navigator.clipboard.writeText(url);
      this.message.set('detail.copied');
    } catch {
      this.message.set('detail.copyFailed');
    }
  }

  /** Members only: signed out, ask to log in first and go on only after a successful login. */
  private async signedInOrAsk(): Promise<boolean> {
    return this.auth.signedIn() || (await this.prompt.ask());
  }

  protected async openFix(event: Event) {
    this.opener = event.currentTarget as HTMLElement;
    if (!(await this.signedInOrAsk())) return;
    this.message.set('');
    this.form.set({ kind: 'fix' });
  }

  protected async openMenu(event: Event) {
    const d = this.detail();
    if (!d) return;
    this.opener = this.moreBtn()?.nativeElement ?? null;
    const popover = await this.popovers.create({
      component: ReportMenuComponent,
      cssClass: 'report-menu',
      event,
      side: 'top',
      alignment: 'end',
    });
    await popover.present();
    const { role } = await popover.onDidDismiss();
    const choice = role as ReportMenuRole | undefined;
    if (choice === 'copy') await this.copyLink();
    else if (choice === 'flag') await this.openFlag('report', d.id);
    else if (choice === 'hide') await this.hideReport(d.id);
  }

  protected async flagComment(c: PublicComment, event: Event) {
    this.opener = event.currentTarget as HTMLElement;
    await this.openFlag('comment', c.id);
  }

  private async openFlag(type: FlagTarget, id: string) {
    if (!(await this.signedInOrAsk())) return;
    this.message.set('');
    this.form.set({ kind: 'flag', type, id });
  }

  private async hideReport(id: string) {
    const seq = this.seq;
    try {
      await this.admin.hide('report', id);
      if (seq === this.seq) this.missing.emit('detail.hidden'); // the map takes the beam away and closes the panel
    } catch (e) {
      if (seq === this.seq) this.message.set({ error: e });
    }
  }

  protected closeForm() {
    this.form.set(null);
    // after the action row is back: the opener, or ⋯ when the opener is gone (fix sent -> fix_claimed)
    setTimeout(() => (this.opener?.isConnected ? this.opener : this.moreBtn()?.nativeElement)?.focus());
  }

  protected fixDone(report: ReportSignal) {
    this.apply(report);
    this.message.set('detail.fixSent');
    this.closeForm();
  }

  /** Someone else claimed or it was resolved meanwhile: show why and read the report again. */
  protected fixStale(error: unknown) {
    const d = this.detail();
    this.message.set({ error });
    this.closeForm();
    if (d) void this.refetch(d.id, this.seq);
  }

  protected flagDone() {
    this.message.set('detail.flagSent');
    this.closeForm();
  }

  protected isFlagging = (type: FlagTarget, id: string) => {
    const f = this.form();
    return f?.kind === 'flag' && f.type === type && f.id === id;
  };

  protected onInput(event: Event) {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  /** The server's counts win over anything the panel guessed. */
  private apply(s: ReportSignal) {
    this.detail.update((d) =>
      d ? { ...d, status: s.status, confirm_count: s.confirm_count, comment_count: s.comment_count } : d,
    );
    this.changed.emit(s);
  }

  // template helpers
  protected level = (d: ReportDetail) => LEVELS[d.danger_level];
  protected status = (d: ReportDetail) => this.i18n.t(`status.${d.status}`);
  /** null until the categories table has loaded: no tag rather than a slug */
  protected category = (d: ReportDetail) => this.categories.names()[d.category] ?? null;
  protected icon = (d: ReportDetail) => categoryIcon(d.category);
  protected longWait = (d: ReportDetail) => d.days_open > LONG_WAIT_DAYS;
  protected photoUrl = coverPhotoUrl;
  protected thumbUrl = (path: string) => coverPhotoUrl(thumbPath(path));
  protected kind = (k: 'before' | 'after') => this.i18n.t(`detail.photoKind.${k}`);
  protected ago = (iso: string) => this.i18n.ago(iso);
  protected date = (iso: string) => this.i18n.date(iso);
}
