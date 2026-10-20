import { TestBed } from '@angular/core/testing';
import { LOCATION_MODES, LOG_ACTIONS } from '@jaeng/shared/admin';
import { I18nService } from '../../core/i18n.service';
import type { MessageKey } from '../../i18n/keys';
import { isIconName } from '../map/icons';
import { ADMIN_TABS, locationKey, logActionText, TAB_ICON, tabKey } from './admin-labels';

const distinct = (words: string[]) => new Set(words).size === words.length;
const t = (k: MessageKey) => TestBed.inject(I18nService).t(k);

describe('admin labels', () => {
  it('names and draws every tab once, in both languages', () => {
    expect(ADMIN_TABS).toEqual(['reports', 'claims', 'flags', 'users', 'log']);
    expect(t(tabKey('reports'))).toBe('รอตรวจ');
    expect(distinct(ADMIN_TABS.map((x) => t(tabKey(x))))).toBe(true);
    expect(distinct(Object.values(TAB_ICON))).toBe(true);
    expect(Object.values(TAB_ICON).every(isIconName)).toBe(true);
    TestBed.inject(I18nService).setLocale('en');
    expect(t(tabKey('reports'))).toBe('Waiting');
    expect(distinct(ADMIN_TABS.map((x) => t(tabKey(x))))).toBe(true);
  });

  it('names every location mode and log action once', () => {
    expect(t(locationKey('exact'))).toBe('ตำแหน่งจริง (ไม่เลื่อน)');
    expect(distinct(LOCATION_MODES.map((m) => t(locationKey(m))))).toBe(true);
    expect(distinct(LOG_ACTIONS.map((a) => logActionText(a, t)))).toBe(true);
    expect(logActionText('mystery', t)).toBe('mystery');
    TestBed.inject(I18nService).setLocale('en');
    expect(logActionText('approve_report', t)).toBe('Approved report');
  });
});
