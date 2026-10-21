import { inject, Injectable, InjectionToken } from '@angular/core';
import { Camera, CameraResultType, CameraSource, type CameraPlugin } from '@capacitor/camera';
import { Geolocation, type GeolocationPlugin } from '@capacitor/geolocation';
import { platform } from './platform';

export type LngLat = { lng: number; lat: number };

/**
 * The plugins sit behind tokens so specs hand in fakes (no WebView, no module mocks). The defaults are
 * plain objects, not the plugin proxies themselves: a proxy answers every property, so Angular would
 * find an `ngOnDestroy` on it and call it when the injector goes away.
 */
export const GEOLOCATION = new InjectionToken<Pick<GeolocationPlugin, 'checkPermissions' | 'requestPermissions' | 'getCurrentPosition'>>(
  'Geolocation',
  {
    providedIn: 'root',
    factory: () => ({
      checkPermissions: () => Geolocation.checkPermissions(),
      requestPermissions: (options) => Geolocation.requestPermissions(options),
      getCurrentPosition: (options) => Geolocation.getCurrentPosition(options),
    }),
  },
);
export const CAMERA = new InjectionToken<Pick<CameraPlugin, 'getPhoto' | 'pickImages'>>('Camera', {
  providedIn: 'root',
  factory: () => ({
    getPhoto: (options) => Camera.getPhoto(options),
    pickImages: (options) => Camera.pickImages(options),
  }),
});

const PHOTO_QUALITY = 90;
const EXTENSION: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };

/**
 * The one place that reads the device: its position and, in the APK, its camera and photo library
 * (spec 8.4). On the web the position comes from the browser and the photo buttons use `<input type=file>`.
 */
@Injectable({ providedIn: 'root' })
export class DeviceService {
  private geo = inject(GEOLOCATION);
  private camera = inject(CAMERA);
  /** true inside the APK */
  readonly native = platform.isNative();

  /** null when denied, unavailable or timed out; never rejects */
  async currentPosition(timeoutMs = 8000): Promise<LngLat | null> {
    if (this.native) {
      // the permission dialog waits for the reader, so it stays outside the clock below
      try {
        if (!(await this.locationAllowed())) return null;
      } catch {
        return null;
      }
    }
    return new Promise((resolve) => {
      let done = false;
      const finish = (v: LngLat | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      };
      // some devices never call back, so keep our own clock
      const timer = setTimeout(() => finish(null), timeoutMs + 500);
      (this.native ? this.nativeRead(timeoutMs) : this.webRead(timeoutMs)).then(finish, () => finish(null));
    });
  }

  /** One photo from the camera; null when the reader cancels or the camera is unavailable. Only in the APK. */
  async takePhoto(): Promise<File | null> {
    try {
      const photo = await this.camera.getPhoto({ source: CameraSource.Camera, resultType: CameraResultType.Uri, quality: PHOTO_QUALITY });
      return photo.webPath ? await toFile(photo.webPath) : null;
    } catch {
      return null; // "User cancelled photos app" is the normal way out
    }
  }

  /** Up to `limit` photos from the library; [] when the reader cancels. Only in the APK. */
  async pickPhotos(limit: number): Promise<File[]> {
    try {
      const { photos } = await this.camera.pickImages({ limit, quality: PHOTO_QUALITY });
      return await Promise.all(photos.map((p) => toFile(p.webPath)));
    } catch {
      return [];
    }
  }

  private async locationAllowed(): Promise<boolean> {
    const granted = (s: { location: string; coarseLocation?: string }) => s.location === 'granted' || s.coarseLocation === 'granted';
    if (granted(await this.geo.checkPermissions())) return true;
    return granted(await this.geo.requestPermissions({ permissions: ['location'] }));
  }

  private async nativeRead(timeoutMs: number): Promise<LngLat> {
    const p = await this.geo.getCurrentPosition({ enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 });
    return { lng: p.coords.longitude, lat: p.coords.latitude };
  }

  private webRead(timeoutMs: number): Promise<LngLat | null> {
    return new Promise((resolve) => {
      const geo = typeof navigator === 'undefined' ? undefined : navigator.geolocation;
      if (!geo) return resolve(null);
      geo.getCurrentPosition(
        (p) => resolve({ lng: p.coords.longitude, lat: p.coords.latitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
      );
    });
  }
}

/** The plugin hands back a local URL; the photo pipeline wants a File. */
async function toFile(webPath: string): Promise<File> {
  const blob = await (await fetch(webPath)).blob();
  return new File([blob], `jaeng-${Date.now()}.${EXTENSION[blob.type] ?? 'jpg'}`, { type: blob.type });
}
