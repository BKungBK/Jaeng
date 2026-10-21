import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { AppUpdateService } from './core/app-update.service';
import { CategoriesService } from './core/categories.service';
import { I18nService } from './core/i18n.service';
import { ThemeService } from './core/theme.service';
import { glassNav } from './core/motion';
import { TPipe } from './i18n/t.pipe';
import { IntroComponent } from './shared/intro.component';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrl: 'app.component.scss',
  imports: [IonApp, IonRouterOutlet, TPipe, IntroComponent],
})
export class AppComponent {
  protected readonly update = inject(AppUpdateService);
  /** every page change: the new page rises out of a blur (core/motion.ts) */
  protected readonly glassNav = glassNav;

  constructor() {
    // created at boot so <html lang>, the title and the theme are right from the first paint
    inject(I18nService);
    inject(ThemeService);
    // category names in both languages, for the panel's tag and the report flow (a failure retries on use)
    inject(CategoriesService)
      .list()
      .catch(() => undefined);
  }
}
