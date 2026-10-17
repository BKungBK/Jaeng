import { inject, Injectable } from '@angular/core';
import { REPORT_EVENT, REPORTS_CHANNEL, ReportSignal } from '@jaeng/shared/api';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

// One shared `reports` broadcast channel; it is opened with the first listener and
// removed when the last one leaves.
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private supabase = inject(SupabaseService);
  private listeners = new Set<(s: ReportSignal) => void>();
  private channel?: RealtimeChannel;
  private starting = false;

  listen(fn: (s: ReportSignal) => void): () => void {
    // wrap so the same function can be registered twice and each unsubscribe is independent
    const entry = (s: ReportSignal) => fn(s);
    this.listeners.add(entry);
    void this.ensureChannel();
    return () => {
      this.listeners.delete(entry);
      if (this.listeners.size === 0) void this.closeChannel();
    };
  }

  private async ensureChannel(): Promise<void> {
    if (this.channel || this.starting) return;
    this.starting = true;
    try {
      const client = await this.supabase.client();
      if (this.listeners.size === 0) return; // everyone left while the client was loading
      this.channel = client
        .channel(REPORTS_CHANNEL)
        .on('broadcast', { event: REPORT_EVENT }, ({ payload }) => {
          for (const l of [...this.listeners]) l(payload as ReportSignal);
        })
        .subscribe();
    } catch {
      // realtime is best effort; the map still works without live updates
    } finally {
      this.starting = false;
    }
  }

  private async closeChannel(): Promise<void> {
    const ch = this.channel;
    if (!ch) return;
    this.channel = undefined;
    try {
      const client = await this.supabase.client();
      await client.removeChannel(ch);
    } catch {
      // nothing to clean up if the client is gone
    }
  }
}
