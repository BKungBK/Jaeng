import { Injectable } from '@angular/core';

export type LngLat = { lng: number; lat: number };

/** The one place that reads the device position. Plan 7 swaps the body for @capacitor/geolocation. */
@Injectable({ providedIn: 'root' })
export class DeviceService {
  /** null when denied, unavailable or timed out; never rejects */
  currentPosition(timeoutMs = 8000): Promise<LngLat | null> {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v: LngLat | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      };
      // some browsers never call back (e.g. a permission prompt left open), so keep our own clock
      const timer = setTimeout(() => finish(null), timeoutMs + 500);
      try {
        const geo = typeof navigator === 'undefined' ? undefined : navigator.geolocation;
        if (!geo) return finish(null);
        geo.getCurrentPosition(
          (p) => finish({ lng: p.coords.longitude, lat: p.coords.latitude }),
          () => finish(null),
          { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
        );
      } catch {
        finish(null);
      }
    });
  }
}
