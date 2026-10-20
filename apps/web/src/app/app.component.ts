import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { AppUpdateService } from './core/app-update.service';
import { CategoriesService } from './core/categories.service';
import { I18nService } from './core/i18n.service';
import { ThemeService } from './core/theme.service';
import { TPipe } from './i18n/t.pipe';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrl: 'app.component.scss',
  imports: [IonApp, IonRouterOutlet, TPipe],
})
export class AppComponent {
  protected readonly update = inject(AppUpdateService);

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
