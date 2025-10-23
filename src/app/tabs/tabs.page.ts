import { Component, EnvironmentInjector, inject } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonAlert } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { car, calendar, build, logOut } from 'ionicons/icons';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonAlert],
})
export class TabsPage {
  public environmentInjector = inject(EnvironmentInjector);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    addIcons({ car, calendar, build, logOut });
  }
  
  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
  
  isLogoutAlertOpen = false;
  logoutButtons = [
    { text: 'Cancelar', role: 'cancel' },
    { text: 'Cerrar Sesión', handler: () => this.logout() }
  ];
}
