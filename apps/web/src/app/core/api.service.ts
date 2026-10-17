import { inject, Injectable } from '@angular/core';
import type { ApiErrorBody } from '@jaeng/shared/api';
import { AuthService } from './auth.service';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly messageTh: string,
  ) {
    super(`${status} ${code}`);
  }
}

const UNAUTHORIZED = new ApiError(401, 'unauthorized', 'เข้าสู่ระบบก่อนนะ');

@Injectable({ providedIn: 'root' })
export class ApiService {
  private auth = inject(AuthService);

  async post<T>(path: string, body?: unknown): Promise<T> {
    const token = await this.auth.accessToken();
    if (!token) throw UNAUTHORIZED;
    let res = await this.send(path, body, token);
    if (res.status === 401) {
      // token may have expired mid-session: refresh once, retry once
      const fresh = await this.auth.refresh();
      if (fresh) res = await this.send(path, body, fresh);
    }
    if (!res.ok) throw await this.toError(res);
    return (await res.json()) as T;
  }

  private send(path: string, body: unknown, token: string): Promise<Response> {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return fetch(`/api${path}`, {
      method: 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  private async toError(res: Response): Promise<ApiError> {
    try {
      const { error } = (await res.json()) as ApiErrorBody;
      if (error && typeof error.code === 'string') return new ApiError(res.status, error.code, error.message_th);
    } catch {
      // not JSON
    }
    return new ApiError(res.status, 'internal', 'มีบางอย่างขัดข้อง ลองใหม่อีกครั้งนะ');
  }
}
