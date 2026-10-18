import { inject, Injectable } from '@angular/core';
import { MSG_INTERNAL_TH, type ApiErrorBody, type ErrorCode } from '@jaeng/shared/api';
import { AuthService } from './auth.service';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    readonly messageTh: string,
  ) {
    super(`${status} ${code}`);
  }
}

const MSG_INTERNAL = MSG_INTERNAL_TH;
const MSG_PHOTO_TOO_LARGE = 'รูปใหญ่เกินไป (ไม่เกิน 3 MB)';

type Method = 'GET' | 'POST' | 'PATCH';
type Payload = { json: unknown } | { form: FormData } | undefined;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private auth = inject(AuthService);

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

  private async request<T>(method: Method, path: string, payload: Payload): Promise<T> {
    const token = await this.auth.accessToken();
    if (!token) throw new ApiError(401, 'unauthorized', 'เข้าสู่ระบบก่อนนะ');
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
      throw new ApiError(res.status, 'internal', MSG_INTERNAL);
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
      return await fetch(`/api${path}`, { method, headers, body });
    } catch {
      throw new ApiError(0, 'network', 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้งนะ');
    }
  }

  private async toError(res: Response): Promise<ApiError> {
    // the body size limit answers with a bare, non-JSON 413
    if (res.status === 413) return new ApiError(413, 'photo_too_large', MSG_PHOTO_TOO_LARGE);
    try {
      const { error } = (await res.json()) as ApiErrorBody;
      if (error && typeof error.code === 'string') return new ApiError(res.status, error.code, error.message_th);
    } catch {
      // not JSON
    }
    return new ApiError(res.status, 'internal', MSG_INTERNAL);
  }
}
