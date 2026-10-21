import { Injectable } from '@angular/core';

/** Where the server is. On the web that is the page itself; in the APK the page is http://localhost,
 *  so the address the reader saved (plan 7). Module state, because `coverPhotoUrl` is a plain function. */
let saved: string | null = null;

export function setServerOrigin(origin: string | null): void {
  saved = origin ? origin.replace(/\/+$/, '') : null;
}

export function serverOrigin(): string {
  return saved ?? location.origin;
}

const FULL_URL = /^(https?:|blob:|data:)/i;

/** A URL the API or a template hands over: full ones stay, `/sb/...` gets the server in front. */
export function serverUrl(u: string): string {
  return FULL_URL.test(u) || !u.startsWith('/') ? u : `${serverOrigin()}${u}`;
}

/** An approved report photo in the public bucket, by its path in the bucket. */
export function publicPhotoUrl(path: string): string {
  return `${serverOrigin()}/sb/storage/v1/object/public/photos-public/${path}`;
}

@Injectable({ providedIn: 'root' })
export class ServerConfigService {
  apiUrl(path: string): string {
    return `${serverOrigin()}/api${path}`;
  }

  sbUrl(): string {
    return `${serverOrigin()}/sb`;
  }
}
