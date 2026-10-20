import { inject, Injectable } from '@angular/core';
import type { MyReport } from '@jaeng/shared/report';
import { ApiService } from '../../core/api.service';
import type { Locale } from '../../i18n/keys';

/** `/me`: the signed-in user's own reports, display name and language. Errors reach the page as ApiError. */
@Injectable({ providedIn: 'root' })
export class MeService {
  private api = inject(ApiService);

  async reports(): Promise<MyReport[]> {
    const res = await this.api.get<{ reports: MyReport[] }>('/me/reports');
    return res.reports;
  }

  async rename(name: string): Promise<string> {
    const res = await this.api.patch<{ display_name: string }>('/me', { display_name: name });
    return res.display_name;
  }

  async setLocale(locale: Locale): Promise<void> {
    await this.api.patch<{ locale: Locale }>('/me', { locale });
  }
}
