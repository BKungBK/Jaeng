// Zoom rules for the toy map (spec 3.2, 4.4).
import type { MessageKey } from '../../i18n/keys';

/** Toy layers are fully shown up to zoom 6 and gone at zoom 8. Never quite 1: a fully opaque fill
 *  goes into MapLibre's opaque pass, which runs before the custom sea layer, so the sea would paint
 *  over the soil layers that hang over the water. */
export const TOY_FADE = ['interpolate', ['linear'], ['zoom'], 6, 0.999, 8, 0] as const;

/** Clusters stop forming above this zoom. */
export const CLUSTER_MAX_ZOOM = 11;

/** From this zoom each report gets its full beam and label. */
export const BEAM_ZOOM = 12;

export function toyOpacity(zoom: number): number {
  return Math.max(0, Math.min(1, (8 - zoom) / 2));
}

/** The status line in the corner card: what the visitor is looking at and what to do next. */
export function zoomHint(zoom: number, shown: number, levelsOn: number, t: (key: MessageKey) => string): string {
  if (levelsOn === 0) return t('map.hint.allOff');
  if (shown === 0) return t('map.hint.none');
  if (zoom < 6) return t('map.hint.country');
  if (zoom < 8) return t('map.hint.zooming');
  if (zoom < BEAM_ZOOM) return t('map.hint.street');
  return t('map.hint.neighbourhood');
}
