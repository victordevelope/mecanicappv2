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
    // Si estamos en entorno híbrido (Android/iOS), usar Capacitor
    if (this.platform.is('hybrid')) {
      PushNotifications.checkPermissions().then(result => {
        if (result.receive !== 'granted') {
          return PushNotifications.requestPermissions();
        }
        return result;
      }).then(() => {
        PushNotifications.register();
      });

      PushNotifications.addListener('registration', token => {
        console.log('Token push (nativo):', token.value);
        // Envía el token al backend si quieres enviar notificaciones dirigidas
      });

      PushNotifications.addListener('registrationError', err => {
        console.error('Error en registro de push (nativo):', err);
      });

      PushNotifications.addListener('pushNotificationReceived', notification => {
        console.log('Push recibido (nativo):', notification);
      });
      return;
    }

    // Web: usar Firebase Cloud Messaging
    // En web, no llames automáticamente: hazlo bajo demanda:
    // await this.requestPermissionAndSubscribe();
    }

    // Llama esto desde un botón “Activar notificaciones”
    async initMessagingAfterInteraction() {
      await this.requestPermissionAndSubscribe();
    }
  private async showLocalNotification(title: string, body: string) {
    // Web: usar Notification API
    try {
      new Notification(title, {
        body,
        icon: '/assets/icon/icon-192x192.png'
      });
    } catch (e) {
      console.warn('No se pudo mostrar Notification API, fallback en UI:', e);
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

  // Solicita permiso y suscribe el cliente a FCM en Web
  async requestPermissionAndSubscribe() {
    if (!('Notification' in window)) {
      console.warn('Notifications API no disponible en este navegador.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Permiso de notificaciones denegado.');
      return;
    }

    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });

    try {
      const { getToken, onMessage } = await import('@angular/fire/messaging');
      const { getMessaging } = await import('firebase/messaging');
      const vapidKey = 'BHvu9Tflin6L_Db5ghC-L3_GiT9W6R8Un8dnHKsb3oStxEPYS7ym3xSGFxJbZN4kKFA7jc9THTBVo8ALA_OB55o';

      const messaging = getMessaging();
      const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
      console.log('Token FCM (web):', token);

      const userId = this.dataService.getCurrentUserId();
      if (token && userId) {
        this.registerDevice(token, userId).subscribe({
          next: () => console.log('Dispositivo registrado para notificaciones web.'),
          error: (err) => console.error('Error registrando dispositivo:', err)
        });
      }

      onMessage(messaging, (payload: any) => {
        const title = payload?.notification?.title || 'MecanicApp';
        const body = payload?.notification?.body || 'Tienes un nuevo recordatorio';
        this.showLocalNotification(title, body);
      });
    } catch (err) {
      console.error('Error obteniendo token FCM (web):', err);
    }
  }
}