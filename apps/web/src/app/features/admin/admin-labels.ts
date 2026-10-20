import { LOG_ACTIONS, type LocationMode } from '@jaeng/shared/admin';
import type { MessageKey } from '../../i18n/keys';
import type { IconName } from '../map/icons';

export const ADMIN_TABS = ['reports', 'claims', 'flags', 'users', 'log'] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

/** Dictionary keys for the admin words: 'admin.tab.*', 'admin.location.*', 'admin.log.*'. */
export const tabKey = (t: AdminTab): MessageKey => `admin.tab.${t}`;
export const locationKey = (m: LocationMode): MessageKey => `admin.location.${m}`;

/** A logged action the app knows, worded; anything else as stored. */
export function logActionText(action: string, t: (k: MessageKey) => string): string {
  return (LOG_ACTIONS as readonly string[]).includes(action)
    ? t(`admin.log.${action as (typeof LOG_ACTIONS)[number]}`)
    : action;
}

export const TAB_ICON: Record<AdminTab, IconName> = {
  reports: 'inbox',
  claims: 'wrench',
  flags: 'flag',
  users: 'users',
  log: 'history',
};
