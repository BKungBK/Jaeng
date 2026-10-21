import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FLAG_REASONS, NOTE_MAX, type FlagBody, type FlagReason, type FlagTarget } from '@jaeng/shared/admin';
import { I18nService, type Said } from '../../core/i18n.service';
import { collapse } from '../../core/motion';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { TickComponent } from '../../shared/tick.component';
import { flagReasonKey } from './flag-reason';
import { ReportDetailService } from './report-detail.service';

/** "Report inappropriate content" for a report or a comment. Sits inline in the report detail. */
@Component({
  selector: 'app-flag-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TickComponent, TPipe],
  styleUrls: ['inline-form.scss', 'flag-form.component.scss'],
  template: `
    <form #form (submit)="$event.preventDefault(); submit()">
      <h3 #heading tabindex="-1" [id]="headingId">{{ (target().type === 'report' ? 'flagForm.report' : 'flagForm.comment') | t }}</h3>
      <p class="lede">{{ 'flagForm.lede' | t }}</p>
      <div class="reasons" role="radiogroup" [attr.aria-labelledby]="headingId">
        @for (r of reasons; track r) {
          <button
            type="button"
            role="radio"
            class="reason"
            [attr.aria-checked]="reason() === r"
            [disabled]="sending()"
            (click)="reason.set(r)"
          >
            <span class="mark" aria-hidden="true">
              @if (reason() === r) {
                <app-tick [size]="14" />
              }
            </span>
            {{ word(r) | t }}
          </button>
        }
      </div>
      <textarea
        rows="2"
        [attr.aria-label]="'flagForm.note' | t"
        [attr.aria-describedby]="headingId + '-count'"
        [attr.placeholder]="'flagForm.placeholder' | t"
        [value]="note()"
        (input)="note.set($any($event.target).value)"
      ></textarea>
      <span class="count" [id]="headingId + '-count'">{{ note().length }}/{{ max }}</span>
      @if (error()) {
        <p class="error" role="alert">{{ i18n.say(error()) }}</p>
      }
      <div class="send-row">
        <button type="submit" class="btn primary" [disabled]="!canSend()">
          <app-icon name="flag" [size]="18" />{{ 'flagForm.send' | t }}
        </button>
        <button type="button" class="btn" [disabled]="sending()" (click)="cancel.emit()">{{ 'common.cancel' | t }}</button>
      </div>
    </form>
  `,
})
export class FlagFormComponent implements AfterViewInit {
  private static seq = 0;
  private svc = inject(ReportDetailService);
  private heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  private form = viewChild.required<ElementRef<HTMLElement>>('form');

  readonly target = input.required<{ type: FlagTarget; id: string }>();
  readonly done = output<void>();
  readonly cancel = output<void>();

  protected readonly headingId = `flag-form-${++FlagFormComponent.seq}`;
  protected readonly reasons = FLAG_REASONS;
  protected readonly word = flagReasonKey;
  protected readonly i18n = inject(I18nService);
  protected readonly max = NOTE_MAX;
  protected readonly reason = signal<FlagReason | null>(null);
  protected readonly note = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal<Said>(null);
  protected readonly canSend = computed(() => this.reason() !== null && !this.sending() && this.note().length <= NOTE_MAX);

  ngAfterViewInit() {
    this.heading().nativeElement.focus();
  }

  protected async submit() {
    const reason = this.reason();
    if (!reason || !this.canSend()) return;
    this.sending.set(true);
    this.error.set(null);
    try {
      const body: FlagBody = { target_type: this.target().type, target_id: this.target().id, reason };
      const note = this.note().trim();
      if (note) body.note = note;
      await this.svc.flag(body);
      await collapse(this.form().nativeElement); // the form folds away, then the thanks takes its place
      this.done.emit();
    } catch (e) {
      this.error.set({ error: e });
    } finally {
      this.sending.set(false);
    }
  }
}
