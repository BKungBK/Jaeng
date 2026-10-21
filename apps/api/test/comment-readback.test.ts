import { describe, expect, spyOn, test } from 'bun:test';
import type { PublicComment } from '@jaeng/shared/api';
import { commentAfterInsert } from '../src/supabase-store';

const fallback: PublicComment = {
  id: 'c1',
  report_id: 'r1',
  body: 'ฝากแจ้งเขตด้วยนะ',
  author_name: null,
  created_at: '2026-10-21T08:00:00.000Z',
  by_reporter: false,
  photo_path: null,
};

/** a client whose `public_comments` read answers as the test says */
const client = (read: () => Promise<{ data: unknown; error: { message: string } | null }>) =>
  ({
    from: () => ({ select: () => ({ eq: () => ({ single: read }) }) }),
  }) as never;

describe('commentAfterInsert', () => {
  test('gives the row of the public view when it can be read (the anonymity rule lives there)', async () => {
    const row = { ...fallback, author_name: 'พี่ปลา', by_reporter: true };
    expect(await commentAfterInsert(client(async () => ({ data: row, error: null })), fallback)).toEqual(row);
  });

  test('falls back to what was inserted when the read fails: the comment exists, so the answer is not a 500', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined);
    const got = await commentAfterInsert(client(async () => ({ data: null, error: { message: 'timeout' } })), fallback);
    expect(got).toEqual(fallback);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('also when the read throws', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined);
    const got = await commentAfterInsert(
      client(async () => {
        throw new Error('network');
      }),
      fallback,
    );
    expect(got).toEqual(fallback);
    warn.mockRestore();
  });
});
