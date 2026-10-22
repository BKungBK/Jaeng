import { inject, Injectable } from '@angular/core';
import type { FixClaimBody, FlagBody } from '@jaeng/shared/admin';
import type { PublicComment, ReportSignal } from '@jaeng/shared/api';
import type { PhotoUploaded } from '@jaeng/shared/report';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { PHOTO_PIPELINE } from '../report-new/photo-tools';
import { DETAIL_COLUMNS, ReportDetail, UUID } from './report-detail';

const COMMENT_LIMIT = 200;

/** Reads go straight to the public views; writes go through the API (spec 4.1). */
@Injectable({ providedIn: 'root' })
export class ReportDetailService {
  private supabase = inject(SupabaseService);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private pipeline = inject(PHOTO_PIPELINE);

  /** null for an id that is not a uuid (no request) and for a report that is not public. */
  async get(id: string): Promise<ReportDetail | null> {
    if (!UUID.test(id)) return null;
    const client = await this.supabase.client();
    const { data, error } = await client.from('public_reports').select(DETAIL_COLUMNS).eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as ReportDetail | null) ?? null;
  }

  async comments(id: string): Promise<PublicComment[]> {
    const client = await this.supabase.client();
    const { data, error } = await client
      .from('public_comments')
      .select('id, report_id, body, author_name, author_avatar, by_reporter, created_at, photo_path')
      .eq('report_id', id)
      .order('created_at', { ascending: true })
      .limit(COMMENT_LIMIT);
    if (error) throw new Error(error.message);
    return (data as PublicComment[] | null) ?? [];
  }

  /** Whether the signed-in user has pressed "เจอเหมือนกัน"; false when signed out. */
  async myConfirmation(id: string): Promise<boolean> {
    const user = this.auth.session()?.user.id;
    if (!user) return false;
    const client = await this.supabase.client();
    const { data, error } = await client
      .from('confirmations')
      .select('report_id')
      .eq('report_id', id)
      .eq('user_id', user)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data !== null;
  }

  toggleConfirm(id: string): Promise<{ confirmed: boolean; report: ReportSignal }> {
    return this.api.post(`/reports/${id}/confirm`);
  }

  addComment(id: string, body: string): Promise<{ comment: PublicComment; report: ReportSignal }> {
    return this.api.post(`/reports/${id}/comments`, { body });
  }

  /** "แจ้งว่าแก้แล้ว"; the photo (if any) stays private until an admin confirms. */
  claimFix(id: string, body: FixClaimBody): Promise<{ claim_id: string; report: ReportSignal }> {
    return this.api.post(`/reports/${id}/fix-claims`, body);
  }

  flag(body: FlagBody): Promise<{ flag_id: string; hidden: boolean }> {
    return this.api.post('/flags', body);
  }

  /** The same compression as the report flow, then the upload; returns the photo id. */
  async uploadPhoto(file: File): Promise<string> {
    const { blob } = await this.pipeline.compress(file);
    const form = new FormData();
    form.append('file', blob, blob.type === 'image/jpeg' ? 'photo.jpg' : 'photo.webp');
    return (await this.api.upload<PhotoUploaded>('/photos', form)).photo_id;
  }
}
