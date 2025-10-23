import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PushNotifications } from '@capacitor/push-notifications';
import { Platform } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { DataService } from './data.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = (window as any).__env?.apiUrl || environment.apiUrl;
  
  private http = inject(HttpClient);
  private platform = inject(Platform);
  private router = inject(Router);
  private dataService = inject(DataService);

  async initPushNotifications() {
    if (!this.platform.is('capacitor')) {
      console.log('Push notifications solo funcionan en dispositivos nativos');
      return;
    }

    // Solicitar permiso para notificaciones
    const result = await PushNotifications.requestPermissions();
    if (result.receive === 'granted') {
      // Registrar para recibir notificaciones push
      await PushNotifications.register();

      // Escuchar por notificaciones recibidas
      PushNotifications.addListener('pushNotificationReceived', notification => {
        console.log('Notificación recibida: ', notification);
        // Aquí puedes mostrar una notificación local o actualizar la UI
      });

      // Escuchar por notificaciones cuando la app está en segundo plano
      PushNotifications.addListener('pushNotificationActionPerformed', notification => {
        console.log('Acción realizada en notificación: ', notification);
        // Navegar a la página correspondiente según el tipo de notificación
        if (notification.notification.data.page) {
          this.router.navigate([notification.notification.data.page]);
        }
      });
    }
  }

  // Registrar el token del dispositivo en el servidor
  registerDevice(token: string, userId: string) {
    return this.http.post(`${this.apiUrl}/notifications/register-device`, { token, userId });
  }

  // Programar notificaciones locales para recordatorios
  scheduleReminderNotifications() {
    const reminders = this.dataService.getReminders().filter(r => r.isActive);
    
    // Para cada recordatorio activo, programar una notificación
    reminders.forEach(reminder => {
      const daysRemaining = this.dataService.getDaysRemaining(reminder.dueDate);
      
      // Si faltan menos de 7 días, programar notificación
      if (daysRemaining <= 7 && daysRemaining >= 0) {
        this.scheduleLocalNotification(
          `Recordatorio: ${reminder.maintenanceType}`,
          `Faltan ${daysRemaining} días para el mantenimiento programado`,
          reminder.id!
        );
      }
    });
  }

  // Programar una notificación local
  private async scheduleLocalNotification(title: string, body: string, id: string) {
    // Implementación específica para notificaciones locales
    // Esto dependerá de la plataforma y plugins utilizados
  }
}