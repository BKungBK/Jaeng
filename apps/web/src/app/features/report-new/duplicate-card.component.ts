import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CATEGORY_ICONS } from '@jaeng/shared/categories';
import { LEVELS, type DangerLevel } from '@jaeng/shared/levels';
import type { DuplicateCandidate } from '@jaeng/shared/report';
import { ApiError } from '../../core/api.service';
import { IconComponent } from '../../shared/icon.component';
import { LoginPromptService } from '../auth/login-prompt.service';
import { isIconName, type IconName } from '../map/icons';
import { LevelShapeComponent } from '../map/level-shape';
import { coverPhotoUrl, STATUS_TH } from '../map/report';
import { MapReturnService } from './map-return.service';
import { ReportDraftService } from './report-draft.service';
import { withLogin } from './with-login';

const SHOWN_MAX = 3;
const MSG_FAILED = 'ทำรายการไม่สำเร็จ ลองใหม่อีกครั้งนะ';

/** "เรื่องนี้ใช่ไหม?": the reports of the same category within 50 m. Agreeing counts the reporter in
 *  on that report instead (and attaches their first photo as a comment); disagreeing creates anyway. */
@Component({
  selector: 'app-duplicate-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, LevelShapeComponent],
  templateUrl: 'duplicate-card.component.html',
  styleUrl: 'duplicate-card.component.scss',
})
export class DuplicateCardComponent {
  private draft = inject(ReportDraftService);
  private back = inject(MapReturnService);
  private prompt = inject(LoginPromptService);

  readonly candidates = input.required<DuplicateCandidate[]>();
  /** the report was created after all */
  readonly created = output<string>();

  protected readonly shown = computed(() => this.candidates().slice(0, SHOWN_MAX));
  protected readonly busy = signal<string | null>(null);
  protected readonly message = signal('');

  protected level(c: DuplicateCandidate) {
    return LEVELS[c.danger_level as DangerLevel] ?? LEVELS[0];
  }
  protected icon(c: DuplicateCandidate): IconName {
    const name = CATEGORY_ICONS[c.category];
    return isIconName(name) ? name : 'mapPin';
  }
  protected photo = (c: DuplicateCandidate) => (c.cover_photo_path ? coverPhotoUrl(c.cover_photo_path) : null);
  protected status = (c: DuplicateCandidate) => STATUS_TH[c.status];

  protected async same(c: DuplicateCandidate) {
    await this.run(c.id, async () => {
      const { id } = await withLogin(this.prompt, () => this.draft.merge(c.id));
      this.draft.reset();
      await this.back.go(['/r', id], 'ขอบคุณนะ นับให้แล้ว');
    });
  }

  protected async different() {
    await this.run('new', async () => {
      const { id } = await withLogin(this.prompt, () => this.draft.createAnyway());
      this.created.emit(id);
    });
  }

  private async run(what: string, task: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(what);
    this.message.set('');
    try {
      await task();
    } catch (e) {
      this.message.set(e instanceof ApiError ? e.messageTh : MSG_FAILED);
    } finally {
      this.busy.set(null);
    }
  }
}
