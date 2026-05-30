import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'vision', pathMatch: 'full' },
  {
    path: 'vision',
    loadComponent: () => import('./vision/vision').then((m) => m.VisionComponent),
  },
  {
    path: 'features',
    loadComponent: () => import('./features/features').then((m) => m.FeaturesComponent),
  },
];
