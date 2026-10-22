import { inject, Injectable } from '@angular/core';
import type { MeProfile } from '@jaeng/shared/api';
import type { MyReport } from '@jaeng/shared/report';
import { ApiService } from '../../core/api.service';
import type { Locale } from '../../i18n/keys';
import { PHOTO_PIPELINE } from '../report-new/photo-tools';

/** `/me`: the signed-in user's own reports, nickname, picture and language. Errors reach the page as ApiError. */
@Injectable({ providedIn: 'root' })
export class MeService {
  private api = inject(ApiService);
  private pipeline = inject(PHOTO_PIPELINE);

  async reports(): Promise<MyReport[]> {
    const res = await this.api.get<{ reports: MyReport[] }>('/me/reports');
    return res.reports;
  }

  async rename(name: string): Promise<string> {
    const res = await this.api.patch<{ display_name: string }>('/me', { display_name: name });
    return res.display_name;
  }

  /** The sign-up profile step: saves the nickname and marks the profile as set up. */
  async completeProfile(name: string): Promise<MeProfile> {
    return this.api.patch<MeProfile>('/me', { display_name: name, complete_profile: true });
  }

  async setLocale(locale: Locale): Promise<void> {
    await this.api.patch<{ locale: Locale }>('/me', { locale });
  }

  /** Shrinks the picture the way report photos are shrunk, sends it, and answers its path in the bucket. */
  async uploadAvatar(file: File): Promise<string> {
    const photo = await this.pipeline.compress(file);
    const form = new FormData();
    form.append('file', photo.blob, photo.type === 'image/webp' ? 'avatar.webp' : 'avatar.jpg');
    const res = await this.api.putForm<{ avatar_path: string }>('/me/avatar', form);
    return res.avatar_path;
  }

  async removeAvatar(): Promise<void> {
    await this.api.delete<{ avatar_path: null }>('/me/avatar');
  }
}
