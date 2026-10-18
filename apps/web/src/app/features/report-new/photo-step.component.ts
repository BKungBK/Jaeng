import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { PHOTOS_PER_REPORT_MAX } from '@jaeng/shared/report';
import { IconComponent } from '../../shared/icon.component';
import { ReportDraftService, type DraftPhoto } from './report-draft.service';

/** Step 1: take or pick 1–4 photos. They upload at once; the step only shows how each one is doing. */
@Component({
  selector: 'app-photo-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: 'photo-step.component.html',
  styleUrl: 'photo-step.component.scss',
})
export class PhotoStepComponent {
  protected readonly draft = inject(ReportDraftService);
  readonly next = output<void>();

  protected readonly max = PHOTOS_PER_REPORT_MAX;
  protected readonly photos = this.draft.photos;
  protected readonly full = computed(() => this.photos().length >= this.max);
  /** why "ไปต่อ" is still off, in words */
  protected readonly why = computed(() => {
    const photos = this.photos();
    if (photos.some((p) => p.state === 'error')) return 'มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบออกก่อนนะ';
    if (photos.some((p) => p.state !== 'ready')) return 'รอรูปอัปโหลดให้เสร็จก่อนนะ';
    return '';
  });

  protected picked(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = ''; // the same file can be picked again after a remove
    if (files.length > 0) void this.draft.addFiles(files);
  }

  protected remove(p: DraftPhoto) {
    this.draft.remove(p.localId);
  }

  protected retry(p: DraftPhoto) {
    void this.draft.retry(p.localId);
  }
}
