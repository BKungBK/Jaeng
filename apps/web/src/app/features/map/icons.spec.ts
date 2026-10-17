import { addStickerImage, iconElement, ICONS, IconName, isIconName, stickerSvg, STICKER } from './icons';

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

  it('draws a sticker: cream disc, ink rim, icon paths', () => {
    const doc = new DOMParser().parseFromString(stickerSvg('compass', 96), 'image/svg+xml');
    const circle = doc.querySelector('svg > circle')!;
    expect(circle.getAttribute('fill')).toBe(STICKER.paper);
    expect(circle.getAttribute('stroke')).toBe(STICKER.ink);
    expect(doc.querySelector('svg > g path')).not.toBeNull();
    expect(doc.documentElement.getAttribute('width')).toBe('96');
  });

  it('knows its names', () => {
    expect(isIconName('construction')).toBe(true);
    expect(isIconName('toString')).toBe(false);
    expect(isIconName('\u{1F573}\u{FE0F}')).toBe(false); // the old road emoji
  });

  it('adds a sticker image once', async () => {
    const added: string[] = [];
    const map = { hasImage: (n: string) => added.includes(n), addImage: (n: string) => void added.push(n) };
    const load = vi.fn(async () => ({}) as HTMLImageElement);
    await addStickerImage(map as never, 'plane', 64, load);
    await addStickerImage(map as never, 'plane', 64, load);
    expect(added).toEqual(['plane']);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]).toEqual([expect.stringMatching(/^data:image\/svg\+xml/), expect.any(Number)]);
  });
});
