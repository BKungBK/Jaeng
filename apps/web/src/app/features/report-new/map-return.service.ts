import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';

/**
 * Leaves `/report` for the home map. The map page is still in Ionic's stack under this page, so going
 * back to it keeps its MapLibre map (and WebGL context); a plain forward navigation to a URL the stack
 * does not hold would build a second map page. A target such as `/r/:id` is opened afterwards on that
 * same page, which swaps the route in place.
 */
@Injectable({ providedIn: 'root' })
export class MapReturnService {
  private nav = inject(NavController);
  private router = inject(Router);

  async go(target?: string[], toast?: string): Promise<void> {
    const popped = await this.nav.pop();
    if (!popped) await this.router.navigate(['/'], { replaceUrl: true }); // /report was opened directly
    if (target) await this.router.navigate(target, toast ? { state: { toast } } : {});
  }
}
