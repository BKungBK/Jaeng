import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router';
import { inject, isDevMode, provideAppInitializer } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideIonicAngular } from '@ionic/angular';

import { routes } from './app/app.routes';
import { AppRouteStrategy } from './app/core/route-strategy';
import { platform } from './app/core/platform';
import { ServerConfigService } from './app/core/server-config.service';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: AppRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    // the APK reads its saved server address before the first request
    provideAppInitializer(() => inject(ServerConfigService).init()),
    // production builds only (the PWA on :8100); the dev server never registers a worker, nor does the APK
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && !platform.isNative(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
});
