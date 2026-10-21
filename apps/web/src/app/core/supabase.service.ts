import { inject, Injectable } from '@angular/core';
import type { DemoUser } from '@jaeng/shared/api';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ServerConfigService } from './server-config.service';

export type AppConfig = { supabaseAnonKey: string; quickLogin: DemoUser[] };

// One Supabase client per app. supabase-js needs an absolute URL, so it is built from the
// server address; the anon key comes from the API so the web app and the APK never hardcode it.
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private server = inject(ServerConfigService);
  private pendingConfig?: Promise<AppConfig>;
  private pending?: Promise<SupabaseClient>;

  config(): Promise<AppConfig> {
    this.pendingConfig ??= this.loadConfig().catch((e) => {
      this.pendingConfig = undefined; // let the next call retry
      throw e;
    });
    return this.pendingConfig;
  }

  client(): Promise<SupabaseClient> {
    this.pending ??= this.create().catch((e) => {
      this.pending = undefined; // let the next call retry
      throw e;
    });
    return this.pending;
  }

  private async loadConfig(): Promise<AppConfig> {
    const res = await fetch(this.server.apiUrl('/config'));
    if (!res.ok) throw new Error(`config ${res.status}`);
    const body = (await res.json()) as Partial<AppConfig>;
    return { supabaseAnonKey: body.supabaseAnonKey ?? '', quickLogin: body.quickLogin ?? [] };
  }

  private async create(): Promise<SupabaseClient> {
    const { supabaseAnonKey } = await this.config();
    return createClient(this.server.sbUrl(),supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
}
