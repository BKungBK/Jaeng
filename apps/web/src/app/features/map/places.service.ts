import { inject, Injectable } from '@angular/core';
import type { PlacesAnswer } from '@jaeng/shared/places';
import { ServerConfigService } from '../../core/server-config.service';
import type { Locale } from '../../i18n/keys';

/**
 * The place finder (GET /api/places): open to everyone, so a plain fetch without a token.
 * `more` also asks OpenStreetMap; only on an explicit request, never while typing (OSM policy).
 */
@Injectable({ providedIn: 'root' })
export class PlacesService {
  private server = inject(ServerConfigService);

  async search(q: string, lang: Locale, more = false): Promise<PlacesAnswer> {
    const res = await fetch(this.server.apiUrl(`/places?q=${encodeURIComponent(q)}&lang=${lang}${more ? '&more=1' : ''}`));
    if (!res.ok) throw new Error(`places ${res.status}`);
    return (await res.json()) as PlacesAnswer;
  }
}
