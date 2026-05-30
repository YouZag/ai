import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'planning', pathMatch: 'full' },
  {
    path: 'planning',
    loadComponent: () => import('./planning/planning').then((m) => m.PlanningComponent),
  },
  {
    path: 'vision',
    loadComponent: () => import('./vision/vision').then((m) => m.VisionComponent),
  },
  {
    path: 'features',
    loadComponent: () => import('./features/features').then((m) => m.FeaturesComponent),
  },
  {
    path: 'pipeline',
    loadComponent: () => import('./pipeline/pipeline').then((m) => m.PipelineComponent),
  },
  {
    path: 'tasks',
    loadComponent: () => import('./tasks/tasks').then((m) => m.TasksComponent),
  },
  {
    path: 'agents',
    loadComponent: () => import('./agents/agents').then((m) => m.AgentsComponent),
  },
];
