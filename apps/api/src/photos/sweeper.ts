import { thumbPath } from '@jaeng/shared/report';
import type { Store } from '../store';
import type { PhotoStorage } from './storage';

type Deps = { store: Pick<Store, 'deleteOrphanPhotos'>; photos: PhotoStorage };

/** Deletes photo rows never attached to a report and their files. Never throws. */
export async function sweepOrphans(deps: Deps, olderThanHours = 24): Promise<number> {
  try {
    const rows = await deps.store.deleteOrphanPhotos(olderThanHours);
    if (rows.length === 0) return 0;
    await deps.photos.remove(
      'photos-private',
      rows.flatMap((r) => [r.path, thumbPath(r.path)]),
    );
    return rows.length;
  } catch (e) {
    console.error('orphan photo sweep failed', e);
    return 0;
  }
}

/** Runs once now, then every interval. Returns stop(). */
export function startSweeper(deps: Deps, intervalMs = 3_600_000): () => void {
  void sweepOrphans(deps);
  const timer = setInterval(() => void sweepOrphans(deps), intervalMs);
  return () => clearInterval(timer);
}
