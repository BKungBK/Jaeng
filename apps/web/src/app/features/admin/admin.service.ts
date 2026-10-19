import { inject, Injectable } from '@angular/core';
import type {
  AdminCounts,
  AdminUser,
  ApproveBody,
  FlagAction,
  FlagTarget,
  HiddenItem,
  LogEntry,
  QueueClaim,
  QueueFlag,
  QueueReport,
  RejectBody,
} from '@jaeng/shared/admin';
import { ApiService } from '../../core/api.service';

const id = encodeURIComponent;

/** The admin API (spec 6, admin rows). The server checks the role on every call. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private api = inject(ApiService);

  counts(): Promise<AdminCounts> {
    return this.api.get<AdminCounts>('/admin/counts');
  }

  queue(type: 'reports'): Promise<QueueReport[]>;
  queue(type: 'claims'): Promise<QueueClaim[]>;
  queue(type: 'flags'): Promise<QueueFlag[]>;
  queue(type: 'hidden'): Promise<HiddenItem[]>;
  async queue(type: 'reports' | 'claims' | 'flags' | 'hidden'): Promise<unknown[]> {
    return (await this.api.get<{ items: unknown[] }>(`/admin/queue?type=${type}`)).items;
  }

  async approve(reportId: string, body: ApproveBody): Promise<void> {
    await this.api.post(`/admin/reports/${id(reportId)}/approve`, body);
  }

  async reject(reportId: string, body: RejectBody): Promise<void> {
    await this.api.post(`/admin/reports/${id(reportId)}/reject`, body);
  }

  async reviewClaim(claimId: string, approve: boolean): Promise<void> {
    await this.api.post(`/admin/fix-claims/${id(claimId)}/${approve ? 'approve' : 'reject'}`, {});
  }

  async resolveFlags(flagId: string, action: FlagAction): Promise<void> {
    await this.api.post(`/admin/flags/${id(flagId)}/resolve`, { action });
  }

  async hide(type: FlagTarget, targetId: string): Promise<void> {
    await this.api.post('/admin/hide', { target_type: type, target_id: targetId });
  }

  async restore(type: FlagTarget, targetId: string): Promise<void> {
    await this.api.post('/admin/restore', { target_type: type, target_id: targetId });
  }

  async users(q: string): Promise<AdminUser[]> {
    return (await this.api.get<{ users: AdminUser[] }>(`/admin/users?q=${encodeURIComponent(q)}`)).users;
  }

  async setBan(userId: string, banned: boolean): Promise<void> {
    await this.api.post(`/admin/users/${id(userId)}/${banned ? 'ban' : 'unban'}`, {});
  }

  async log(before: number | null): Promise<LogEntry[]> {
    return (await this.api.get<{ entries: LogEntry[] }>(before === null ? '/admin/log' : `/admin/log?before=${before}`)).entries;
  }
}
