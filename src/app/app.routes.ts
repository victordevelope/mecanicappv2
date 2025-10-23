import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { routes as tabsRoutes } from './tabs/tabs.routes';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then(m => m.LoginPage)
  },
  tabsRoutes[0] // Import the tabs routes configuration
];
