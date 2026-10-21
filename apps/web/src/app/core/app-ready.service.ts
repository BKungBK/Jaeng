import { inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** The routes whose first sight is the map ("/", "/r/<id>"): the opening waits for the map to be drawn. */
const MAP_URL = /^\/(r\/[^/?#]+)?([?#].*)?$/;

/**
 * Whether the app is drawn and ready to be looked at: the opening screen (shared/intro.component.ts) stays up
 * until it is, so the map never shows half built. The map page reports its stages (`step`) and its end (`done`);
 * a first page that is not the map has nothing heavy to wait for.
 */
@Injectable({ providedIn: 'root' })
export class AppReadyService {
  /** 0 to 1, only ever up: the meter under the opening's name */
  readonly progress = signal(0);
  readonly ready = signal(false);

  constructor() {
    inject(Router)
      .events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        if (!MAP_URL.test(e.urlAfterRedirects)) setTimeout(() => this.done(), 250);
      });
  }

  step(share: number) {
    this.progress.update((p) => Math.max(p, Math.min(1, share)));
  }

  done() {
    this.progress.set(1);
    this.ready.set(true);
  }
}
