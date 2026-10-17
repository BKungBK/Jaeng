import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// One Supabase client per app. supabase-js needs an absolute URL, so it is built from the
// page origin; the anon key comes from the API so the web app and the APK never hardcode it.
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private pending?: Promise<SupabaseClient>;

  client(): Promise<SupabaseClient> {
    this.pending ??= this.create().catch((e) => {
      this.pending = undefined; // let the next call retry
      throw e;
    });
    return this.pending;
  }

  private async create(): Promise<SupabaseClient> {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error(`config ${res.status}`);
    const { supabaseAnonKey } = (await res.json()) as { supabaseAnonKey: string };
    return createClient(`${location.origin}/sb`, supabaseAnonKey, { auth: { persistSession: false } });
  }
}
