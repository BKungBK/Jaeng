import { ActivatedRouteSnapshot } from '@angular/router';
import { IonicRouteStrategy } from '@ionic/angular';

/** `/` and `/r/:id` are one MapPage. IonicRouteStrategy would rebuild it when the params differ,
 *  which means a second MapLibre map and a second WebGL context. */
export class AppRouteStrategy extends IonicRouteStrategy {
  override shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    const config = future.routeConfig;
    if (config && config === curr.routeConfig && config.data?.['reuse'] === 'map') return true;
    return super.shouldReuseRoute(future, curr);
  }
}
