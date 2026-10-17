import { describe, expect, test } from 'bun:test';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { createVerifier, requireMember } from '../src/auth';
import { ApiError } from '../src/errors';
import type { Member } from '../src/store';

const { publicKey, privateKey } = await generateKeyPair('ES256');
const other = await generateKeyPair('ES256');
const jwk = { ...(await exportJWK(publicKey)), alg: 'ES256', kid: 'k1', use: 'sig' };
const verify = createVerifier(createLocalJWKSet({ keys: [jwk] }));

const sign = (opts: { sub?: string; aud?: string; exp?: string | number; key?: CryptoKey } = {}) => {
  let jwt = new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: 'k1' }).setAudience(opts.aud ?? 'authenticated');
  if (opts.sub !== undefined || !('sub' in opts)) jwt = jwt.setSubject(opts.sub ?? 'user-1');
  jwt = jwt.setIssuedAt(Math.floor(Date.now() / 1000) - 7200).setExpirationTime(opts.exp ?? '1h');
  return jwt.sign(opts.key ?? privateKey);
};

const rejects = async (p: Promise<unknown>, code: string) => {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe(code as never);
};

describe('createVerifier', () => {
  test('valid ES256 token returns sub', async () => {
    expect(await verify(await sign())).toBe('user-1');
  });
  test('expired token', async () => {
    await rejects(verify(await sign({ exp: Math.floor(Date.now() / 1000) - 60 })), 'unauthorized');
  });
  test('wrong audience', async () => {
    await rejects(verify(await sign({ aud: 'anon' })), 'unauthorized');
  });
  test('signed by another key', async () => {
    await rejects(verify(await sign({ key: other.privateKey })), 'unauthorized');
  });
  test('HS256 token (anon key style)', async () => {
    const hs = await new SignJWT({ role: 'anon' })
      .setProtectedHeader({ alg: 'HS256' })
      .setAudience('authenticated')
      .setSubject('user-1')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('super-secret-super-secret-super-secret'));
    await rejects(verify(hs), 'unauthorized');
  });
  test('missing sub', async () => {
    const noSub = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(privateKey);
    await rejects(verify(noSub), 'unauthorized');
  });
  test('garbage', async () => {
    await rejects(verify('not-a-jwt'), 'unauthorized');
  });
});

describe('requireMember', () => {
  const store = (member: Member | null) => {
    const calls: string[] = [];
    return {
      calls,
      member: async (id: string) => {
        calls.push(id);
        return member;
      },
    };
  };
  const okVerify = async () => 'user-1';

  for (const header of [undefined, 'Basic x', 'Bearer ', 'Bearer', '']) {
    test(`rejects header ${JSON.stringify(header)} without touching the store`, async () => {
      const s = store({ id: 'user-1', role: 'user', banned: false });
      await rejects(requireMember(header, okVerify, s), 'unauthorized');
      expect(s.calls).toEqual([]);
    });
  }

  test('returns the member', async () => {
    const m: Member = { id: 'user-1', role: 'user', banned: false };
    expect(await requireMember('Bearer abc', okVerify, store(m))).toEqual(m);
  });
  test('null member is unauthorized', async () => {
    await rejects(requireMember('Bearer abc', okVerify, store(null)), 'unauthorized');
  });
  test('banned member', async () => {
    await rejects(requireMember('Bearer abc', okVerify, store({ id: 'user-1', role: 'user', banned: true })), 'banned');
  });
  test('verify failure propagates', async () => {
    const bad = async () => {
      throw new ApiError('unauthorized');
    };
    await rejects(requireMember('Bearer abc', bad, store(null)), 'unauthorized');
  });
});
