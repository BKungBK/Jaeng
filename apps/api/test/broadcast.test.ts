import { describe, expect, test } from 'bun:test';
import { REPORT_EVENT, REPORTS_CHANNEL, type ReportSignal } from '@jaeng/shared/api';
import { createBroadcaster } from '../src/broadcast';

const signal: ReportSignal = { id: 'r1', status: 'open', confirm_count: 1, comment_count: 0 };

describe('createBroadcaster', () => {
  test('posts to the realtime broadcast REST endpoint', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return new Response(null, { status: 202 });
    }) as unknown as typeof fetch;
    await createBroadcaster('http://kong:8000', 'svc-key', fetchFn)(signal);
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe('http://kong:8000/realtime/v1/api/broadcast');
    expect(seen[0].init.method).toBe('POST');
    const headers = seen[0].init.headers as Record<string, string>;
    expect(headers.apikey).toBe('svc-key');
    expect(headers.Authorization).toBe('Bearer svc-key');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(seen[0].init.body as string)).toEqual({
      messages: [{ topic: REPORTS_CHANNEL, event: REPORT_EVENT, payload: signal, private: false }],
    });
  });

  test('resolves when fetch rejects', async () => {
    const fetchFn = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    await expect(createBroadcaster('http://x', 'k', fetchFn)(signal)).resolves.toBeUndefined();
  });

  test('resolves on non-2xx', async () => {
    const fetchFn = (async () => new Response('no', { status: 500 })) as unknown as typeof fetch;
    await expect(createBroadcaster('http://x', 'k', fetchFn)(signal)).resolves.toBeUndefined();
  });
});
