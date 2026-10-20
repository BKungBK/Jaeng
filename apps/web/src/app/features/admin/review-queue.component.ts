import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { LOCATION_MODES, REJECT_NOTE_MAX, type ApproveBody, type LocationMode, type QueueReport, type RejectBody, type RejectReason } from '@jaeng/shared/admin';
import type { CategorySlug } from '@jaeng/shared/categories';
import { LEVELS, type DangerLevel } from '@jaeng/shared/levels';
import { REJECT_REASONS, TITLE_MAX } from '@jaeng/shared/report';
import { ApiError } from '../../core/api.service';
import { CategoriesService, type CategoryInfo } from '../../core/categories.service';
import { I18nService, type Said } from '../../core/i18n.service';
import type { MessageKey } from '../../i18n/keys';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { categoryIcon } from '../map/beacon';
import { LevelShapeComponent } from '../map/level-shape';
import { AdminService } from './admin.service';
import { locationKey } from './admin-labels';
import { PlaceMapComponent, type LngLat } from './place-map.component';

type Mode = 'view' | 'approve' | 'reject';
type LoadState = 'loading' | 'ready' | 'error';

/**
 * Tab "Waiting" (spec 3.10.1): new reports one at a time, oldest first. Approve opens the edits
 * (category, level, title, where to show it), reject asks for a reason. The two sit at opposite
 * ends and each needs a second press, so a slip publishes or rejects nothing.
 */
@Component({
  selector: 'app-review-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, LevelShapeComponent, PlaceMapComponent, TPipe],
  templateUrl: 'review-queue.component.html',
  styleUrl: 'review-queue.component.scss',
})
export class ReviewQueueComponent {
  private admin = inject(AdminService);
  protected readonly categoriesSvc = inject(CategoriesService);
  protected readonly i18n = inject(I18nService);

  readonly changed = output<void>();

  protected readonly state = signal<LoadState>('loading');
  protected readonly items = signal<QueueReport[]>([]);
  protected readonly index = signal(0);
  protected readonly mode = signal<Mode>('view');
  protected readonly busy = signal(false);
  protected readonly message = signal<Said>(null);
  protected readonly categories = signal<CategoryInfo[]>([]);

  // approve edits, starting from the report's own values
  protected readonly category = signal<CategorySlug>('other');
  protected readonly danger = signal<DangerLevel>(0);
  protected readonly title = signal('');
  protected readonly location = signal<LocationMode>('keep');
  protected readonly point = signal<LngLat | null>(null);
  // reject
  protected readonly reason = signal<RejectReason | null>(null);
  protected readonly note = signal('');

  protected readonly current = computed(() => this.items()[this.index()] ?? null);
  protected readonly truePoint = computed(() => {
    const r = this.current();
    return r ? { lng: r.lng, lat: r.lat } : null;
  });
  protected readonly shownPoint = computed(() => {
    const r = this.current();
    if (!r) return null;
    if (this.mode() === 'approve' && this.location() === 'point' && this.point()) return this.point()!;
    return { lng: r.public_lng, lat: r.public_lat };
  });
  protected readonly picking = computed(() => this.mode() === 'approve' && this.location() === 'point');
  protected readonly hazard = computed(() => this.category() === 'hazard');
  protected readonly titleLength = computed(() => [...this.title().trim()].length);
  protected readonly canApprove = computed(
    () => !this.busy() && this.titleLength() <= TITLE_MAX && (this.location() !== 'point' || this.point() !== null),
  );
  protected readonly canReject = computed(
    () => !this.busy() && this.reason() !== null && [...this.note().trim()].length <= REJECT_NOTE_MAX,
  );

  protected readonly modes = LOCATION_MODES;
  protected readonly modeKey = locationKey;
  protected readonly reasons = REJECT_REASONS;
  protected readonly reasonKey = (r: RejectReason): MessageKey => `reject.${r}`;
  protected readonly levels = LEVELS;
  protected readonly titleMax = TITLE_MAX;
  protected readonly noteMax = REJECT_NOTE_MAX;

  constructor() {
    void this.load();
    void this.categoriesSvc.list().then((c) => this.categories.set(c)).catch(() => {});
  }

  protected async load() {
    this.state.set('loading');
    try {
      this.items.set(await this.admin.queue('reports'));
      this.index.set(0);
      this.mode.set('view');
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  protected step(by: number) {
    const n = this.items().length;
    if (n === 0) return;
    this.index.set((this.index() + by + n) % n);
    this.mode.set('view');
  }

  protected openApprove() {
    const r = this.current();
    if (!r) return;
    this.category.set(r.category);
    this.danger.set(r.danger_level as DangerLevel);
    this.title.set(r.title);
    this.location.set('keep');
    this.point.set(null);
    this.message.set(null);
    this.mode.set('approve');
  }

  protected openReject() {
    this.reason.set(null);
    this.note.set('');
    this.message.set(null);
    this.mode.set('reject');
  }

  protected cancel() {
    this.mode.set('view');
  }

  /** Only what the admin changed; the database keeps the rest. */
  private approveBody(r: QueueReport): ApproveBody {
    const body: ApproveBody = { location: this.location() };
    if (this.category() !== r.category) body.category = this.category();
    if (this.danger() !== r.danger_level) body.danger_level = this.danger();
    const title = this.title().trim();
    if (title && title !== r.title) body.title = title;
    // the pin's point only, as the map reported it (canApprove waits for one): never the true point by default
    const p = this.point();
    if (body.location === 'point' && p) {
      body.lng = p.lng;
      body.lat = p.lat;
    }
    return body;
  }

  protected async approve() {
    const r = this.current();
    if (!r || !this.canApprove()) return;
    await this.act(r, () => this.admin.approve(r.id, this.approveBody(r)), 'admin.review.approved');
  }

  protected async reject() {
    const r = this.current();
    const reason = this.reason();
    if (!r || !reason || !this.canReject()) return;
    const body: RejectBody = { reason };
    const note = this.note().trim();
    if (reason === 'other' && note) body.note = note;
    await this.act(r, () => this.admin.reject(r.id, body), 'admin.review.rejected');
  }

  private async act(r: QueueReport, run: () => Promise<void>, done: MessageKey) {
    this.busy.set(true); // before any await: a second quick press is ignored
    this.message.set(null);
    try {
      await run();
      this.items.update((list) => list.filter((x) => x.id !== r.id));
      this.index.update((i) => Math.min(i, Math.max(0, this.items().length - 1)));
      this.mode.set('view');
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

  // template helpers
  protected level = (n: number) => LEVELS[n as DangerLevel] ?? LEVELS[0];
  protected icon = categoryIcon;
  protected categoryName = (slug: string) => {
    const c = this.categories().find((x) => x.slug === slug);
    return c ? this.categoriesSvc.labelOf(c) : slug;
  };
  protected ago = (iso: string) => this.i18n.ago(iso);
  protected date = (iso: string) => this.i18n.date(iso);
  protected onTitle = (e: Event) => this.title.set((e.target as HTMLInputElement).value);
  protected onNote = (e: Event) => this.note.set((e.target as HTMLTextAreaElement).value);
}
