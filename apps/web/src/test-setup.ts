// Every test starts in Thai with the system theme: a choice stored by one test must not leak into the next.
afterEach(() => {
  try {
    localStorage.removeItem('jaeng.locale');
    localStorage.removeItem('jaeng.theme');
  } catch {
    // a test may have made storage throw
  }
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.lang = 'th';
});

// Polyfills for running unit tests under jsdom (the default Vitest environment).
// Ionic components such as ion-menu and ion-split-pane query `window.matchMedia`,
// which jsdom does not implement.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
