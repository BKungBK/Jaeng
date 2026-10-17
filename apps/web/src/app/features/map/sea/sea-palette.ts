// Sea colours (DESIGN.md "Sea"): warm pastels, mint shallows to a soft periwinkle deep, cream-white
// foam. `caustic` is the pale line colour (band contours, wave marks). Fixed per theme.

export type SeaTheme = 'light' | 'dark';
export type Rgb = [number, number, number];
export type SeaPalette = { deep: Rgb; mid: Rgb; shallow: Rgb; foam: Rgb; caustic: Rgb; sparkle: Rgb };

export const SEA_HEX: Record<SeaTheme, Record<keyof SeaPalette, string>> = {
  light: {
    deep: '#8AAEDD',
    mid: '#A5D4E4',
    shallow: '#C3EBDD',
    foam: '#FFFBF2',
    caustic: '#E9FAF2',
    sparkle: '#FFF4D6',
  },
  dark: {
    deep: '#2F4068',
    mid: '#3A6479',
    shallow: '#4E8C86',
    foam: '#ECE5D6',
    caustic: '#93CCC2',
    sparkle: '#F5E7C4',
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
