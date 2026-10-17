import { iconElement, ICONS, IconName, isIconName } from './icons';

const names = Object.keys(ICONS) as IconName[];

describe('icons', () => {
  it.each(names)('%s renders an svg in currentColor', (name) => {
    const svg = iconElement(name, 24);
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.childElementCount).toBeGreaterThan(0);
  });

  it('knows its names', () => {
    expect(isIconName('construction')).toBe(true);
    expect(isIconName('toString')).toBe(false);
    expect(isIconName('\u{1F573}\u{FE0F}')).toBe(false); // the old road emoji
  });
});
