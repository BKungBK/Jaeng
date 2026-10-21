import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { PHOTOS_PER_REPORT_MAX } from '@jaeng/shared/report';
import { DeviceService } from '../../core/device.service';
import { I18nService } from '../../core/i18n.service';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { ReportDraftService, type DraftPhoto } from './report-draft.service';

/** Step 1: take or pick 1–4 photos. They upload at once; the step only shows how each one is doing. */
@Component({
  selector: 'app-photo-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TPipe],
  templateUrl: 'photo-step.component.html',
  styleUrl: 'photo-step.component.scss',
})
export class PhotoStepComponent {
  protected readonly draft = inject(ReportDraftService);
  private device = inject(DeviceService);
  protected readonly i18n = inject(I18nService);
  readonly next = output<void>();

  protected readonly max = PHOTOS_PER_REPORT_MAX;
  protected readonly photos = this.draft.photos;
  protected readonly full = computed(() => this.photos().length >= this.max);
  /** why "Next" is still off, in words */
  protected readonly why = computed(() => {
    const photos = this.photos();
    if (photos.some((p) => p.state === 'error')) return this.i18n.t('photoStep.whyFailed');
    if (photos.some((p) => p.state !== 'ready')) return this.i18n.t('photoStep.whyUploading');
    return '';
  });

  /** The APK has its own camera and photo picker; the web clicks the hidden file input. */
  protected async openCamera(fallback: HTMLInputElement) {
    if (!this.device.native) return fallback.click();
    const file = await this.device.takePhoto();
    if (file) void this.draft.addFiles([file]);
  }

  protected async openGallery(fallback: HTMLInputElement) {
    if (!this.device.native) return fallback.click();
    const files = await this.device.pickPhotos(this.max - this.photos().length);
    if (files.length > 0) void this.draft.addFiles(files);
  }

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
