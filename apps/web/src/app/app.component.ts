import { afterNextRender, Component, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { AppUpdateService } from './core/app-update.service';
import { BackButtonService } from './core/back-button.service';
import { CategoriesService } from './core/categories.service';
import { I18nService } from './core/i18n.service';
import { ServerConfigService } from './core/server-config.service';
import { ThemeService } from './core/theme.service';
import { glassNav } from './core/motion';
import { TPipe } from './i18n/t.pipe';
import { ProfileSetupService } from './features/auth/profile-setup.service';
import { IconComponent } from './shared/icon.component';
import { IntroComponent } from './shared/intro.component';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrl: 'app.component.scss',
  imports: [IonApp, IonRouterOutlet, TPipe, IntroComponent, IconComponent],
})
export class AppComponent {
  protected readonly update = inject(AppUpdateService);
  /** every page change: the new page rises out of a blur (core/motion.ts) */
  protected readonly glassNav = glassNav;

  private outlet = viewChild(IonRouterOutlet);

  constructor() {
    // the Android back button leaves the app once the router has nothing to pop (a no-op on the web)
    const back = inject(BackButtonService);
    afterNextRender(() => {
      const outlet = this.outlet();
      if (outlet) back.startExitOnRoot(outlet);
    });
    // created at boot so <html lang>, the title and the theme are right from the first paint
    inject(I18nService);
    inject(ThemeService);
    // a signed-in member who has not set up their profile gets the profile sheet, whatever page they are on
    inject(ProfileSetupService);
    // category names in both languages, for the panel's tag and the report flow (a failure retries on use)
    inject(CategoriesService)
      .list()
      .catch(() => undefined);
    // the APK cannot reach its server (wrong IP, computer off): say so on the settings page, not an empty map
    const router = inject(Router);
    void inject(ServerConfigService)
      .startupProblem()
      .then((reason) => {
        if (reason && !router.url.startsWith('/server')) void router.navigate(['/server'], { queryParams: { reason }, replaceUrl: true });
      });
  }
}
