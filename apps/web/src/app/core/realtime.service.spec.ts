import { TestBed } from '@angular/core/testing';
import { REPORT_EVENT, REPORTS_CHANNEL, ReportSignal } from '@jaeng/shared/api';
import { RealtimeService } from './realtime.service';
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

  it('can subscribe again after everyone left', async () => {
    const { client, service } = setup();
    service.listen(() => {})();
    await flush();
    service.listen(() => {});
    await flush();
    expect(client.channel).toHaveBeenCalledTimes(1);
  });
});
