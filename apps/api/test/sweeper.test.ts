import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';
import { startSweeper, sweepOrphans } from '../src/photos/sweeper';
import type { PhotoStorage } from '../src/photos/storage';

function deps(rows: { id: string; path: string }[] = [], over: { store?: () => Promise<unknown>; remove?: () => Promise<void> } = {}) {
  const calls = { hours: [] as number[], removed: [] as { bucket: string; paths: string[] }[] };
  const store = {
    deleteOrphanPhotos: async (h: number) => {
      calls.hours.push(h);
      if (over.store) await over.store();
      return rows;
    },
  };
  const photos = {
    remove: async (bucket: string, paths: string[]) => {
      calls.removed.push({ bucket, paths });
      if (over.remove) await over.remove();
    },
  } as unknown as PhotoStorage;
  return { d: { store, photos }, calls };
}

describe('sweepOrphans', () => {
  test('removes full and thumb files from photos-private and returns the row count', async () => {
    const { d, calls } = deps([
      { id: '1', path: 'u/a.webp' },
      { id: '2', path: 'u/b.webp' },
    ]);
    expect(await sweepOrphans(d)).toBe(2);
    expect(calls.hours).toEqual([24]);
    expect(calls.removed).toEqual([
      { bucket: 'photos-private', paths: ['u/a.webp', 'u/a_thumb.webp', 'u/b.webp', 'u/b_thumb.webp'] },
    ]);
  });

  test('custom age is passed through', async () => {
    const { d, calls } = deps();
    await sweepOrphans(d, 6);
    expect(calls.hours).toEqual([6]);
  });

  test('no rows -> remove not called, returns 0', async () => {
    const { d, calls } = deps([]);
    expect(await sweepOrphans(d)).toBe(0);
    expect(calls.removed).toEqual([]);
  });

  test('store error does not throw', async () => {
    const { d } = deps([], { store: async () => { throw new Error('db down'); } });
    const err = console.error;
    console.error = () => {};
    try {
      expect(await sweepOrphans(d)).toBe(0);
    } finally {
      console.error = err;
    }
  });

  test('storage error does not throw', async () => {
    const { d } = deps([{ id: '1', path: 'u/a.webp' }], { remove: async () => { throw new Error('s3 down'); } });
    const err = console.error;
    console.error = () => {};
    try {
      await sweepOrphans(d);
    } finally {
      console.error = err;
    }
  });
});

describe('startSweeper', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('runs once immediately, then every interval, and stop() stops it', async () => {
    const { d, calls } = deps();
    const stop = startSweeper(d, 1000);
    await Promise.resolve();
    expect(calls.hours.length).toBe(1);
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(calls.hours.length).toBe(2);
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    expect(calls.hours.length).toBe(4);
    stop();
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    expect(calls.hours.length).toBe(4);
  });
});
