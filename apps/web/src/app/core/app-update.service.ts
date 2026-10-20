import { inject, Injectable, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/**
 * The installed app (production build with the service worker) learns of a new version in the
 * background; this offers "มีเวอร์ชันใหม่" + "โหลดใหม่" instead of swapping code under the reader.
 * The dev server has no service worker, so nothing happens there.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly _ready = signal(false);
  readonly ready = this._ready.asReadonly();

  constructor() {
    const sw = inject(SwUpdate, { optional: true });
    if (!sw?.isEnabled) return;
    sw.versionUpdates.subscribe((e) => {
      if (e.type === 'VERSION_READY') this._ready.set(true);
    });
  }

  reload(): void {
    document.location.reload();
  }

  dismiss(): void {
    this._ready.set(false);
  }
}
