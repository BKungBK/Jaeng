import { LOCATION_MODES, LOG_ACTIONS } from '@jaeng/shared/admin';
import { isIconName } from '../map/icons';
import { ADMIN_TABS, LOCATION_MODE_TH, LOG_ACTION_TH, TAB_ICON, TAB_TH } from './admin-labels';

const distinct = (r: Record<string, string>) => new Set(Object.values(r)).size === Object.keys(r).length;

describe('admin labels', () => {
  it('names and draws every tab once', () => {
    expect(ADMIN_TABS).toEqual(['reports', 'claims', 'flags', 'users', 'log']);
    expect(Object.keys(TAB_TH)).toEqual([...ADMIN_TABS]);
    expect(TAB_TH.reports).toBe('รอตรวจ');
    expect(distinct(TAB_TH)).toBe(true);
    expect(distinct(TAB_ICON)).toBe(true);
    expect(Object.values(TAB_ICON).every(isIconName)).toBe(true);
  });

  it('names every location mode and log action once', () => {
    expect(Object.keys(LOCATION_MODE_TH).sort()).toEqual([...LOCATION_MODES].sort());
    expect(LOCATION_MODE_TH.exact).toBe('ตำแหน่งจริง (ไม่เลื่อน)');
    expect(distinct(LOCATION_MODE_TH)).toBe(true);
    expect(Object.keys(LOG_ACTION_TH).sort()).toEqual([...LOG_ACTIONS].sort());
    expect(distinct(LOG_ACTION_TH)).toBe(true);
  });
});
