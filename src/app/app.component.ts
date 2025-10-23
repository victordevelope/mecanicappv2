import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { NotificationService } from './services/notification.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  constructor(
    private notificationService: NotificationService,
    private authService: AuthService,
    private router: Router
  ) {
    // Simplemente verificamos si hay un usuario logueado
    if (!this.authService.isLoggedIn()) {
      this.authService.logout();
    }
  }

  ngOnInit() {
    // Inicializar notificaciones push
    this.notificationService.initPushNotifications();
    
    // Verificar si el usuario está autenticado
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
    }
  }
}
