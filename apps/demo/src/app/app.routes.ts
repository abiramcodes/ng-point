import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login-page').then((m) => m.LoginPage),
    title: 'Login | ng-point demo',
  },
  {
    path: 'orders',
    loadComponent: () => import('./pages/orders-page').then((m) => m.OrdersPage),
    title: 'Orders | ng-point demo',
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings-page').then((m) => m.SettingsPage),
    title: 'Settings | ng-point demo',
  },
];
