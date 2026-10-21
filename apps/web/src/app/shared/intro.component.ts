import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { AppReadyService } from '../core/app-ready.service';
import { TPipe } from '../i18n/t.pipe';

/** The least time the full opening plays, so it never flashes by (a visit's first look). */
export const INTRO_FIRST_MS = 2800;
/** Later opens in the same visit are quick: the signal, the meter, and out as soon as the app is drawn. */
export const INTRO_REPEAT_MS = 700;
/** The reveal: the beam flares and the dawn opens as a circle over the finished map. */
export const INTRO_LEAVE_MS = 1100;
/** Never hold the app longer than this, whatever is still loading. */
export const INTRO_CAP_MS = 12000;
/** Once per visit gets the full opening: sessionStorage, so a new tab plays it again. */
export const INTRO_STORAGE_KEY = 'jaeng.intro';

/** 'seen' (this visit has had the full opening), 'skip' (set by the E2E tests: no opening at all), or 'new'. */
function visit(): 'new' | 'seen' | 'skip' {
  try {
    const v = sessionStorage.getItem(INTRO_STORAGE_KEY);
    if (v === 'skip') return 'skip';
    if (v === '1') return 'seen';
    sessionStorage.setItem(INTRO_STORAGE_KEY, '1');
  } catch {
    // private mode: play it in full, it still goes by itself
  }
  return 'new';
}

type Phase = 'in' | 'out' | 'gone';

/** A fixed sprinkle of stars (x and y in %, size in px, a twinkle delay in ms): the same sky every visit. */
const STARS = (() => {
  let seed = 7;
  const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 38 }, () => ({ x: next() * 100, y: next() * 70, size: 1 + next() * 2, delay: Math.round(next() * 2400) }));
})();

/**
 * The opening, and the app's real loading screen: a night sky, the signal (the logo, drawn in line) lit by its
 * beam, the name and a meter that follows the map actually loading (core/app-ready.service.ts). It stays until
 * the map is drawn, then the beam flares and the dawn opens as a circle over the finished map, so nothing
 * blinks in behind it. The panels below hold their entrance until then (`html.intro-holding`, theme/_motion.scss)
 * and rise as the circle opens. CSS keyframes only. Decorative: hidden from assistive tech, never focusable;
 * a tap or key skips what is left once the app is ready.
 */
@Component({
  selector: 'app-intro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe],
  template: `
    @if (phase() !== 'gone') {
      <div class="wrap" [class.out]="phase() === 'out'" [class.quick]="quick" aria-hidden="true" (click)="tap()">
        <div class="intro">
          <div class="sky"></div>
          <div class="horizon"></div>
          @for (s of stars; track $index) {
            <i class="star" [style.left.%]="s.x" [style.top.%]="s.y" [style.width.px]="s.size" [style.height.px]="s.size" [style.animation-delay.ms]="s.delay"></i>
          }

          <div class="stage">
            <div class="ripple r1"></div>
            <div class="ripple r2"></div>
            <div class="ripple r3"></div>
            <div class="pillar"></div>

            <svg class="glow" viewBox="290 110 444 770" aria-hidden="true">
              <use href="#intro-signal" />
            </svg>
            <svg class="signal" viewBox="290 110 444 770" aria-hidden="true">
              <defs>
                <linearGradient id="intro-g" gradientUnits="userSpaceOnUse" x1="300" y1="140" x2="724" y2="880">
                  <stop offset="0" stop-color="#ffeedd" />
                  <stop offset="0.5" stop-color="#f4b49a" />
                  <stop offset="1" stop-color="#c9a0dc" />
                </linearGradient>
              </defs>
              <g id="intro-signal" fill="none" stroke="url(#intro-g)" stroke-width="32" stroke-linecap="round">
                <ellipse class="d d1" cx="512" cy="824" rx="92" ry="30" pathLength="1" />
                <path class="d d2" d="M474 780 L376 456" pathLength="1" />
                <path class="d d2" d="M550 780 L648 456" pathLength="1" />
                <circle class="d d3" cx="512" cy="330" r="150" pathLength="1" />
                <path class="d d4" d="M512 262 L512 350" pathLength="1" />
                <circle class="dot" cx="512" cy="408" r="17" fill="url(#intro-g)" stroke="none" />
              </g>
            </svg>
          </div>

          <p class="word">{{ 'app.title' | t }}</p>
          <div class="meter"><i [style.transform]="'scaleX(' + ready.progress() + ')'"></i></div>
        </div>
        <div class="ring"></div>
      </div>
    }
  `,
  styles: `
    .wrap {
      --t: 1; /* the opening's pace: 1 in full, quicker on a repeat */
      --cx: 50%;
      --cy: 46%;
      position: fixed;
      z-index: 40000; /* over Ionic overlays and the update notice */
      inset: 0;
      color: #ffe8d2;
    }
    .wrap.quick {
      --t: 0.4;
    }
    .wrap.out {
      pointer-events: none;
      animation: intro-iris 1000ms cubic-bezier(0.55, 0.05, 0.2, 1) 120ms both;
    }
    /* the whole sky is a mask: the circle that opens lets the map show through */
    .intro {
      position: absolute;
      inset: 0;
      overflow: hidden;
      -webkit-mask-image: radial-gradient(circle at var(--cx) var(--cy), transparent var(--iris), #000 calc(var(--iris) + 70px));
      mask-image: radial-gradient(circle at var(--cx) var(--cy), transparent var(--iris), #000 calc(var(--iris) + 70px));
    }
    .sky {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, #060b22 0%, #101c47 55%, #232a63 100%);
    }
    /* the first light on the horizon, rising while the app loads */
    .horizon {
      position: absolute;
      inset: auto -20% -30% -20%;
      height: 70%;
      background:
        radial-gradient(50% 55% at 50% 100%, rgba(244, 180, 154, 0.55), transparent 70%),
        radial-gradient(36% 40% at 78% 100%, rgba(201, 160, 220, 0.4), transparent 70%);
      transform-origin: 50% 100%;
      animation: intro-horizon calc(var(--t) * 2400ms) var(--ease) both;
    }
    .star {
      position: absolute;
      border-radius: 50%;
      background: #fff;
      opacity: 0;
      animation: intro-twinkle 2600ms ease-in-out infinite;
    }
    .stage {
      position: absolute;
      left: var(--cx);
      top: var(--cy);
      width: 160px;
      height: 277px;
      margin: -138px 0 0 -80px;
    }
    .signal,
    .glow {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .glow {
      filter: blur(14px);
      opacity: 0;
      animation:
        intro-glow-in calc(var(--t) * 900ms) ease-out calc(var(--t) * 1000ms) forwards,
        intro-breathe 2400ms ease-in-out calc(var(--t) * 1900ms) infinite alternate;
    }
    .glow use {
      stroke-width: 44;
    }
    /* the lines draw themselves: lamp, beam, ring, the mark inside it */
    .d {
      stroke-dasharray: 1 1;
      animation: intro-draw calc(var(--t) * 520ms) var(--ease) both;
    }
    .d1 {
      animation-delay: calc(var(--t) * 350ms);
    }
    .d2 {
      animation-delay: calc(var(--t) * 650ms);
    }
    .d3 {
      animation-delay: calc(var(--t) * 900ms);
      animation-duration: calc(var(--t) * 720ms);
    }
    .d4 {
      animation-delay: calc(var(--t) * 1350ms);
      animation-duration: calc(var(--t) * 360ms);
    }
    .dot {
      transform-box: fill-box;
      transform-origin: center;
      animation: intro-dot calc(var(--t) * 420ms) var(--pop) calc(var(--t) * 1650ms) both;
    }
    /* the beam into the sky, from the lamp: it rises with the lines and goes on shimmering while the app loads */
    .pillar {
      position: absolute;
      left: 50%;
      bottom: 22px;
      width: 300px;
      height: 80vh;
      margin-left: -150px;
      background: linear-gradient(to top, rgba(255, 238, 221, 0.85), rgba(244, 180, 154, 0.32) 38%, transparent 90%);
      clip-path: polygon(42% 100%, 58% 100%, 100% 0, 0 0);
      transform-origin: 50% 100%;
      filter: blur(3px);
      animation:
        intro-rise calc(var(--t) * 900ms) var(--ease) calc(var(--t) * 800ms) both,
        intro-shimmer 2200ms ease-in-out calc(var(--t) * 1700ms) infinite alternate;
    }
    /* the light's ripples on the ground, one after another while it loads */
    .ripple {
      position: absolute;
      left: 50%;
      top: 251px;
      width: 330px;
      height: 78px;
      margin: -39px 0 0 -165px;
      border: 2px solid rgba(244, 180, 154, 0.75);
      border-radius: 50%;
      opacity: 0;
      animation: intro-ripple 2400ms ease-out infinite;
    }
    .r1 {
      animation-delay: calc(var(--t) * 700ms);
    }
    .r2 {
      animation-delay: calc(var(--t) * 700ms + 800ms);
    }
    .r3 {
      animation-delay: calc(var(--t) * 700ms + 1600ms);
    }
    .word {
      position: absolute;
      left: 0;
      right: 0;
      top: calc(var(--cy) + 168px);
      margin: 0;
      font: 600 44px/1.3 var(--font);
      text-align: center;
      text-shadow: 0 0 24px rgba(244, 180, 154, 0.55);
      animation: intro-word calc(var(--t) * 800ms) var(--ease) calc(var(--t) * 1500ms) both;
    }
    /* the meter follows the real loading: engine, map, toy land, reports, drawn */
    .meter {
      position: absolute;
      left: 50%;
      top: calc(var(--cy) + 234px);
      width: 148px;
      height: 3px;
      margin-left: -74px;
      overflow: hidden;
      border-radius: 2px;
      background: rgba(255, 232, 210, 0.16);
      animation: intro-meter calc(var(--t) * 500ms) ease-out calc(var(--t) * 1700ms) both;
    }
    .meter i {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: 2px;
      background: linear-gradient(90deg, #ffeedd, #f4b49a 60%, #c9a0dc);
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 500ms var(--ease);
    }
    /* the edge of the opening circle: a ring of light that goes out with it */
    .ring {
      position: absolute;
      left: var(--cx);
      top: var(--cy);
      width: calc(var(--iris) * 2 + 70px);
      height: calc(var(--iris) * 2 + 70px);
      transform: translate(-50%, -50%);
      border-radius: 50%;
      border: 2px solid rgba(255, 224, 200, 0.9);
      box-shadow:
        0 0 48px 8px rgba(244, 180, 154, 0.6),
        inset 0 0 70px rgba(244, 180, 154, 0.3);
      opacity: 0;
    }
    .wrap.out .ring {
      animation: intro-ring 1000ms linear 120ms both;
    }
    /* leaving: the stage swells and goes out in the light the circle opens from */
    .wrap.out .stage,
    .wrap.out .word,
    .wrap.out .meter {
      animation: intro-flare 560ms cubic-bezier(0.5, 0, 0.9, 0.4) both;
    }
    .wrap.out .pillar {
      animation: intro-pillar-flare 520ms ease-in both;
    }
    @keyframes intro-iris {
      to {
        --iris: 75vmax;
      }
    }
    @keyframes intro-ring {
      0% {
        opacity: 0;
      }
      12% {
        opacity: 1;
      }
      80% {
        opacity: 0.8;
      }
      100% {
        opacity: 0;
      }
    }
    @keyframes intro-flare {
      to {
        opacity: 0;
        transform: scale(1.5);
      }
    }
    @keyframes intro-pillar-flare {
      to {
        opacity: 0;
        transform: scaleX(2.4);
      }
    }
    @keyframes intro-draw {
      from {
        stroke-dashoffset: 1;
      }
    }
    @keyframes intro-dot {
      from {
        transform: scale(0);
        opacity: 0;
      }
    }
    @keyframes intro-glow-in {
      to {
        opacity: 0.8;
      }
    }
    @keyframes intro-breathe {
      from {
        opacity: 0.45;
      }
      to {
        opacity: 0.95;
      }
    }
    @keyframes intro-rise {
      from {
        transform: scaleY(0);
        opacity: 0;
      }
    }
    @keyframes intro-shimmer {
      from {
        opacity: 0.7;
      }
      to {
        opacity: 1;
      }
    }
    @keyframes intro-ripple {
      0% {
        opacity: 0;
        transform: scale(0.2);
      }
      15% {
        opacity: 0.9;
      }
      100% {
        opacity: 0;
        transform: scale(1.5);
      }
    }
    @keyframes intro-twinkle {
      0%,
      100% {
        opacity: 0;
      }
      50% {
        opacity: 0.85;
      }
    }
    @keyframes intro-horizon {
      from {
        opacity: 0;
        transform: translateY(40%) scale(0.8);
      }
    }
    @keyframes intro-word {
      from {
        opacity: 0;
        letter-spacing: 0.32em;
        transform: translateY(10px);
      }
    }
    @keyframes intro-meter {
      from {
        opacity: 0;
      }
    }
  `,
  host: { '(document:keydown)': 'tap()', '(document:pointerdown)': 'tap()' },
})
export class IntroComponent {
  protected readonly ready = inject(AppReadyService);
  private readonly kind = visit();
  protected readonly phase = signal<Phase>(this.kind === 'skip' ? 'gone' : 'in');
  /** a later open in the same visit: the full opening has been seen */
  protected readonly quick = this.kind === 'seen';
  protected readonly stars = STARS;
  private readonly played = signal(false);

  constructor() {
    // the plain sky of index.html that stood in until now: this component draws the same sky, so it just goes
    afterNextRender(() => document.getElementById('boot')?.remove());
    if (this.kind === 'skip') return;
    const root = document.documentElement;
    root.classList.add('intro-holding');
    const minimum = setTimeout(() => this.played.set(true), this.quick ? INTRO_REPEAT_MS : INTRO_FIRST_MS);
    const cap = setTimeout(() => this.leave(), INTRO_CAP_MS);
    // the opening has played its part and the app is drawn: reveal it
    effect(() => {
      if (this.played() && this.ready.ready()) untracked(() => this.leave());
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(minimum);
      clearTimeout(cap);
      clearTimeout(this.goneTimer);
      root.classList.remove('intro-holding');
    });
  }

  private goneTimer?: ReturnType<typeof setTimeout>;

  /** A tap or a key skips what is left of the opening, but only once there is a drawn app to show. */
  protected tap() {
    if (this.ready.ready()) this.leave();
  }

  private leave() {
    if (this.phase() !== 'in') return;
    this.phase.set('out');
    // the panels below start their entrance as the circle opens
    document.documentElement.classList.remove('intro-holding');
    this.goneTimer = setTimeout(() => this.phase.set('gone'), INTRO_LEAVE_MS + 120);
  }
}
