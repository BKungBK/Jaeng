import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import type { LiveSignal } from '@jaeng/shared/api';
import type { ModerationEffect } from '@jaeng/shared/admin';
import { applyEffect } from '../src/moderation/effects';
import { toEffect } from '../src/supabase-store';

const signal: LiveSignal = { id: 'r1', status: 'hidden', confirm_count: 1, comment_count: 0 };

function deps(fail: { promote?: number; demote?: number } = {}) {
  const log: string[] = [];
  let promoteFails = fail.promote ?? 0;
  let demoteFails = fail.demote ?? 0;
  return {
    log,
    deps: {
      photos: {
        promote: async (from: string, to: string) => {
          log.push(`promote ${from} ${to}`);
          if (promoteFails-- > 0) throw new Error('storage down');
        },
        demote: async (path: string) => {
          log.push(`demote ${path}`);
          if (demoteFails-- > 0) throw new Error('storage down');
        },
      },
      broadcast: async (s: LiveSignal) => {
        log.push(`broadcast ${s.status}`);
      },
    } as unknown as Parameters<typeof applyEffect>[0],
  };
}

describe('applyEffect', () => {
  const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
  afterEach(() => errorSpy.mockClear());

  test('moves files in list order, then broadcasts once', async () => {
    const { deps: d, log } = deps();
    const effect: ModerationEffect = {
      report: signal,
      promote: [{ from: 'u/a.webp', to: 'r/a.webp' }, { from: 'u/b.webp', to: 'r/b.webp' }],
      demote: ['r/c.webp'],
    };
    await applyEffect(d, effect);
    expect(log).toEqual(['promote u/a.webp r/a.webp', 'promote u/b.webp r/b.webp', 'demote r/c.webp', 'broadcast hidden']);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('a move that fails once is retried and not logged', async () => {
    const { deps: d, log } = deps({ promote: 1 });
    await applyEffect(d, { report: null, promote: [{ from: 'u/a.webp', to: 'r/a.webp' }], demote: [] });
    expect(log).toEqual(['promote u/a.webp r/a.webp', 'promote u/a.webp r/a.webp']);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('a move that fails twice is logged and the next one still runs', async () => {
    const { deps: d, log } = deps({ demote: 2 });
    await applyEffect(d, { report: signal, promote: [], demote: ['r/a.webp', 'r/b.webp'] });
    expect(log).toEqual(['demote r/a.webp', 'demote r/a.webp', 'demote r/b.webp', 'broadcast hidden']);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  test('no report means no broadcast', async () => {
    const { deps: d, log } = deps();
    await applyEffect(d, { report: null, promote: [], demote: [] });
    expect(log).toEqual([]);
  });
});

describe('toEffect', () => {
  test('accepts the database shape', () => {
    expect(toEffect({ report: signal, promote: [{ from: 'a', to: 'b' }], demote: ['c'], claim_id: 'x' })).toEqual({
      report: signal,
      promote: [{ from: 'a', to: 'b' }],
      demote: ['c'],
    });
    expect(toEffect({ report: null, promote: [], demote: [] }).report).toBeNull();
  });

  test('rejects a missing or wrong key', () => {
    expect(() => toEffect({ report: null, demote: [] })).toThrow();
    expect(() => toEffect({ report: null, promote: [{ from: 'a' }], demote: [] })).toThrow();
    expect(() => toEffect({ report: null, promote: [], demote: [1] })).toThrow();
    expect(() => toEffect({ report: { id: 'r1', status: 'gone', confirm_count: 0, comment_count: 0 }, promote: [], demote: [] })).toThrow();
    expect(() => toEffect(null)).toThrow();
  });
});
