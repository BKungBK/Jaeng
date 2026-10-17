import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ApiError } from './errors';
import type { Member, Store } from './store';

/** Resolves a bearer token to the user id (sub). Throws ApiError('unauthorized'). */
export type Verify = (token: string) => Promise<string>;

export function createVerifier(keys: JWTVerifyGetKey): Verify {
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, keys, {
        algorithms: ['ES256', 'RS256'],
        audience: 'authenticated',
        requiredClaims: ['sub'],
      });
      if (typeof payload.sub !== 'string' || payload.sub === '') throw new Error('no sub');
      return payload.sub;
    } catch {
      throw new ApiError('unauthorized');
    }
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
