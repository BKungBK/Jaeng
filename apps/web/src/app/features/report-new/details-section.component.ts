import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injectable,
  signal,
  viewChild,
} from '@angular/core';
import { LEVELS, type DangerLevel } from '@jaeng/shared/levels';
import { DESCRIPTION_MAX, normalizeTag, TAG_MAX, TAGS_MAX, TITLE_MAX } from '@jaeng/shared/report';
import { I18nService } from '../../core/i18n.service';
import { SupabaseService } from '../../core/supabase.service';
import { TPipe } from '../../i18n/t.pipe';
import { IconComponent } from '../../shared/icon.component';
import { LevelShapeComponent } from '../map/level-shape';
import { ReportDraftService, type DraftDetails } from './report-draft.service';

const SUGGEST_DEBOUNCE_MS = 250;
const SUGGEST_ROWS = 8;

/** Tags other reports already use (`suggest_tags`, readable by anyone). Empty on any failure. */
@Injectable({ providedIn: 'root' })
export class TagSuggestService {
  private supabase = inject(SupabaseService);

  async suggest(q: string): Promise<string[]> {
    try {
      const client = await this.supabase.client();
      const { data, error } = await client.rpc('suggest_tags', { q, max_rows: SUGGEST_ROWS });
      return error || !Array.isArray(data) ? [] : (data as string[]);
    } catch {
      return [];
    }
  }
}

/** The optional part of a report, folded under "Add details" so the three taps stay three. */
@Component({
  selector: 'app-details-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, LevelShapeComponent, TPipe],
  templateUrl: 'details-section.component.html',
  styleUrl: 'details-section.component.scss',
})
export class DetailsSectionComponent {
  private draft = inject(ReportDraftService);
  protected readonly i18n = inject(I18nService);
  private tagsApi = inject(TagSuggestService);
  private tagInput = viewChild<ElementRef<HTMLInputElement>>('tagInput');
  private timer?: ReturnType<typeof setTimeout>;
  private asked = 0;

  protected readonly max = { title: TITLE_MAX, description: DESCRIPTION_MAX, tags: TAGS_MAX, tag: TAG_MAX };
  protected readonly levels = LEVELS;
  protected readonly open = signal(false);
  protected readonly d = this.draft.details;
  protected readonly full = computed(() => this.d().tags.length >= TAGS_MAX);
  protected readonly suggestions = signal<string[]>([]);
  /** suggestions not chosen yet */
  protected readonly offered = computed(() => {
    const chosen = new Set(this.d().tags.map(key));
    return this.suggestions().filter((s) => !chosen.has(key(s)));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected toggle() {
    this.open.update((v) => !v);
  }

  protected setText(field: 'title' | 'description', event: Event) {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.patch({ [field]: value });
  }

  protected setDanger(level: DangerLevel) {
    this.patch({ danger: level });
  }

  protected setHide(event: Event) {
    this.patch({ hideAuthor: (event.target as HTMLInputElement).checked });
  }

  protected onTagInput(event: Event) {
    const q = (event.target as HTMLInputElement).value.trim();
    clearTimeout(this.timer);
    if (q.replace(/^#+/, '') === '') {
      this.suggestions.set([]);
      return;
    }
    this.timer = setTimeout(() => void this.lookUp(q), SUGGEST_DEBOUNCE_MS);
  }

  protected onTagKey(event: KeyboardEvent) {
    if (event.key !== 'Enter' && event.key !== ',') return;
    event.preventDefault();
    this.addTag((event.target as HTMLInputElement).value);
  }

  /** As typed (the API normalises); never past five, never twice. */
  addTag(raw: string) {
    const tag = raw.replace(/,+$/, '').trim();
    const tags = this.d().tags;
    if (!tag || tags.length >= TAGS_MAX || tags.some((t) => key(t) === key(tag))) return;
    this.patch({ tags: [...tags, tag] });
    const input = this.tagInput()?.nativeElement;
    if (input) input.value = '';
    clearTimeout(this.timer);
    this.suggestions.set([]);
  }

  protected removeTag(tag: string) {
    this.patch({ tags: this.d().tags.filter((t) => t !== tag) });
  }

  private async lookUp(q: string) {
    const ask = ++this.asked;
    const found = await this.tagsApi.suggest(q);
    if (ask === this.asked) this.suggestions.set(found); // an older, slower answer never wins
  }

  private patch(change: Partial<DraftDetails>) {
    this.d.update((d) => ({ ...d, ...change }));
  }
}

/** How the API will store a tag, for spotting duplicates only (the typed text is what is sent). */
function key(tag: string): string {
  return normalizeTag(tag) ?? tag;
}
