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
import { MSG_INTERNAL_TH } from '@jaeng/shared/api';
import { ApiError } from '../../core/api.service';
import { IconComponent } from '../../shared/icon.component';
import { FLAG_REASON_TH } from './flag-reason';
import { ReportDetailService } from './report-detail.service';

/** "รายงานเนื้อหาไม่เหมาะสม" for a report or a comment. Sits inline in the report detail. */
@Component({
  selector: 'app-flag-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  styleUrls: ['inline-form.scss'],
  styles: `
    .reasons {
      display: grid;
      gap: 6px;
    }
    .reason {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
      padding: 0 12px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--surf);
      color: var(--ink);
      font: 400 15px/1.4 'IBM Plex Sans Thai', system-ui, sans-serif;
      text-align: left;
      cursor: pointer;

      .mark {
        display: grid;
        place-items: center;
        flex: none;
        width: 20px;
        height: 20px;
        border: 1px solid var(--line);
        border-radius: 10px;
        color: var(--pri);
      }

      &[aria-checked='true'] {
        border: 2px solid var(--pri);
        padding: 0 11px;
        background: color-mix(in srgb, var(--pri) 10%, var(--surf));
        font-weight: 500;

        .mark {
          border-color: var(--pri);
        }
      }

      &:focus-visible {
        outline: 3px solid var(--pri);
        outline-offset: 2px;
      }
    }
  `,
  template: `
    <form (submit)="$event.preventDefault(); submit()">
      <h3 #heading tabindex="-1" [id]="headingId">{{ target().type === 'report' ? 'รายงานเรื่องนี้' : 'รายงานความคิดเห็นนี้' }}</h3>
      <p class="lede">บอกผู้ดูแลว่าเห็นอะไรไม่เหมาะสม</p>
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
                <app-icon name="check" [size]="14" />
              }
            </span>
            {{ words[r] }}
          </button>
        }
      </div>
      <textarea
        rows="2"
        aria-label="รายละเอียดเพิ่มเติม"
        [attr.aria-describedby]="headingId + '-count'"
        placeholder="เล่าเพิ่มให้ผู้ดูแลเข้าใจ (ไม่ใส่ก็ได้)"
        [value]="note()"
        (input)="note.set($any($event.target).value)"
      ></textarea>
      <span class="count" [id]="headingId + '-count'">{{ note().length }}/{{ max }}</span>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <div class="send-row">
        <button type="submit" class="btn primary" [disabled]="!canSend()">
          <app-icon name="flag" [size]="18" />ส่งรายงาน
        </button>
        <button type="button" class="btn" [disabled]="sending()" (click)="cancel.emit()">ยกเลิก</button>
      </div>
    </form>
  `,
})
export class FlagFormComponent implements AfterViewInit {
  private static seq = 0;
  private svc = inject(ReportDetailService);
  private heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  readonly target = input.required<{ type: FlagTarget; id: string }>();
  readonly done = output<void>();
  readonly cancel = output<void>();

  protected readonly headingId = `flag-form-${++FlagFormComponent.seq}`;
  protected readonly reasons = FLAG_REASONS;
  protected readonly words = FLAG_REASON_TH;
  protected readonly max = NOTE_MAX;
  protected readonly reason = signal<FlagReason | null>(null);
  protected readonly note = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal('');
  protected readonly canSend = computed(() => this.reason() !== null && !this.sending() && this.note().length <= NOTE_MAX);

  ngAfterViewInit() {
    this.heading().nativeElement.focus();
  }

  protected async submit() {
    const reason = this.reason();
    if (!reason || !this.canSend()) return;
    this.sending.set(true);
    this.error.set('');
    try {
      const body: FlagBody = { target_type: this.target().type, target_id: this.target().id, reason };
      const note = this.note().trim();
      if (note) body.note = note;
      await this.svc.flag(body);
      this.done.emit();
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.messageTh : MSG_INTERNAL_TH);
    } finally {
      this.sending.set(false);
    }
  }
}
