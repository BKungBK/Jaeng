import { LEVELS } from '@jaeng/shared/levels';
import {
  beaconAriaLabel,
  beaconView,
  categoryIconUrl,
  createBeaconElement,
  createClusterElement,
  pickLabelIds,
  updateBeaconElement,
} from './beacon';
import type { ReportProps } from './report';

const report = (over: Partial<ReportProps> = {}): ReportProps => ({
  id: 'r1',
  title: 'หลุมลึก',
  category: 'road',
  icon: '🕳️',
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
    expect(beaconAriaLabel(report())).toBe('หลุมลึก ระดับอันตราย ยังไม่ได้แก้');
  });
});

describe('createBeaconElement', () => {
  it('draws two pulse rings for level 2 and one for level 0', () => {
    const two = createBeaconElement(report(), beaconView(report(), 13), true);
    const one = createBeaconElement(report({ danger_level: 0 }), beaconView(report({ danger_level: 0 }), 13), true);
    expect(two.querySelectorAll('.ring')).toHaveLength(2);
    expect(one.querySelectorAll('.ring')).toHaveLength(1);
  });

  it('sets level colour, pulse and height as CSS variables', () => {
    const el = createBeaconElement(report({ confirm_count: 3 }), beaconView(report({ confirm_count: 3 }), 13), true);
    expect(el.style.getPropertyValue('--c')).toBe(LEVELS[2].color);
    expect(el.style.getPropertyValue('--d')).toBe('1.6s');
    expect(el.style.getPropertyValue('--h')).toBe('132px');
  });

  it('makes the disc a keyboard button with the category icon and level badge', () => {
    const el = createBeaconElement(report(), beaconView(report(), 13), true);
    const disc = el.querySelector<HTMLElement>('.disc')!;
    expect(disc.getAttribute('role')).toBe('button');
    expect(disc.tabIndex).toBe(0);
    expect(disc.dataset['id']).toBe('r1');
    expect(disc.getAttribute('aria-label')).toBe('หลุมลึก ระดับอันตราย ยังไม่ได้แก้');
    expect(disc.querySelector('img')!.getAttribute('src')).toBe('assets/emoji/hole.png');
    expect(el.querySelector('.sym')!.textContent).toBe('◆');
  });

  it('marks fix_claimed and resolved by shape classes and a tick', () => {
    const claimed = createBeaconElement(report({ status: 'fix_claimed' }), beaconView(report({ status: 'fix_claimed' }), 13), true);
    expect(claimed.classList).toContain('st-claimed');
    const done = createBeaconElement(report({ status: 'resolved' }), beaconView(report({ status: 'resolved' }), 13), true);
    expect(done.classList).toContain('st-done');
    expect(done.querySelector('.disc img')).toBeNull();
    expect(done.querySelector('.sym')!.textContent).toBe('✓');
  });

  it('renders a hostile title as text', () => {
    const title = '<img src=x onerror=alert(1)>';
    const el = createBeaconElement(report({ title }), beaconView(report({ title }), 13), true);
    expect(el.querySelector('img[src="x"]')).toBeNull();
    expect(el.querySelector('.lbl')!.textContent).toBe(title);
  });

  it('shows the label only when asked, and updates in place', () => {
    const p = report();
    const el = createBeaconElement(p, beaconView(p, 13), false);
    expect(el.querySelector('.lbl')).toBeNull();
    updateBeaconElement(el, { ...p, confirm_count: 10 }, beaconView({ ...p, confirm_count: 10 }, 13), true);
    expect(el.querySelector('.lbl')!.textContent).toBe('หลุมลึก');
    expect(el.style.getPropertyValue('--h')).toBe('185px');
  });
});

describe('createClusterElement', () => {
  it('shows the count with the highest level colour', () => {
    const el = createClusterElement(7, 3);
    expect(el.style.getPropertyValue('--c')).toBe(LEVELS[3].color);
    const btn = el.querySelector('button')!;
    expect(btn.textContent).toBe('7');
    expect(btn.getAttribute('aria-label')).toBe('7 เรื่องในพื้นที่นี้');
  });
});

describe('pickLabelIds', () => {
  it('keeps the 12 most confirmed', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({ id: `r${i}`, confirm_count: i }));
    expect([...pickLabelIds(items)].sort()).toEqual(items.slice(3).map((i) => i.id).sort());
  });
});

describe('categoryIconUrl', () => {
  it('maps flood to the water wave', () => {
    expect(categoryIconUrl('flood')).toBe('assets/emoji/water-wave.png');
  });
});
