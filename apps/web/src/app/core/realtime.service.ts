import { inject, Injectable } from '@angular/core';
import { PublicStatus, REPORT_EVENT, REPORTS_CHANNEL, ReportSignal } from '@jaeng/shared/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

const STATUSES: readonly PublicStatus[] = ['open', 'fix_claimed', 'resolved'];
const isCount = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** The channel is public (anyone with the anon key can send), so drop anything not shaped like a signal. */
export function isReportSignal(v: unknown): v is ReportSignal {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s['id'] === 'string' &&
    s['id'] !== '' &&
    STATUSES.includes(s['status'] as PublicStatus) &&
    isCount(s['confirm_count']) &&
    isCount(s['comment_count'])
  );
}

// One shared `reports` broadcast channel; it is opened with the first listener and
// removed when the last one leaves. Listeners should treat a signal as "this report changed"
// and re-read it, not as the truth.
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private supabase = inject(SupabaseService);
  private listeners = new Set<(s: ReportSignal) => void>();
  private channel?: RealtimeChannel;
  private starting = false;
  /**
   * The removal still in flight. supabase-js `channel()` hands back a channel with the same topic
   * while it is being removed, so a new subscription must wait for this first.
   */
  private closing?: Promise<void>;

  listen(fn: (s: ReportSignal) => void): () => void {
    // wrap so the same function can be registered twice and each unsubscribe is independent
    const entry = (s: ReportSignal) => fn(s);
    this.listeners.add(entry);
    void this.ensureChannel();
    return () => {
      this.listeners.delete(entry);
      if (this.listeners.size === 0) this.closeChannel();
    };
  }

  private async ensureChannel(): Promise<void> {
    if (this.channel || this.starting) return;
    this.starting = true;
    try {
      while (this.closing) await this.closing;
      const client = await this.supabase.client();
      if (this.listeners.size === 0 || this.channel) return; // everyone left while the client was loading
      this.channel = client
        .channel(REPORTS_CHANNEL)
        .on('broadcast', { event: REPORT_EVENT }, ({ payload }) => {
          if (!isReportSignal(payload)) return;
          for (const l of [...this.listeners]) l(payload);
        })
        .subscribe();
    } catch {
      // realtime is best effort; the map still works without live updates
    } finally {
      this.starting = false;
    }
  }

  private closeChannel(): void {
    const ch = this.channel;
    if (!ch) return;
    this.channel = undefined;
    const done = this.remove(ch).then(() => {
      if (this.closing === done) this.closing = undefined;
    });
    this.closing = done;
  }

  private async remove(ch: RealtimeChannel): Promise<void> {
    try {
      const client = await this.supabase.client();
      await client.removeChannel(ch);
    } catch {
      // nothing to clean up if the client is gone
    }
  }
}
