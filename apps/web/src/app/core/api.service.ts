import { inject, Injectable } from '@angular/core';
import type { ApiErrorBody, ErrorCode } from '@jaeng/shared/api';
import { en } from '../i18n/en';
import { th } from '../i18n/th';
import { AuthService } from './auth.service';
import { ServerConfigService } from './server-config.service';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    readonly messageTh: string,
    readonly messageEn: string,
  ) {
    super(`${status} ${code}`);
  }
}

type OwnError = keyof typeof th.errors;

/** An error the web app words itself, from the dictionaries (no I18nService: this runs outside views). */
function own(status: number, code: ErrorCode, key: OwnError): ApiError {
  return new ApiError(status, code, th.errors[key], en.errors[key]);
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type Payload = { json: unknown } | { form: FormData } | undefined;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private auth = inject(AuthService);
  private server = inject(ServerConfigService);

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path, undefined);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body === undefined ? undefined : { json: body });
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, { json: body });
  }

  /** multipart: no Content-Type here, the browser adds it together with the boundary */
  upload<T>(path: string, form: FormData): Promise<T> {
    return this.request<T>('POST', path, { form });
  }

  /** multipart PUT: replaces a thing that has one place (the profile picture) */
  putForm<T>(path: string, form: FormData): Promise<T> {
    return this.request<T>('PUT', path, { form });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path, undefined);
  }

  private async request<T>(method: Method, path: string, payload: Payload): Promise<T> {
    const token = await this.auth.accessToken();
    if (!token) throw own(401, 'unauthorized', 'unauthorized');
    let res = await this.send(method, path, payload, token);
    if (res.status === 401) {
      // token may have expired mid-session: refresh once, retry once
      const fresh = await this.auth.refresh();
      if (fresh) res = await this.send(method, path, payload, fresh);
    }
    if (!res.ok) throw await this.toError(res);
    try {
      return (await res.json()) as T;
    } catch {
      throw own(res.status, 'internal', 'internal');
    }
  }

  private async send(method: Method, path: string, payload: Payload, token: string): Promise<Response> {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    let body: string | FormData | undefined;
    if (payload && 'json' in payload) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(payload.json);
    } else if (payload) {
      body = payload.form;
    }
    try {
      return await fetch(this.server.apiUrl(path),{ method, headers, body });
    } catch {
      throw own(0, 'network', 'network');
    }
  }

  private async toError(res: Response): Promise<ApiError> {
    // the body size limit answers with a bare, non-JSON 413
    if (res.status === 413) return own(413, 'photo_too_large', 'photoTooLarge');
    try {
      const { error } = (await res.json()) as ApiErrorBody;
      if (error && typeof error.code === 'string')
        return new ApiError(res.status, error.code, error.message_th, error.message_en ?? error.message_th);
    } catch {
      // not JSON
    }
    return own(res.status, 'internal', 'internal');
  }
}
