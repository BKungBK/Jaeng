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
import { COMMENT_MAX, MSG_INTERNAL_TH, PublicComment, ReportSignal } from '@jaeng/shared/api';
import { LEVELS } from '@jaeng/shared/levels';
import { thumbPath } from '@jaeng/shared/report';
import { ApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { RealtimeService } from '../../core/realtime.service';
import { IconComponent } from '../../shared/icon.component';
import { formatAgo, formatDate } from '../../shared/time';
import { LoginPromptService } from '../auth/login-prompt.service';
import { categoryIcon } from '../map/beacon';
import { LevelShapeComponent } from '../map/level-shape';
import { coverPhotoUrl, STATUS_TH } from '../map/report';
import { CATEGORY_TH, PHOTO_KIND_TH, ReportDetail } from './report-detail';
import { ReportDetailService } from './report-detail.service';

const MSG_LOAD = 'โหลดเรื่องนี้ไม่สำเร็จ ลองอีกครั้งนะ';
const MSG_GENERIC = MSG_INTERNAL_TH;
/** Live signals for the open report are coalesced over this window into one refetch. */
export const SIGNAL_DEBOUNCE_MS = 250;
const LONG_WAIT_DAYS = 30;

type State = 'loading' | 'ready' | 'error';

/**
 * The report detail (spec 3.4): one component for the 380 px right panel and the phone's bottom sheet.
 * The host decides where it sits; it reports what happened through its outputs.
 */
@Component({
  selector: 'app-report-detail',
  templateUrl: 'report-detail.component.html',
  styleUrls: ['report-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, LevelShapeComponent],
})
export class ReportDetailComponent {
  private svc = inject(ReportDetailService);
  private prompt = inject(LoginPromptService);
  protected readonly auth = inject(AuthService);
  private closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

  readonly reportId = input.required<string>();
  readonly closed = output<void>();
  readonly loaded = output<ReportDetail>();
  readonly missing = output<void>();
  readonly changed = output<ReportSignal>();

  protected readonly state = signal<State>('loading');
  protected readonly detail = signal<ReportDetail | null>(null);
  protected readonly comments = signal<PublicComment[]>([]);
  protected readonly confirmed = signal(false);
  protected readonly confirming = signal(false);
  protected readonly sending = signal(false);
  protected readonly draft = signal('');
  protected readonly message = signal('');

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
    this.message.set('');
    this.draft.set('');
    this.confirming.set(false); // flags belong to the report on screen, not to the panel
    this.sending.set(false);
    let d: ReportDetail | null;
    try {
      d = await this.svc.get(id);
    } catch {
      if (seq !== this.seq) return;
      this.state.set('error');
      this.message.set(MSG_LOAD);
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
  private onSignal(s: ReportSignal) {
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
      if (seq === this.seq) this.message.set(e instanceof ApiError ? e.messageTh : MSG_GENERIC);
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
      if (seq === this.seq) this.message.set(e instanceof ApiError ? e.messageTh : MSG_GENERIC);
    } finally {
      if (seq === this.seq) this.sending.set(false);
    }
  }

  protected login() {
    void this.prompt.ask();
  }

  protected async copyLink() {
    const url = `${location.origin}/r/${this.reportId()}`;
    try {
      await navigator.clipboard.writeText(url);
      this.message.set('คัดลอกลิงก์แล้ว ส่งต่อให้เพื่อนบ้านได้เลย');
    } catch {
      this.message.set('คัดลอกไม่สำเร็จ ลองคัดลอกจากแถบที่อยู่แทนนะ');
    }
  }

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
  protected status = (d: ReportDetail) => STATUS_TH[d.status];
  protected category = (d: ReportDetail) => CATEGORY_TH[d.category] ?? CATEGORY_TH.other;
  protected icon = (d: ReportDetail) => categoryIcon(d.category);
  protected longWait = (d: ReportDetail) => d.days_open > LONG_WAIT_DAYS;
  protected photoUrl = coverPhotoUrl;
  protected thumbUrl = (path: string) => coverPhotoUrl(thumbPath(path));
  protected kind = PHOTO_KIND_TH;
  protected ago = formatAgo;
  protected date = formatDate;
}
