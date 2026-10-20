// Test helper: the checks every page shares (plan 6 Task 11).

/** One h1, and no button a screen reader would announce as just "button". */
export function expectAccessiblePage(root: HTMLElement): void {
  expect(root.querySelectorAll('h1')).toHaveLength(1);
  const unnamed = [...root.querySelectorAll('button')].filter((b) => {
    const text = b.textContent?.trim();
    return !text && !b.getAttribute('aria-label')?.trim() && !b.getAttribute('aria-labelledby');
  });
  expect(unnamed.map((b) => b.outerHTML.slice(0, 120))).toEqual([]);
}
