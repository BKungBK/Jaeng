import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { TPipe } from '../i18n/t.pipe';
import { BackdropComponent } from './backdrop.component';

/** How long the intro plays before it lets go of the app. */
export const INTRO_MS = 1800;
/** Once per visit: sessionStorage, so a new tab plays it again. */
export const INTRO_STORAGE_KEY = 'jaeng.intro';

function seenThisVisit(): boolean {
  try {
    if (sessionStorage.getItem(INTRO_STORAGE_KEY) === '1') return true;
    sessionStorage.setItem(INTRO_STORAGE_KEY, '1');
  } catch {
    // private mode: play it, it still goes by itself
  }
  return false;
}

/**
 * The opening (map surface brief, "Signature interaction"): a point of light rises into a beam, writes
 * "แจ้ง", the dawn gradient blooms and the view falls into the map. CSS keyframes only, on one
 * timeline; any tap or key skips it. Decorative: hidden from assistive tech and never focusable.
 */
@Component({
  selector: 'app-intro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, BackdropComponent],
  template: `
    @if (show()) {
      <div class="intro" aria-hidden="true" (click)="hide()">
        <app-backdrop />
        <div class="dawn"></div>
        <div class="beam"></div>
        <div class="dot"></div>
        <p class="word">{{ 'app.title' | t }}</p>
      </div>
    }
  `,
  styles: `
    .intro {
      position: fixed;
      z-index: 40000; /* over Ionic overlays and the update notice */
      inset: 0;
      overflow: hidden;
      background: var(--bg);
      cursor: pointer;
      animation: intro-out 400ms cubic-bezier(0.2, 0.8, 0.2, 1) 1400ms both;
    }
    /* 1000–1600 ms: the dawn blooms from the bottom-right */
    .dawn {
      position: absolute;
      inset: -20%;
      background:
        radial-gradient(55% 45% at 85% 95%, #f4b49a, transparent 70%),
        radial-gradient(45% 40% at 60% 100%, #c9a0dc, transparent 70%),
        radial-gradient(40% 35% at 100% 70%, #ffe3c4, transparent 70%);
      opacity: 0;
      transform-origin: 85% 95%;
      animation: intro-dawn 600ms cubic-bezier(0.2, 0.8, 0.2, 1) 1000ms both;
    }
    /* 0–400 ms: a point of light, 6 px growing to 14 px with a peach glow */
    .dot {
      position: absolute;
      left: 50%;
      top: 62%;
      width: 14px;
      height: 14px;
      margin: -7px 0 0 -7px;
      border-radius: 50%;
      background: #fff;
      box-shadow:
        0 0 0 1px rgba(244, 180, 154, 0.6),
        0 0 18px 6px rgba(244, 180, 154, 0.75),
        0 0 60px 18px rgba(244, 180, 154, 0.35);
      animation: intro-dot 400ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    /* 250–900 ms: the beam rises out of the point */
    .beam {
      position: absolute;
      left: 50%;
      bottom: 38%;
      width: 3px;
      height: 38vh;
      margin-left: -1.5px;
      border-radius: 2px;
      background: linear-gradient(to top, #fff, rgba(244, 180, 154, 0.9) 35%, transparent);
      transform-origin: 50% 100%;
      animation: intro-beam 650ms cubic-bezier(0.2, 0.8, 0.2, 1) 250ms both;
    }
    /* 700–1300 ms: the word is written from the bottom up as its letters close in */
    .word {
      position: absolute;
      left: 0;
      right: 0;
      top: 40%;
      margin: 0;
      color: var(--ink);
      font: 600 56px/1.3 var(--font);
      text-align: center;
      animation: intro-word 600ms cubic-bezier(0.2, 0.8, 0.2, 1) 700ms both;
    }
    @keyframes intro-dot {
      from {
        transform: scale(0.43);
        opacity: 0;
      }
    }
    @keyframes intro-beam {
      from {
        transform: scaleY(0);
      }
    }
    @keyframes intro-word {
      from {
        clip-path: inset(100% 0 0 0);
        letter-spacing: 0.3em;
      }
      to {
        clip-path: inset(0);
        letter-spacing: 0;
      }
    }
    @keyframes intro-dawn {
      to {
        opacity: 0.55;
        transform: scale(1.2);
      }
      from {
        opacity: 0;
        transform: scale(0.8);
      }
    }
    @keyframes intro-out {
      to {
        opacity: 0;
        transform: scale(1.06);
        filter: blur(10px);
      }
    }
  `,
  host: { '(document:keydown)': 'hide()', '(document:pointerdown)': 'hide()' },
})
export class IntroComponent {
  protected readonly show = signal(!seenThisVisit());

  constructor() {
    if (!this.show()) return;
    const timer = setTimeout(() => this.hide(), INTRO_MS);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }

  protected hide() {
    this.show.set(false);
  }
}
