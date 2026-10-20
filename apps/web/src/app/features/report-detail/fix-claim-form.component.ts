import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FixClaimBody } from '@jaeng/shared/admin';
import type { ReportSignal } from '@jaeng/shared/api';
import { NOTE_MAX } from '@jaeng/shared/admin';
import { ApiError } from '../../core/api.service';
import { I18nService, type Said } from '../../core/i18n.service';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { ReportDetailService } from './report-detail.service';

/** Someone else got there first: the panel reloads the report and shows the API's words. */
const STALE = new Set(['claim_pending', 'already_resolved', 'report_not_found']);

/** "I saw it fixed": an optional photo and note for the admin. Sits inline in the report detail. */
@Component({
  selector: 'app-fix-claim-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TPipe],
  styleUrls: ['inline-form.scss'],
  styles: `
    .preview {
      position: relative;
      width: 96px;
      height: 96px;
      overflow: hidden;
      border-radius: 12px;
      background: var(--surf);

      img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      button {
        position: absolute;
        top: 2px;
        right: 2px;
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        padding: 0;
        border: 0;
        background: none;
        color: #2b2a33;
        cursor: pointer;

        app-icon {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          border-radius: 14px;
          background: #fff;
        }
      }
    }
  `,
  template: `
    <form (submit)="$event.preventDefault(); submit()">
      <h3 #heading tabindex="-1">{{ 'fixForm.title' | t }}</h3>
      <p class="lede">{{ 'fixForm.lede' | t }}</p>

      @if (previewUrl(); as url) {
        <div class="preview">
          <img [src]="url" [attr.alt]="'fixForm.previewAlt' | t" />
          <button type="button" [attr.aria-label]="'fixForm.removePhoto' | t" [disabled]="sending()" (click)="clearPhoto()">
            <app-icon name="x" [size]="18" />
          </button>
        </div>
      } @else {
        <div class="row">
          <button type="button" class="btn" [disabled]="sending()" (click)="camera.click()">
            <app-icon name="camera" [size]="18" />{{ 'fixForm.camera' | t }}
          </button>
          <button type="button" class="btn" [disabled]="sending()" (click)="gallery.click()">
            <app-icon name="image" [size]="18" />{{ 'fixForm.gallery' | t }}
          </button>
        </div>
      }
      <input #camera class="sr-only" type="file" accept="image/*" capture="environment" tabindex="-1" aria-hidden="true" (change)="picked($event)" />
      <input #gallery class="sr-only" type="file" accept="image/*" tabindex="-1" aria-hidden="true" (change)="picked($event)" />
      <p class="hint">{{ 'fixForm.hint' | t }}</p>

      <textarea
        rows="2"
        [attr.aria-label]="'fixForm.note' | t"
        aria-describedby="fix-claim-count"
        [attr.placeholder]="'fixForm.placeholder' | t"
        [value]="note()"
        (input)="note.set($any($event.target).value)"
      ></textarea>
      <span class="count" id="fix-claim-count">{{ note().length }}/{{ max }}</span>

      @if (error()) {
        <p class="error" role="alert">{{ i18n.say(error()) }}</p>
      }
      <div class="send-row">
        <button type="submit" class="btn primary" [disabled]="!canSend()">
          <app-icon name="send" [size]="18" />{{ 'fixForm.send' | t }}
        </button>
        <button type="button" class="btn" [disabled]="sending()" (click)="cancel.emit()">{{ 'common.cancel' | t }}</button>
      </div>
    </form>
  `,
})
export class FixClaimFormComponent implements AfterViewInit {
  private svc = inject(ReportDetailService);
  private heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  readonly reportId = input.required<string>();
  readonly done = output<ReportSignal>();
  readonly cancel = output<void>();
  /** The report changed under us (someone claimed or it was resolved): the API's error, to word. */
  readonly stale = output<unknown>();
  protected readonly i18n = inject(I18nService);

  protected readonly max = NOTE_MAX;
  protected readonly note = signal('');
  protected readonly file = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly sending = signal(false);
  protected readonly error = signal<Said>(null);
  protected readonly canSend = computed(() => !this.sending() && this.note().length <= NOTE_MAX);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revoke());
  }

  ngAfterViewInit() {
    this.heading().nativeElement.focus({ preventScroll: false });
  }

  protected picked(event: Event) {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    this.revoke();
    this.file.set(f);
    this.previewUrl.set(URL.createObjectURL(f));
    this.error.set(null);
  }

  protected clearPhoto() {
    this.revoke();
    this.file.set(null);
  }

  private revoke() {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
  }

  protected async submit() {
    if (!this.canSend()) return;
    this.sending.set(true); // before any await: a second quick click is ignored
    this.error.set(null);
    try {
      const body: FixClaimBody = {};
      const f = this.file();
      if (f) body.photo_id = await this.svc.uploadPhoto(f);
      const note = this.note().trim();
      if (note) body.note = note;
      const res = await this.svc.claimFix(this.reportId(), body);
      this.done.emit(res.report);
    } catch (e) {
      if (e instanceof ApiError && STALE.has(e.code)) {
        this.stale.emit(e);
      } else {
        this.error.set({ error: e });
      }
    } finally {
      this.sending.set(false);
    }
  }
}
