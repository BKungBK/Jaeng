import { inject, Injectable } from '@angular/core';
import type { MyReport } from '@jaeng/shared/report';
import { ApiService } from '../../core/api.service';

/** `/me`: the signed-in user's own reports and display name. Errors reach the page as ApiError. */
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
}
