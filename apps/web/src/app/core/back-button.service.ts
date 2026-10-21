import { inject, Injectable, InjectionToken } from '@angular/core';
import { App } from '@capacitor/app';
import { Platform } from '@ionic/angular';
import { platform } from './platform';

/** Closes the APK. A token, because `App` is a plugin proxy that specs must not touch. */
export const EXIT_APP = new InjectionToken<() => void>('Exit the app', {
  providedIn: 'root',
  factory: () => () => void App.exitApp(),
});

/** What a back handler gets: call it to let the next handler (a lower priority) have the button. */
export type BackHandler = (next: () => void) => void;

/** Priorities of Ionic's own handlers: overlays (sheets, popovers, alerts) 100, menus 99, the router 0. */
export const BACK_PRIORITY = { page: 50, panel: 10, exit: -1 } as const;

/**
 * The Android back button (plan 7). Ionic already closes overlays and pops the router; the app adds
 * what it alone knows: the `/report` steps, the wide detail panel, and leaving at the map.
 */
@Injectable({ providedIn: 'root' })
export class BackButtonService {
  private ionic = inject(Platform);
  private exitApp = inject(EXIT_APP);

  /** Gives `handler` the button at `priority`; the returned function takes it back. */
  on(priority: number, handler: BackHandler): () => void {
    const subscription = this.ionic.backButton.subscribeWithPriority(priority, handler);
    return () => subscription.unsubscribe();
  }

  /** Back with nothing left to pop leaves the app (Ionic only does that by itself when told to). */
  startExitOnRoot(outlet: { canGoBack(): boolean }): void {
    if (!platform.isNative()) return;
    this.on(BACK_PRIORITY.exit, () => {
      if (!outlet.canGoBack()) this.exitApp();
    });
  }
}
