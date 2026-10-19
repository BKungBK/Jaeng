import { REPORT_EVENT, REPORTS_CHANNEL, type LiveSignal } from '@jaeng/shared/api';

/** Fire-and-forget Realtime Broadcast over REST. Never throws. */
export function createBroadcaster(supabaseUrl: string, serviceKey: string, fetchFn: typeof fetch = fetch) {
  return async (signal: LiveSignal): Promise<void> => {
    try {
      const res = await fetchFn(`${supabaseUrl}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ topic: REPORTS_CHANNEL, event: REPORT_EVENT, payload: signal, private: false }],
        }),
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) console.warn(`broadcast failed: ${res.status}`);
    } catch (err) {
      console.warn('broadcast failed', err instanceof Error ? err.message : err);
    }
  };
}
