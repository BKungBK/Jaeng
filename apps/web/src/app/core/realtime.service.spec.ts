import { TestBed } from '@angular/core/testing';
import { REPORT_EVENT, REPORTS_CHANNEL, ReportSignal } from '@jaeng/shared/api';
import { isLiveSignal, RealtimeService } from './realtime.service';
import { SupabaseService } from './supabase.service';

function setup() {
  let handler: (m: { payload: ReportSignal }) => void = () => {};
  const ch: Record<string, unknown> = {};
  ch['on'] = vi.fn((_t: string, _f: unknown, h: typeof handler) => {
    handler = h;
    return ch;
  });
  ch['subscribe'] = vi.fn(() => ch);
  const client = { channel: vi.fn(() => ch), removeChannel: vi.fn() };
  TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: { client: async () => client } }] });
  return { client, ch, emit: (p: ReportSignal) => handler({ payload: p }), service: TestBed.inject(RealtimeService) };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const sig: ReportSignal = { id: 'r1', status: 'open', confirm_count: 3, comment_count: 1 };

describe('RealtimeService', () => {
  it('shares one channel between listeners and delivers the payload to each', async () => {
    const { client, ch, emit, service } = setup();
    const a = vi.fn();
    const b = vi.fn();
    service.listen(a);
    service.listen(b);
    await flush();
    expect(client.channel).toHaveBeenCalledTimes(1);
    expect(client.channel).toHaveBeenCalledWith(REPORTS_CHANNEL);
    expect(ch['on']).toHaveBeenCalledWith('broadcast', { event: REPORT_EVENT }, expect.any(Function));
    emit(sig);
    expect(a).toHaveBeenCalledWith(sig);
    expect(b).toHaveBeenCalledWith(sig);
  });

  it('removes the channel only after the last listener leaves', async () => {
    const { client, ch, emit, service } = setup();
    const a = vi.fn();
    const b = vi.fn();
    const offA = service.listen(a);
    const offB = service.listen(b);
    await flush();
    offA();
    expect(client.removeChannel).not.toHaveBeenCalled();
    emit(sig);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
    offB();
    await flush();
    expect(client.removeChannel).toHaveBeenCalledWith(ch);
  });

  it('does not subscribe when every listener leaves before the client is ready', async () => {
    const { client, service } = setup();
    service.listen(() => {})();
    await flush();
    expect(client.channel).not.toHaveBeenCalled();
  });

  it('drops malformed payloads', async () => {
    const { emit, service } = setup();
    const a = vi.fn();
    service.listen(a);
    await flush();
    const bad: unknown[] = [
      null,
      'r1',
      { ...sig, id: 7 },
      { ...sig, id: '' },
      { ...sig, status: 'deleted' },
      { ...sig, confirm_count: '3' },
      { ...sig, comment_count: -1 },
      { ...sig, confirm_count: 1.5 },
      { id: 'r1', status: 'open' },
    ];
    for (const p of bad) emit(p as ReportSignal);
    expect(a).not.toHaveBeenCalled();
    emit(sig);
    expect(a).toHaveBeenCalledTimes(1);
  });

  it('waits for a removal still in flight before opening the channel again', async () => {
    const { client, emit, service } = setup();
    let finishRemoval!: () => void;
    client.removeChannel.mockReturnValue(new Promise<void>((r) => (finishRemoval = r)));
    const offFirst = service.listen(() => {});
    await flush();
    expect(client.channel).toHaveBeenCalledTimes(1);
    offFirst(); // last one leaves: removal starts and hangs
    await flush();
    expect(client.removeChannel).toHaveBeenCalledTimes(1);
    const b = vi.fn();
    service.listen(b); // arrives before the removal finished
    await flush();
    expect(client.channel).toHaveBeenCalledTimes(1); // did not grab the channel being removed
    finishRemoval();
    await flush();
    expect(client.channel).toHaveBeenCalledTimes(2);
    emit(sig);
    expect(b).toHaveBeenCalledWith(sig);
  });

  it('can subscribe again after everyone left', async () => {
    const { client, service } = setup();
    service.listen(() => {})();
    await flush();
    service.listen(() => {});
    await flush();
    expect(client.channel).toHaveBeenCalledTimes(1);
  });
});

describe('isLiveSignal', () => {
  const ok = { id: 'r1', status: 'open', confirm_count: 1, comment_count: 0 };
  it('accepts the public statuses and hidden', () => {
    for (const status of ['open', 'fix_claimed', 'resolved', 'hidden']) expect(isLiveSignal({ ...ok, status })).toBe(true);
  });
  it('drops anything else', () => {
    expect(isLiveSignal({ ...ok, status: 'pending_review' })).toBe(false);
    expect(isLiveSignal({ ...ok, id: '' })).toBe(false);
    expect(isLiveSignal({ ...ok, confirm_count: -1 })).toBe(false);
    expect(isLiveSignal({ ...ok, comment_count: 1.5 })).toBe(false);
    expect(isLiveSignal(null)).toBe(false);
    expect(isLiveSignal('x')).toBe(false);
  });
});