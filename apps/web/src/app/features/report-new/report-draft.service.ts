import { computed, effect, inject, Injectable, signal, untracked, type Signal, type WritableSignal } from '@angular/core';
import type { CategorySlug } from '@jaeng/shared/categories';
import {
  inThailand,
  PHOTOS_PER_REPORT_MAX,
  type DuplicateCandidate,
  type NewReportBody,
  type PhotoUploaded,
} from '@jaeng/shared/report';
import { MSG_INTERNAL_TH } from '@jaeng/shared/api';
import { ApiError, ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { DeviceService, type LngLat } from '../../core/device.service';
import { PHOTO_PIPELINE, PhotoTooLargeError } from './photo-tools';

export type DraftPhoto = {
  localId: string;
  previewUrl: string;
  width: number;
  height: number;
  gps: LngLat | null;
  state: 'compressing' | 'uploading' | 'ready' | 'error';
  photoId: string | null;
  errorTh: string | null;
  blob: Blob | null;
};

export type LocationSource = 'exif' | 'device' | 'fallback';

export type DraftDetails = {
  title: string;
  description: string;
  danger: 0 | 1 | 2 | 3 | null;
  tags: string[];
  hideAuthor: boolean;
};

export type SubmitResult = { kind: 'created'; id: string } | { kind: 'duplicates'; candidates: DuplicateCandidate[] };

const emptyDetails = (): DraftDetails => ({ title: '', description: '', danger: null, tags: [], hideAuthor: false });

const messageOf = (e: unknown): string =>
  e instanceof ApiError || e instanceof PhotoTooLargeError ? e.messageTh : 'เตรียมรูปนี้ไม่สำเร็จ ลองใหม่หรือเลือกรูปอื่นนะ';

/**
 * The report being written, kept in memory so the reporter can go back and forth between the three
 * steps without losing photos. Photos upload as soon as they are chosen; sending only sends ids.
 */
@Injectable({ providedIn: 'root' })
export class ReportDraftService {
  private api = inject(ApiService);
  private device = inject(DeviceService);
  private pipeline = inject(PHOTO_PIPELINE);

  private readonly _photos = signal<DraftPhoto[]>([]);
  private readonly _category = signal<CategorySlug | null>(null);
  private readonly _location = signal<(LngLat & { source: LocationSource }) | null>(null);
  /** the original files, for a retry */
  private files = new Map<string, File>();
  private nextId = 0;
  private sending?: Promise<unknown>;
  /** the report this draft already became: pressing send again must not make a second one */
  private createdId?: string;

  readonly photos: Signal<DraftPhoto[]> = this._photos.asReadonly();
  readonly category: Signal<CategorySlug | null> = this._category.asReadonly();
  readonly location: Signal<(LngLat & { source: LocationSource }) | null> = this._location.asReadonly();
  readonly details: WritableSignal<DraftDetails> = signal(emptyDetails());
  /** at least one photo, and every photo uploaded */
  readonly canContinueFromPhotos = computed(() => {
    const photos = this._photos();
    return photos.length > 0 && photos.every((p) => p.state === 'ready');
  });
  /** files past the four-photo limit were left out of the last pick */
  readonly overflowed = signal(false);

  /** who the draft belongs to; undefined until the first look at the session */
  private owner: string | null | undefined;

  constructor() {
    // The draft is one user's: their photos are uploaded under their id and only they may send them.
    // Signing out or switching user drops it, so the next person never sees or sends someone else's
    // photos. A token refresh keeps the same user id and keeps the draft.
    const auth = inject(AuthService);
    effect(() => {
      const id = auth.session()?.user.id ?? null;
      untracked(() => {
        if (this.owner !== undefined && id !== this.owner) this.reset();
        this.owner = id;
      });
    });
  }

  /** Takes up to the free slots; each photo goes through EXIF → compress → upload on its own. */
  async addFiles(files: File[]): Promise<void> {
    const room = Math.max(0, PHOTOS_PER_REPORT_MAX - this._photos().length);
    const take = files.slice(0, room);
    this.overflowed.set(files.length > take.length);
    const added = take.map((file) => {
      const localId = `photo-${++this.nextId}`;
      this.files.set(localId, file);
      const photo: DraftPhoto = {
        localId,
        previewUrl: URL.createObjectURL(file),
        width: 0,
        height: 0,
        gps: null,
        state: 'compressing',
        photoId: null,
        errorTh: null,
        blob: null,
      };
      return photo;
    });
    this._photos.update((list) => [...list, ...added]);
    // one at a time: a decoded phone photo is tens of megabytes, and the uploads share one connection anyway
    for (const p of added) await this.process(p.localId, true);
  }

  async retry(localId: string): Promise<void> {
    const photo = this.find(localId);
    if (photo?.state !== 'error') return;
    await this.process(localId, photo.gps === null); // a GPS read that failed gets another go
  }

  remove(localId: string): void {
    const photo = this.find(localId);
    if (!photo) return;
    URL.revokeObjectURL(photo.previewUrl);
    this.files.delete(localId);
    this._photos.update((list) => list.filter((p) => p.localId !== localId));
  }

  setCategory(slug: CategorySlug): void {
    this._category.set(slug);
  }

  setLocation(p: LngLat, source: LocationSource): void {
    this._location.set({ lng: p.lng, lat: p.lat, source });
  }

  /** The first photo with GPS, else the device; null leaves the page on the national view. */
  async suggestLocation(): Promise<void> {
    const fromPhoto = this._photos().find((p) => p.gps)?.gps;
    if (fromPhoto) {
      this.setLocation(fromPhoto, 'exif');
      return;
    }
    const here = await this.device.currentPosition();
    if (here && inThailand(here.lng, here.lat)) this.setLocation(here, 'device');
    else this._location.set(null);
  }

  /** Checks for duplicates first. One send at a time: a second press gets the same promise. */
  submit(): Promise<SubmitResult> {
    if (this.createdId) return Promise.resolve({ kind: 'created', id: this.createdId });
    return this.once(async (): Promise<SubmitResult> => {
      const body = this.body();
      const { duplicates } = await this.api.post<{ duplicates: DuplicateCandidate[] }>('/reports/check-duplicate', {
        lng: body.lng,
        lat: body.lat,
        category: body.category,
      });
      if (duplicates.length > 0) return { kind: 'duplicates', candidates: duplicates };
      return { kind: 'created', id: await this.create(body) };
    });
  }

  /** "ไม่ใช่ แจ้งเป็นเรื่องใหม่": create without the duplicate check. */
  createAnyway(): Promise<{ id: string }> {
    if (this.createdId) return Promise.resolve({ id: this.createdId });
    return this.once(async () => ({ id: await this.create(this.body()) }));
  }

  /** "ใช่ กดเจอเหมือนกันแทน": count me in on that report; the API attaches the first photo as a comment. */
  merge(targetId: string): Promise<{ id: string }> {
    return this.once(async () => {
      await this.api.post(`/reports/${encodeURIComponent(targetId)}/merge`, { photo_ids: this.readyIds() });
      return { id: targetId };
    });
  }

  /** Start over: frees every preview. */
  reset(): void {
    for (const p of this._photos()) URL.revokeObjectURL(p.previewUrl);
    this._photos.set([]);
    this.files.clear();
    this._category.set(null);
    this._location.set(null);
    this.details.set(emptyDetails());
    this.overflowed.set(false);
    this.createdId = undefined;
    this.sending = undefined;
  }

  // ---- internals ----

  private once<T>(run: () => Promise<T>): Promise<T> {
    if (this.sending) return this.sending as Promise<T>;
    const p = run().finally(() => {
      if (this.sending === p) this.sending = undefined;
    });
    this.sending = p;
    return p;
  }

  private async create(body: NewReportBody): Promise<string> {
    const { report } = await this.api.post<{ report: { id: string } }>('/reports', body);
    this.createdId = report.id;
    return report.id;
  }

  private readyIds(): string[] {
    return this._photos().flatMap((p) => (p.state === 'ready' && p.photoId ? [p.photoId] : []));
  }

  private body(): NewReportBody {
    const category = this._category();
    const location = this._location();
    const photoIds = this.readyIds();
    if (!category || !location || photoIds.length === 0) throw new ApiError(400, 'invalid_report', MSG_INTERNAL_TH);
    const d = this.details();
    const body: NewReportBody = { category, lng: location.lng, lat: location.lat, photo_ids: photoIds };
    const title = d.title.trim();
    const description = d.description.trim();
    if (title) body.title = title;
    if (description) body.description = description;
    if (d.danger !== null) body.danger_level = d.danger;
    // as typed: the API normalises (strips '#', lowercases) in one place
    if (d.tags.length > 0) body.tags = [...d.tags];
    body.hide_author = d.hideAuthor;
    return body;
  }

  private find(localId: string): DraftPhoto | undefined {
    return this._photos().find((p) => p.localId === localId);
  }

  private patch(localId: string, change: Partial<DraftPhoto>): boolean {
    if (!this.find(localId)) return false; // removed while it was working
    this._photos.update((list) => list.map((p) => (p.localId === localId ? { ...p, ...change } : p)));
    return true;
  }

  private async process(localId: string, first: boolean): Promise<void> {
    const file = this.files.get(localId);
    const current = this.find(localId);
    if (!file || !current) return;
    try {
      let blob = current.blob;
      if (first) {
        const gps = await this.pipeline.readGps(file);
        if (!this.patch(localId, { gps })) return;
      }
      if (!blob) {
        this.patch(localId, { state: 'compressing', errorTh: null });
        const out = await this.pipeline.compress(file);
        blob = out.blob;
        const old = this.find(localId);
        if (!old) return;
        // show what will be sent: the compressed copy decodes everywhere (an original HEIC may not)
        const previewUrl = URL.createObjectURL(blob);
        URL.revokeObjectURL(old.previewUrl);
        this.patch(localId, { blob, previewUrl, width: out.width, height: out.height });
      }
      if (!this.patch(localId, { state: 'uploading', errorTh: null })) return;
      const form = new FormData();
      form.append('file', blob, blob.type === 'image/jpeg' ? 'photo.jpg' : 'photo.webp');
      const res = await this.api.upload<PhotoUploaded>('/photos', form);
      this.patch(localId, { state: 'ready', photoId: res.photo_id, width: res.width, height: res.height });
    } catch (e) {
      this.patch(localId, { state: 'error', errorTh: messageOf(e) });
    }
  }
}
