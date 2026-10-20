import { REJECT_REASONS, type MyReport } from '@jaeng/shared/report';
import type { MessageKey } from '../../i18n/keys';
import type { IconName } from '../map/icons';

type Status = MyReport['status'];

/** A known key becomes its words, the admin's own words stay as written, nothing becomes a sentence. */
export function rejectReasonText(reason: string | null, t: (k: MessageKey) => string): string {
  if (!reason) return t('reject.none');
  return (REJECT_REASONS as readonly string[]).includes(reason) ? t(`reject.${reason as (typeof REJECT_REASONS)[number]}`) : reason;
}

/** Six statuses, six different words ('myStatus.<status>'): a status is never told by colour alone. */
export const statusKey = (s: Status): MessageKey => `myStatus.${s}`;

/** ...and six different Lucide shapes beside the words. */
export const STATUS_ICON: Record<Status, IconName> = {
  pending_review: 'clock',
  open: 'eye',
  fix_claimed: 'wrench',
  resolved: 'circleCheck',
  rejected: 'circleX',
  hidden: 'eyeOff',
};

/** Only these are on the public map, so only these have a page to open. */
export const PUBLIC_STATUS: readonly Status[] = ['open', 'fix_claimed', 'resolved'];
