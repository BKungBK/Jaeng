import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { DuplicateCandidate } from '@jaeng/shared/report';
import { MSG_INTERNAL_TH } from '@jaeng/shared/api';
import { ApiError } from '../../core/api.service';
import type { CategoryInfo } from '../../core/categories.service';
import { IconComponent } from '../../shared/icon.component';
import { LoginPromptService } from '../auth/login-prompt.service';
import { CategoryStepComponent } from './category-step.component';
import { DetailsSectionComponent } from './details-section.component';
import { DuplicateCardComponent } from './duplicate-card.component';
import { LocationStepComponent } from './location-step.component';
import { MapReturnService } from './map-return.service';
import { PhotoStepComponent } from './photo-step.component';
import { ReportDraftService } from './report-draft.service';
import { SentCardComponent } from './sent-card.component';
import { withLogin } from './with-login';

type Step = 1 | 2 | 3;
type View = 'flow' | 'duplicates' | 'sent';

const TITLES: Record<Step, string> = { 1: 'ถ่ายรูปปัญหา', 2: 'เป็นเรื่องอะไร', 3: 'ปักหมุดตรงไหน' };
/** Without EXIF or a device position the pin must be placed by hand, close enough to be useful. */
export const PIN_MIN_ZOOM = 14;

/**
 * `/report`: photo → category → pin (spec 3.5, .impeccable/surfaces/pp-features-report-new-*.md).
 * A full page on phones and a centred card from 820 px. The draft lives in ReportDraftService, so
 * going back a step (or leaving and coming back) keeps everything.
 */
@Component({
  selector: 'app-report-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    PhotoStepComponent,
    CategoryStepComponent,
    LocationStepComponent,
    DetailsSectionComponent,
    DuplicateCardComponent,
    SentCardComponent,
  ],
  templateUrl: 'report-new.page.html',
  styleUrl: 'report-new.page.scss',
  host: { class: 'ion-page' },
})
export class ReportNewPage {
  protected readonly draft = inject(ReportDraftService);
  private back = inject(MapReturnService);
  private prompt = inject(LoginPromptService);
  private injector = inject(Injector);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly step = signal<Step>(1);
  protected readonly view = signal<View>('flow');
  protected readonly candidates = signal<DuplicateCandidate[]>([]);
  protected readonly zoom = signal(0);
  protected readonly sending = signal(false);
  protected readonly message = signal('');
  protected readonly title = computed(() => TITLES[this.step()]);
  protected readonly steps: Step[] = [1, 2, 3];
  private scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  /** the pin only counts close in, wherever it came from: an EXIF or device pin dragged across the
   *  country at zoom 5 is as vague as none. A suggested pin opens at PIN_ZOOM (17), so three taps stay three. */
  protected readonly needsZoom = computed(() => this.zoom() < PIN_MIN_ZOOM);
  protected readonly photosWhy = computed(() => {
    const photos = this.draft.photos();
    if (photos.length === 0) return 'ยังไม่มีรูป กลับไปขั้นที่ 1 เพื่อใส่รูปก่อนนะ';
    if (photos.some((p) => p.state === 'error')) return 'มีรูปที่อัปโหลดไม่สำเร็จ กลับไปขั้นที่ 1 เพื่อลองใหม่หรือลบออกนะ';
    if (photos.some((p) => p.state !== 'ready')) return 'รอรูปอัปโหลดอีกนิดนะ';
    return '';
  });
  protected readonly canSend = computed(
    () =>
      !this.sending() &&
      !!this.draft.category() &&
      !!this.draft.location() &&
      this.draft.canContinueFromPhotos() &&
      !this.needsZoom(),
  );

  /** "3 แตะ": the first ready photo moves on by itself, once; a draft that already has photos does not */
  private autoAdvanced = this.draft.photos().length > 0;

  constructor() {
    effect(() => {
      if (this.step() !== 1 || !this.draft.canContinueFromPhotos()) return;
      untracked(() => {
        if (this.autoAdvanced) return;
        this.autoAdvanced = true;
        this.go(2);
      });
    });
  }

  /** Ionic calls this once the page has slid in: start keyboard and screen-reader users at its title
   *  (otherwise focus stays on the map page's button, now hidden, and falls back to the body). */
  ionViewDidEnter() {
    const heading = this.view() === 'sent' ? '#rn-sent-title' : this.view() === 'duplicates' ? '#rn-dup-title' : '#rn-step-title';
    this.host.nativeElement.querySelector<HTMLElement>(heading)?.focus({ preventScroll: true });
  }

  protected go(step: Step) {
    this.message.set('');
    this.step.set(step);
    this.focusHeading('#rn-step-title');
  }

  protected backOrClose() {
    if (this.view() === 'sent') void this.back.go();
    else if (this.view() === 'duplicates') {
      this.view.set('flow');
      this.focusHeading('#rn-step-title');
    } else if (this.step() === 1) void this.back.go();
    else this.go((this.step() - 1) as Step);
  }

  protected pickCategory(c: CategoryInfo) {
    if (this.draft.category() !== c.slug) {
      this.draft.setCategory(c.slug);
      // the level starts at the category's usual one; the reporter can change it under "เพิ่มรายละเอียด"
      this.draft.details.update((d) => ({ ...d, danger: c.default_level }));
    }
    this.go(3);
  }

  protected async send() {
    if (!this.canSend()) return; // a second press while the first is out does nothing
    this.sending.set(true);
    this.message.set('');
    try {
      const result = await withLogin(this.prompt, () => this.draft.submit());
      if (result.kind === 'created') this.finish();
      else {
        this.candidates.set(result.candidates);
        this.view.set('duplicates');
        this.focusHeading('#rn-dup-title');
      }
    } catch (e) {
      this.message.set(e instanceof ApiError ? e.messageTh : MSG_INTERNAL_TH);
    } finally {
      this.sending.set(false);
    }
  }

  protected finish() {
    this.view.set('sent');
    this.draft.reset();
    this.focusHeading('#rn-sent-title');
  }

  private focusHeading(selector: string) {
    afterNextRender(
      () => {
        this.scroller()?.nativeElement.scrollTo?.({ top: 0 });
        this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }
}
