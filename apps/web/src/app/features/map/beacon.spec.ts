import { LEVELS } from '@jaeng/shared/levels';
import {
  beaconAriaLabel,
  beaconView,
  categoryIcon,
  createBeaconElement,
  createClusterElement,
  pickLabelIds,
  updateBeaconElement,
} from './beacon';
import type { ReportProps } from './report';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n.service';

const words = () => TestBed.inject(I18nService);

const report = (over: Partial<ReportProps> = {}): ReportProps => ({
  id: 'r1',
  title: 'หลุมลึก',
  category: 'road',
  icon: 'construction',
  danger_level: 2,
  status: 'open',
  confirm_count: 0,
  comment_count: 0,
  days_open: 3,
  cover_photo_path: null,
  ...over,
});

describe('beaconView', () => {
  it.each([
    [0, 60],
    [1, 96],
    [3, 132],
    [10, 185],
    [40, 253],
  ])('full beam for %d confirms is %dpx', (n, h) => {
    expect(beaconView(report({ confirm_count: n }), 13)).toMatchObject({ compact: false, height: h, state: 'open' });
  });

  it('is compact with a 60px beam below zoom 12', () => {
    expect(beaconView(report({ confirm_count: 40 }), 9)).toMatchObject({ compact: true, height: 60 });
  });

  it('has no beam once resolved', () => {
    expect(beaconView(report({ status: 'resolved', confirm_count: 9 }), 13)).toMatchObject({ height: 0, state: 'done' });
  });

  it('maps fix_claimed to the claimed state', () => {
    expect(beaconView(report({ status: 'fix_claimed' }), 13).state).toBe('claimed');
  });
});

describe('beaconAriaLabel', () => {
  it('reads title, level and status', () => {
    expect(beaconAriaLabel(report(), words())).toBe('หลุมลึก ระดับอันตราย ยังไม่ได้แก้');
  });

  it('reads in English after a switch', () => {
    words().setLocale('en');
    expect(beaconAriaLabel(report({ danger_level: 3 }), words())).toBe('หลุมลึก Critical level, Not fixed yet');
  });
});

describe('createBeaconElement', () => {
  it('draws two pulse rings for level 2 and one for level 0', () => {
    const two = createBeaconElement(report(), beaconView(report(), 13), true, words());
    const one = createBeaconElement(report({ danger_level: 0 }), beaconView(report({ danger_level: 0 }), 13), true, words());
    expect(two.querySelectorAll('.ring')).toHaveLength(2);
    expect(one.querySelectorAll('.ring')).toHaveLength(1);
  });

  it('sets level colour, pulse and height as CSS variables', () => {
    const el = createBeaconElement(report({ confirm_count: 3 }), beaconView(report({ confirm_count: 3 }), 13), true, words());
    expect(el.style.getPropertyValue('--c')).toBe(LEVELS[2].color);
    expect(el.style.getPropertyValue('--d')).toBe('1.6s');
    expect(el.style.getPropertyValue('--h')).toBe('132px');
  });

  it('makes the disc a keyboard button with the category icon and level badge', () => {
    const el = createBeaconElement(report(), beaconView(report(), 13), true, words());
    const disc = el.querySelector<HTMLElement>('.disc')!;
    expect(disc.getAttribute('role')).toBe('button');
    expect(disc.tabIndex).toBe(0);
    expect(disc.dataset['id']).toBe('r1');
    expect(disc.getAttribute('aria-label')).toBe('หลุมลึก ระดับอันตราย ยังไม่ได้แก้');
    expect(disc.querySelector('img')).toBeNull();
    expect(disc.querySelector('svg.icon-construction')).not.toBeNull();
    expect(el.querySelector('.sym')!.getAttribute('data-level')).toBe('2');
  });

  it('marks fix_claimed and resolved by shape classes and a tick', () => {
    const claimed = createBeaconElement(report({ status: 'fix_claimed' }), beaconView(report({ status: 'fix_claimed' }), 13), true, words());
    expect(claimed.classList).toContain('st-claimed');
    const done = createBeaconElement(report({ status: 'resolved' }), beaconView(report({ status: 'resolved' }), 13), true, words());
    expect(done.classList).toContain('st-done');
    expect(done.querySelector('.disc svg.icon-construction')).toBeNull();
    expect(done.querySelector('.tick svg.icon-check')).not.toBeNull();
    expect(done.querySelector('.sym svg.icon-check')).not.toBeNull();
    expect(done.textContent).toBe('หลุมลึก');
  });

  it('renders a hostile title as text', () => {
    const title = '<img src=x onerror=alert(1)>';
    const el = createBeaconElement(report({ title }), beaconView(report({ title }), 13), true, words());
    expect(el.querySelector('img[src="x"]')).toBeNull();
    expect(el.querySelector('.lbl')!.textContent).toBe(title);
  });

  it('keeps the same focusable disc when only the label or height changes', () => {
    const p = report();
    const el = createBeaconElement(p, beaconView(p, 13), false, words());
    const disc = el.querySelector('.disc');
    updateBeaconElement(el, { ...p, confirm_count: 5 }, beaconView({ ...p, confirm_count: 5 }, 13), true, words());
    expect(el.querySelector('.disc')).toBe(disc);
    updateBeaconElement(el, p, beaconView(p, 13), false, words());
    expect(el.querySelector('.disc')).toBe(disc);
    expect(el.querySelector('.lbl')).toBeNull();
  });

  it('draws the level badge as a solid SVG shape', () => {
    const el = createBeaconElement(report({ danger_level: 3 }), beaconView(report({ danger_level: 3 }), 13), true, words());
    const sym = el.querySelector('.sym')!;
    expect(sym.querySelector('svg')).not.toBeNull();
    expect(sym.getAttribute('data-level')).toBe('3');
  });

  it('shows the label only when asked, and updates in place', () => {
    const p = report();
    const el = createBeaconElement(p, beaconView(p, 13), false, words());
    expect(el.querySelector('.lbl')).toBeNull();
    updateBeaconElement(el, { ...p, confirm_count: 10 }, beaconView({ ...p, confirm_count: 10 }, 13), true, words());
    expect(el.querySelector('.lbl')!.textContent).toBe('หลุมลึก');
    expect(el.style.getPropertyValue('--h')).toBe('185px');
  });
});

describe('createClusterElement', () => {
  it('shows the count with the highest level colour', () => {
    const el = createClusterElement(7, 3, 0, words());
    expect(el.style.getPropertyValue('--c')).toBe(LEVELS[3].color);
    const btn = el.querySelector('button')!;
    expect(btn.textContent).toBe('7');
    expect(btn.getAttribute('aria-label')).toBe('7 เรื่องในพื้นที่นี้ ระดับสูงสุดวิกฤต');
  });

  it('labels in English', () => {
    words().setLocale('en');
    expect(createClusterElement(7, 3, 0, words()).querySelector('button')!.getAttribute('aria-label')).toBe(
      '7 reports here, highest level Critical',
    );
  });

  it('adds a critical pill and words it when the group holds critical reports', () => {
    const el = createClusterElement(7, 3, 2, words());
    const pill = el.querySelector('.crit')!;
    expect(pill.textContent?.trim()).toBe('2');
    expect(pill.querySelector('svg')).not.toBeNull();
    expect(pill.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('button')!.textContent).toBe('7');
    expect(el.querySelector('button')!.getAttribute('aria-label')).toBe('7 เรื่องในพื้นที่นี้ ระดับสูงสุดวิกฤต วิกฤต 2 เรื่อง');
    words().setLocale('en');
    expect(createClusterElement(7, 3, 1, words()).querySelector('button')!.getAttribute('aria-label')).toBe(
      '7 reports here, highest level Critical, 1 critical',
    );
  });

  it('has no pill without critical reports', () => {
    expect(createClusterElement(7, 2, 0, words()).querySelector('.crit')).toBeNull();
  });

  it('says the highest level by shape too', () => {
    const el = createClusterElement(7, 1, 0, words());
    expect(el.querySelector('.sym')!.getAttribute('data-level')).toBe('1');
  });
});

describe('pickLabelIds', () => {
  it('keeps the 12 most confirmed', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({ id: `r${i}`, confirm_count: i }));
    expect([...pickLabelIds(items)].sort()).toEqual(items.slice(3).map((i) => i.id).sort());
  });
});

describe('categoryIcon', () => {
  it('maps flood to the waves icon', () => {
    expect(categoryIcon('flood')).toBe('waves');
  });

  it('falls back to the map pin for an unknown slug', () => {
    expect(categoryIcon('nope' as never)).toBe('mapPin');
  });
});
