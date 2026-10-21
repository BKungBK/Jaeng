import { createAnimation, type AnimationBuilder } from '@ionic/angular';
import { animate } from 'motion';

// Plan 6b: one easing and one tempo for everything that moves (pages, panels, the camera).
// Motion always plays (owner decision); it only pauses with the tab.
// Plan 8: one spring for choosing (a tick, a switch, a disc that bounces), and small helpers on the
// `motion` library for what CSS cannot do (wait for an exit, fold a row away, scatter sparks). Components
// never import `motion` themselves.

/** An exponential-feeling ease-out: fast start, long soft landing. */
export const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
/** MapLibre flyTo: an unhurried arc. `essential` keeps it animated whatever the OS setting. */
export const FLY = { duration: 1600, curve: 1.3, essential: true } as const;
/** MapLibre fitBounds. */
export const FIT = { duration: 1200, essential: true } as const;

/** The one spring for choosing. Mirrors `--pop` in theme/_motion.scss. */
export const POP_SPRING = { type: 'spring', visualDuration: 0.35, bounce: 0.3 } as const;

const ENTER_MS = 420;
const LEAVE_MS = 220;

/** The Web Animations API is missing in jsdom and in very old WebViews: helpers then do nothing, at once. */
const canAnimate = (el: Element): boolean => typeof el.animate === 'function';

/** Where `count` sparks fly to, evenly round a circle of `radius` px, the first straight up, each 12 ms after the last. */
export function burstSpecs(count: number, radius: number): { dx: number; dy: number; delay: number }[] {
  if (!(count >= 1)) return [];
  const n = Math.floor(count);
  const out: { dx: number; dy: number; delay: number }[] = [];
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    out.push({ dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius, delay: i * 12 });
  }
  return out;
}

/**
 * A short scatter of sparks from the middle of `host` (it must be `position: relative` or similar).
 * Sparks are `<i class="spark">` (theme/_motion.scss), removed when they land.
 */
export function burst(host: HTMLElement, opts: { count?: number; radius?: number; color?: string } = {}): void {
  if (!canAnimate(host)) return;
  const { count = 8, radius = 28, color = 'currentColor' } = opts;
  for (const s of burstSpecs(count, radius)) {
    const spark = document.createElement('i');
    spark.className = 'spark';
    spark.style.background = color;
    host.appendChild(spark);
    animate(
      spark,
      { x: [0, s.dx], y: [0, s.dy], scale: [1, 0], opacity: [1, 0] },
      { duration: 0.6, delay: s.delay / 1000, ease: 'easeOut' },
    ).finished.then(
      () => spark.remove(),
      () => spark.remove(),
    );
  }
}

/**
 * An element leaving: fades and drops 6 px (faster than it came in), then resolves. Remove it afterwards.
 * `to` says where it goes instead (a panel slides 16 px sideways). The animation is committed to the
 * element's style when it ends, so a caller that keeps the element must call `unleave`.
 */
export async function leave(el: HTMLElement, ms = 180, to: { x?: number; y?: number } = { y: 6 }): Promise<void> {
  if (!canAnimate(el)) return;
  await animate(el, { opacity: [1, 0], x: [0, to.x ?? 0], y: [0, to.y ?? 0] }, { duration: ms / 1000, ease: 'easeIn' }).finished;
}

/** Undo a `leave` that was interrupted (the element stays and shows again): stops it and clears what it left. */
export function unleave(el: HTMLElement): void {
  if (typeof el.getAnimations === 'function') for (const a of el.getAnimations()) a.cancel();
  el.style.opacity = '';
  el.style.transform = '';
}

/** A row folding away: height, margins and padding go to 0 as it fades, so what is below slides up. */
export async function collapse(el: HTMLElement, ms = 260): Promise<void> {
  if (!canAnimate(el)) return;
  const height = el.offsetHeight;
  el.style.overflow = 'hidden';
  await animate(
    el,
    { height: [height, 0], opacity: [1, 0], marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 },
    { duration: ms / 1000, ease: [0.2, 0.8, 0.2, 1] },
  ).finished;
}

/** The choosing spring: `el` settles from `from` x its size. Interrupting it starts from where it is. */
export async function springIn(el: HTMLElement, from = 0.8): Promise<void> {
  if (!canAnimate(el)) return;
  await animate(el, { scale: [from, 1] }, POP_SPRING).finished;
}

type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> } };

/**
 * Runs `update` (the change that repaints the page) inside a view transition: the new look fades in,
 * or, with an `origin`, grows as a circle from that point (theme/_motion.scss, `data-vt='reveal'`).
 * Without the API, in a hidden tab, or if the transition is skipped, `update` still runs exactly once.
 * An error thrown by `update` is rethrown.
 */
export async function viewTransition(update: () => void | Promise<void>, origin?: { x: number; y: number }): Promise<void> {
  const doc = document as ViewTransitionDoc;
  const root = document.documentElement;
  let updated = false;
  let failure: unknown;
  const run = async () => {
    updated = true;
    try {
      await update();
    } catch (e) {
      failure = e;
    }
  };
  if (typeof doc.startViewTransition === 'function' && !document.hidden) {
    if (origin) {
      root.style.setProperty('--vt-x', `${origin.x}px`);
      root.style.setProperty('--vt-y', `${origin.y}px`);
      root.dataset['vt'] = 'reveal';
    }
    try {
      await doc.startViewTransition(run).finished;
    } catch {
      // skipped or aborted: the callback has still run (or is run below)
    } finally {
      root.removeAttribute('data-vt');
    }
  }
  if (!updated) await run();
  if (failure) throw failure;
}

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
