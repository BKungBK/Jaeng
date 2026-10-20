import { FLAG_REASONS, type FlagReason } from '@jaeng/shared/admin';
import type { MessageKey } from '../../i18n/keys';

/** The dictionary key for a content-report reason (members choose them, admins read them). */
export const flagReasonKey = (r: FlagReason): MessageKey => `flag.reason.${r}`;

/** A reason the app knows, worded; anything else as stored. */
export function flagReasonText(r: string, t: (k: MessageKey) => string): string {
  return (FLAG_REASONS as readonly string[]).includes(r) ? t(flagReasonKey(r as FlagReason)) : r;
}
