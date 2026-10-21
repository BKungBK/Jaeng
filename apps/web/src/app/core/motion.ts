import { createAnimation, type AnimationBuilder } from '@ionic/angular';

// Plan 6b: one easing and one tempo for everything that moves (pages, panels, the camera).
// Motion always plays (owner decision); it only pauses with the tab.

/** An exponential-feeling ease-out: fast start, long soft landing. */
export const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
/** MapLibre flyTo: an unhurried arc. `essential` keeps it animated whatever the OS setting. */
export const FLY = { duration: 1600, curve: 1.3, essential: true } as const;
/** MapLibre fitBounds. */
export const FIT = { duration: 1200, essential: true } as const;

const ENTER_MS = 420;
const LEAVE_MS = 220;

/** The element Ionic shows and hides for a page: the page itself, or its .ion-page child. */
function pageOf(el: HTMLElement): HTMLElement {
  if (el.classList.contains('ion-page')) return el;
  return el.querySelector<HTMLElement>(':scope > .ion-page') ?? el;
}

/**
 * The page transition for ion-router-outlet: the new page rises 12 px out of a blur while the old one
 * fades. Back comes down from above instead. Ionic destroys the animation once it ends, so nothing
 * (no leftover filter) stays on the page.
 */
export const glassNav: AnimationBuilder = (_baseEl: unknown, opts: { enteringEl: HTMLElement; leavingEl?: HTMLElement; direction?: string }) => {
  const rise = opts.direction === 'back' ? -12 : 12;
  const entering = createAnimation()
    .addElement(pageOf(opts.enteringEl))
    .beforeRemoveClass('ion-page-invisible')
    .fromTo('opacity', 0, 1)
    .fromTo('transform', `translateY(${rise}px) scale(0.985)`, 'translateY(0) scale(1)')
    .fromTo('filter', 'blur(8px)', 'blur(0px)');
  const root = createAnimation().duration(ENTER_MS).easing(EASE).fill('both').addAnimation(entering);
  if (opts.leavingEl) {
    root.addAnimation(createAnimation().addElement(pageOf(opts.leavingEl)).duration(LEAVE_MS).fromTo('opacity', 1, 0));
  }
  return root;
};
