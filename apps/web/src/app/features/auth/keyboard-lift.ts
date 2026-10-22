import { DestroyRef } from '@angular/core';

/**
 * Browsers that overlay the keyboard (Android Chrome's default) shrink only the visual viewport, so lift the
 * sheet by the part the keyboard covers (`--kb` on its ion-modal, read by login-sheet.scss). `onPresent` runs
 * once Ionic has shown the modal. Call it after the first render, when the host is inside the modal.
 */
export function liftAboveKeyboard(host: HTMLElement, destroyRef: DestroyRef, onPresent?: () => void): void {
  const vv = window.visualViewport;
  const modal = host.closest<HTMLElement>('ion-modal');
  if (!modal) return;
  if (onPresent) modal.addEventListener('ionModalDidPresent', onPresent, { once: true });
  if (!vv) return;
  const update = () => {
    const covered = Math.max(0, innerHeight - vv.height - vv.offsetTop);
    modal.style.setProperty('--kb', `${Math.round(covered)}px`);
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
  destroyRef.onDestroy(() => {
    vv.removeEventListener('resize', update);
    vv.removeEventListener('scroll', update);
  });
}
