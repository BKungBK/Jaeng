import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/map/map.page').then((m) => m.MapPage),
  },
  { path: '**', redirectTo: '' },
];
