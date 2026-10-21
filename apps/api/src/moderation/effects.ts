import type { ModerationEffect } from '@jaeng/shared/admin';
import type { AppDeps } from '../app';

/** Runs a storage move; one retry, then the failure is only logged (the database change is already committed). */
async function move(what: string, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch {
    try {
      await run();
    } catch (e) {
      // The row already points at the new place, so the file can be moved by hand later.
      console.error(`photo ${what} failed`, e);
    }
  }
}

/** Moves the files a moderation call listed, then broadcasts its signal. Never throws. */
export async function applyEffect(deps: Pick<AppDeps, 'photos' | 'broadcast'>, effect: ModerationEffect): Promise<void> {
  for (const { from, to } of effect.promote) await move(`promote ${from} -> ${to}`, () => deps.photos.promote(from, to));
  for (const path of effect.demote) await move(`demote ${path}`, () => deps.photos.demote(path));
  if (effect.report) {
    try {
      await deps.broadcast(effect.report);
    } catch (e) {
      console.warn('broadcast failed', e instanceof Error ? e.message : e); // the change is committed: only say so
    }
  }
}
