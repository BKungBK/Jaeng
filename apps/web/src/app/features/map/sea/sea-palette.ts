// Sea colours (DESIGN.md "Sea"), after the owner's contour-chart reference: a glowing teal in the
// shallows easing out to a deep tone, pale contour lines (`caustic`) and white foam. Daylight keeps
// it pastel; night is the reference's navy and teal. Fixed per theme, like the toy colours.

export type SeaTheme = 'light' | 'dark';
export type Rgb = [number, number, number];
export type SeaPalette = { deep: Rgb; mid: Rgb; shallow: Rgb; foam: Rgb; caustic: Rgb };

export const SEA_HEX: Record<SeaTheme, Record<keyof SeaPalette, string>> = {
  light: {
    deep: '#86A6D4',
    mid: '#9FCFDD',
    shallow: '#C8F0E6',
    foam: '#FFFFFF',
    caustic: '#F2FCF9',
  },
  dark: {
    deep: '#16234D',
    mid: '#1F5A6E',
    shallow: '#4DB0AA',
    foam: '#D8F7F0',
    caustic: '#86DCD2',
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
