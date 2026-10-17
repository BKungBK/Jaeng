// Cel sea colours (DESIGN.md "Cel map"), after the owner's reference: turquoise shallows cut
// sharply to a deep blue, white foam and sparkles. Fixed per theme, like the toy colours.

export type SeaTheme = 'light' | 'dark';
export type Rgb = [number, number, number];
export type SeaPalette = { deep: Rgb; mid: Rgb; shallow: Rgb; foam: Rgb; caustic: Rgb; sparkle: Rgb };

export const SEA_HEX: Record<SeaTheme, Record<keyof SeaPalette, string>> = {
  light: {
    deep: '#1556B8',
    mid: '#1FA2E0',
    shallow: '#3FD6C8',
    foam: '#FFFFFF',
    caustic: '#B9F3EC',
    sparkle: '#FFFFFF',
  },
  dark: {
    deep: '#0E2F6B',
    mid: '#145C93',
    shallow: '#1F8A8C',
    foam: '#CFE8F0',
    caustic: '#58C2C0',
    sparkle: '#E8F6FF',
  },
};

const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as Rgb;

export function seaPalette(theme: SeaTheme): SeaPalette {
  const hex = SEA_HEX[theme];
  return Object.fromEntries(Object.entries(hex).map(([k, v]) => [k, rgb(v)])) as SeaPalette;
}

/** Calls back with the theme whenever it changes (system setting or data-theme); returns a stop. */
export function watchSeaTheme(onChange: (theme: SeaTheme) => void): () => void {
  const apply = () => onChange(currentSeaTheme());
  const media = matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', apply);
  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    media.removeEventListener('change', apply);
    observer.disconnect();
  };
}

/** The theme the page is showing: an explicit data-theme wins, else the system setting. */
export function currentSeaTheme(root: HTMLElement = document.documentElement): SeaTheme {
  const forced = root.getAttribute('data-theme');
  if (forced === 'light' || forced === 'dark') return forced;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
