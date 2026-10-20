import { Injectable } from '@angular/core';
import type { PlacesAnswer } from '@jaeng/shared/places';
import type { Locale } from '../../i18n/keys';

/**
 * The place finder (GET /api/places): open to everyone, so a plain fetch without a token.
 * `more` also asks OpenStreetMap; only on an explicit request, never while typing (OSM policy).
 */
@Injectable({ providedIn: 'root' })
export class PlacesService {
  async search(q: string, lang: Locale, more = false): Promise<PlacesAnswer> {
    const res = await fetch(`/api/places?q=${encodeURIComponent(q)}&lang=${lang}${more ? '&more=1' : ''}`);
    if (!res.ok) throw new Error(`places ${res.status}`);
    return (await res.json()) as PlacesAnswer;
  }
}
