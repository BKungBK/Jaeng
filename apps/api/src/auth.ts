import { errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ApiError } from './errors';
import type { Member, Store } from './store';

/** Resolves a bearer token to the user id (sub). Throws ApiError('unauthorized'), or 'internal' when the keys can't be read. */
export type Verify = (token: string) => Promise<string>;

/**
 * True when jose rejected the token itself. A JWKS timeout, a bad JWKS response (jose's generic
 * JOSEError, JWKSInvalid) or a network error is our problem, not the caller's.
 */
function isTokenFailure(e: unknown): boolean {
  if (!(e instanceof errors.JOSEError)) return false;
  if (e instanceof errors.JWKSTimeout || e instanceof errors.JWKSInvalid) return false;
  return e.code !== errors.JOSEError.code;
}

export function createVerifier(keys: JWTVerifyGetKey): Verify {
  return async (token) => {
    let sub: unknown;
    try {
      const { payload } = await jwtVerify(token, keys, {
        algorithms: ['ES256', 'RS256'],
        audience: 'authenticated',
        requiredClaims: ['sub'],
      });
      sub = payload.sub;
    } catch (e) {
      if (isTokenFailure(e)) throw new ApiError('unauthorized');
      console.error('token verification could not run', e);
      throw new ApiError('internal');
    }
    if (typeof sub !== 'string' || sub === '') throw new ApiError('unauthorized');
    return sub;
  };
}

export async function requireMember(
  authorization: string | undefined,
  verify: Verify,
  store: Pick<Store, 'member'>,
): Promise<Member> {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? '');
  if (!match) throw new ApiError('unauthorized');
  const id = await verify(match[1]);
  const member = await store.member(id);
  if (!member) throw new ApiError('unauthorized');
  if (member.banned) throw new ApiError('banned');
  return member;
}

/** requireMember, then the admin role. Checked on every request: a demoted admin loses access at once. */
export async function requireAdmin(
  authorization: string | undefined,
  verify: Verify,
  store: Pick<Store, 'member'>,
): Promise<Member> {
  const member = await requireMember(authorization, verify, store);
  if (member.role !== 'admin') throw new ApiError('forbidden');
  return member;
}
