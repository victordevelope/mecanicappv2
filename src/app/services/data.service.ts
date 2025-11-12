import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { Vehicle } from '../models/vehicle.model';
import { Maintenance } from '../models/maintenance.model';
import { Reminder } from '../models/reminder.model';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private vehicles: Vehicle[] = [];
  private maintenances: Maintenance[] = [];
  private reminders: Reminder[] = [];
  
  private vehiclesSubject = new BehaviorSubject<Vehicle[]>([]);
  private maintenancesSubject = new BehaviorSubject<Maintenance[]>([]);
  private remindersSubject = new BehaviorSubject<Reminder[]>([]);
  
  private apiUrl = (window as any).__env?.apiUrl || environment.apiUrl;
  private isOnline = navigator.onLine;

  private http = inject(HttpClient);
  private authService = inject(AuthService);
  vehiclesBackendEmptySubject: any;

  constructor() {
    // Cargar datos del localStorage si existen
    this.loadData();
    
    // Escuchar cambios en el usuario autenticado
    this.authService.currentUser.subscribe(user => {
      if (user) {
        // Usuario ha iniciado sesión, cargar sus datos
        this.loadData();
        if (this.isOnline) {
          this.refreshVehicles();
          this.refreshMaintenances();
          this.refreshReminders();
        }
      } else {
        // Usuario ha cerrado sesión, limpiar datos
        this.clearData();
      }
    });
    
    // Escuchar cambios de conectividad
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncData();
      // Al recuperar conexión, refrescamos desde el backend
      this.refreshVehicles();
      this.refreshMaintenances();
      this.refreshReminders();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
    window.addEventListener('user-logout', () => {
      this.clearData();
    });
  }

  private getCurrentUserId(): string | undefined {
    return this.authService.currentUserValue?.id;
  }

  private loadData() {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    const storageKey = `vehicles_${userId}`;
    const maintenancesKey = `maintenances_${userId}`;
    const remindersKey = `reminders_${userId}`;

    const storedVehicles = localStorage.getItem(storageKey);
    const storedMaintenances = localStorage.getItem(maintenancesKey);
    const storedReminders = localStorage.getItem(remindersKey);

    if (storedVehicles) {
      this.vehicles = JSON.parse(storedVehicles);
      this.vehiclesSubject.next([...this.vehicles]);
    }
    if (storedMaintenances) {
      this.maintenances = JSON.parse(storedMaintenances);
      this.maintenancesSubject.next([...this.maintenances]);
    }
    if (storedReminders) {
      this.reminders = JSON.parse(storedReminders);
      this.remindersSubject.next([...this.reminders]);
    }
  }

  private saveData() {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    const storageKey = `vehicles_${userId}`;
    const maintenancesKey = `maintenances_${userId}`;
    const remindersKey = `reminders_${userId}`;

    localStorage.setItem(storageKey, JSON.stringify(this.vehicles));
    localStorage.setItem(maintenancesKey, JSON.stringify(this.maintenances));
    localStorage.setItem(remindersKey, JSON.stringify(this.reminders));
  }

  // Sincronizar datos con el servidor cuando hay conexión
  private syncData() {
    if (this.isOnline && this.authService.isLoggedIn()) {
      const userId = this.getCurrentUserId();
      if (!userId) return;

      // Sincronizar vehículos
      this.http.post(`${this.apiUrl}/sync/vehicles`, { vehicles: this.vehicles, userId })
        .subscribe({
          next: (response: any) => {
            if (response.vehicles) {
              this.vehicles = response.vehicles;
              this.vehiclesSubject.next([...this.vehicles]);
              this.saveData();
            }
          },
          error: error => console.error('Error al sincronizar vehículos:', error)
        });
      
      // Sincronizar mantenimientos
      this.http.post(`${this.apiUrl}/sync/maintenances`, { maintenances: this.maintenances, userId })
        .subscribe({
          next: (response: any) => {
            if (response.maintenances) {
              this.maintenances = response.maintenances;
              this.maintenancesSubject.next([...this.maintenances]);
              this.saveData();
            }
          },
          error: error => console.error('Error al sincronizar mantenimientos:', error)
        });
      
      // Sincronizar recordatorios
      this.http.post(`${this.apiUrl}/sync/reminders`, { reminders: this.reminders, userId })
        .subscribe({
          next: (response: any) => {
            if (response.reminders) {
              this.reminders = response.reminders;
              this.remindersSubject.next([...this.reminders]);
              this.saveData();
            }
          },
          error: error => console.error('Error al sincronizar recordatorios:', error)
        });
    }
  }

  // Métodos para vehículos
  getVehicles(incoming: Vehicle[], userId: string): Vehicle[] {
    return [...this.vehicles];
  }

  getVehiclesObservable(): Observable<Vehicle[]> {
    return this.vehiclesSubject.asObservable();
  }

  // Exponer evento de backend vacío para Tab1
  getVehiclesBackendEmptyObservable(): Observable<boolean> {
    return this.vehiclesBackendEmptySubject.asObservable();
  }

  getMaintenancesObservable(): Observable<Maintenance[]> {
    return this.maintenancesSubject.asObservable();
  }

  getRemindersObservable(): Observable<Reminder[]> {
    return this.remindersSubject.asObservable();
  }

  getVehicle(id: string): Vehicle | undefined {
    return this.vehicles.find(v => v.id === id);
  }

  addVehicle(vehicle: Vehicle): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    const tempId = Date.now().toString();
    vehicle.id = tempId;
    vehicle.userId = userId;

    this.vehicles.push(vehicle);
    this.vehiclesSubject.next([...this.vehicles]);
    this.saveData();

    const payload = {
      brand: vehicle.brand,
      model: vehicle.model,
      year: Number(vehicle.year) || null,
      plate: (vehicle as any).plate ?? (vehicle as any).licensePlate ?? ''
    };

    if (this.isOnline) {
      this.http.post(`${this.apiUrl}/vehicles`, payload)
        .subscribe({
          next: (saved: any) => {
            const serverId = saved?.id ?? saved?.vehicle?.id;
            if (serverId) {
              const idx = this.vehicles.findIndex(v => v.id === tempId);
              if (idx !== -1) {
                this.vehicles[idx].id = String(serverId);
                this.vehiclesSubject.next([...this.vehicles]);
                this.saveData();
              }
            }
          },
          error: error => console.error('Error al guardar vehículo en el servidor:', error)
        });
    }
  }

  updateVehicle(vehicle: Vehicle): void {
    const index = this.vehicles.findIndex(v => v.id === vehicle.id);
    if (index !== -1) {
      this.vehicles[index] = vehicle;
      this.vehiclesSubject.next([...this.vehicles]);
      this.saveData();
      
      if (this.isOnline) {
        this.http.put(`${this.apiUrl}/vehicles/${vehicle.id}`, vehicle)
          .subscribe({
            error: error => console.error('Error al actualizar vehículo en el servidor:', error)
          });
      }
    }
  }

  deleteVehicle(id: string): void {
    this.vehicles = this.vehicles.filter(v => v.id !== id);
    // También eliminar mantenimientos y recordatorios asociados
    this.maintenances = this.maintenances.filter(m => m.vehicleId !== id);
    this.reminders = this.reminders.filter(r => r.vehicleId !== id);
    
    this.vehiclesSubject.next([...this.vehicles]);
    this.maintenancesSubject.next([...this.maintenances]);
    this.remindersSubject.next([...this.reminders]);
    
    this.saveData();
    
    if (this.isOnline) {
      this.http.delete(`${this.apiUrl}/vehicles/${id}`)
        .subscribe({
          error: error => console.error('Error al eliminar vehículo en el servidor:', error)
        });
    }
  }

  // Métodos para mantenimientos
  getMaintenances(vehicleId?: string): Maintenance[] {
    if (vehicleId) {
      return this.maintenances.filter(m => m.vehicleId === vehicleId);
    }
    return [...this.maintenances];
  }

  addMaintenance(maintenance: Maintenance): void {
      const userId = this.getCurrentUserId();
      if (!userId) return;
  
      maintenance.id = Date.now().toString();
      maintenance.userId = userId;
      
      this.maintenances.push(maintenance);
      this.maintenancesSubject.next([...this.maintenances]);
      this.saveData();
  
      if (this.isOnline) {
          const payload = {
            vehicleId: maintenance.vehicleId,
            type: maintenance.type,
            description: (maintenance as any).description ?? '',
            cost: (maintenance as any).cost ?? 0,
            mileage: Number(maintenance.mileage) || 0,
            date: (maintenance as any).date ?? new Date().toISOString()
          };
  
          this.http.post(`${this.apiUrl}/maintenances`, payload)
            .subscribe({
              next: (saved: any) => {
                const serverId = saved?.maintenance?.id ?? saved?.id;
                if (serverId) {
                  const idx = this.maintenances.findIndex(m => m.id === maintenance.id);
                  if (idx !== -1) {
                    this.maintenances[idx].id = serverId.toString();
                    this.maintenancesSubject.next([...this.maintenances]);
                    this.saveData();
                  }
                }
              },
              error: error => console.error('Error al guardar mantenimiento en el servidor:', error)
            });
      }
  }
  updateMaintenance(maintenance: Maintenance): void {
      const index = this.maintenances.findIndex(m => m.id === maintenance.id);
      if (index !== -1) {
          this.maintenances[index] = maintenance;
          this.maintenancesSubject.next([...this.maintenances]);
          this.saveData();
  
          // Ajustar/crear recordatorio relacionado según el mantenimiento
          this.updateRelatedReminderForMaintenance(maintenance);
  
          if (this.isOnline) {
              this.http.put(`${this.apiUrl}/maintenances/${maintenance.id}`, maintenance)
                  .subscribe({
                      error: error => console.error('Error al actualizar mantenimiento en el servidor:', error)
                  });
          }
      }
  }

  deleteMaintenance(id: string): void {
    this.maintenances = this.maintenances.filter(m => m.id !== id);
    this.maintenancesSubject.next([...this.maintenances]);
    this.saveData();

    if (this.isOnline) {
      this.http.delete(`${this.apiUrl}/maintenances/${id}`)
        .subscribe({
          error: error => console.error('Error al eliminar mantenimiento en el servidor:', error)
        });
    }
  }

  // Métodos para recordatorios
  getReminders(vehicleId?: string): Reminder[] {
    if (vehicleId) {
      return this.reminders.filter(r => r.vehicleId === vehicleId);
    }
    return [...this.reminders];
  }

  addReminder(reminder: Reminder): void {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    reminder.id = Date.now().toString();
    reminder.userId = userId;
    
    this.reminders.push(reminder);
    this.remindersSubject.next([...this.reminders]);
    this.saveData();

    if (this.isOnline) {
      this.http.post(`${this.apiUrl}/reminders`, reminder)
        .subscribe({
          next: (saved: any) => {
            if (saved?.id) {
              const idx = this.reminders.findIndex(r => r.id === reminder.id);
              if (idx !== -1) {
                this.reminders[idx].id = saved.id.toString();
                this.remindersSubject.next([...this.reminders]);
                this.saveData();
              }
            }
          },
          error: error => console.error('Error al guardar recordatorio en el servidor:', error)
        });
    }
  }

  updateReminder(reminder: Reminder): void {
    const index = this.reminders.findIndex(r => r.id === reminder.id);
    if (index !== -1) {
      this.reminders[index] = reminder;
      this.remindersSubject.next([...this.reminders]);
      this.saveData();

      if (this.isOnline) {
        this.http.put(`${this.apiUrl}/reminders/${reminder.id}`, reminder)
          .subscribe({
            error: error => console.error('Error al actualizar recordatorio en el servidor:', error)
          });
      }
    }
  }

  deleteReminder(id: string): void {
    this.reminders = this.reminders.filter(r => r.id !== id);
    this.remindersSubject.next([...this.reminders]);
    this.saveData();

    if (this.isOnline) {
      this.http.delete(`${this.apiUrl}/reminders/${id}`)
        .subscribe({
          error: error => console.error('Error al eliminar recordatorio en el servidor:', error)
        });
    }
  }

  // Método para calcular días restantes para un recordatorio
  getDaysRemaining(dueDate: string): number {
    const target = new Date(dueDate);
    if (isNaN(target.getTime())) return 0;
    const now = new Date();
    const msInDay = 1000 * 60 * 60 * 24;
    return Math.floor((target.getTime() - now.getTime()) / msInDay);
  }

  // Método para limpiar datos al cerrar sesión
  clearData(): void {
    this.vehicles = [];
    this.maintenances = [];
    this.reminders = [];
    this.vehiclesSubject.next([]);
    this.maintenancesSubject.next([]);
    this.remindersSubject.next([]);
  }

  private updateRelatedReminderForMaintenance(maintenance: Maintenance): void {
    // Solo aplicar reglas automáticas para "Cambio de Aceite"
    if (maintenance.type !== 'Cambio de Aceite') {
      return;
    }

    const nextDate = new Date(maintenance.date);
    if (!isNaN(nextDate.getTime())) {
      nextDate.setMonth(nextDate.getMonth() + 6);
    }
    const nextMileage = maintenance.mileage + 5000;

    // Buscar un recordatorio activo del mismo vehículo y tipo
    const reminderIdx = this.reminders.findIndex(r =>
      r.vehicleId === maintenance.vehicleId &&
      r.maintenanceType === 'Cambio de Aceite' &&
      r.isActive
    );

    if (reminderIdx !== -1) {
      const updated: Reminder = {
        ...this.reminders[reminderIdx],
        dueDate: nextDate.toISOString(),
        mileage: nextMileage
      };
      this.updateReminder(updated);
    } else {
      // No existe recordatorio activo, crear uno nuevo
      this.addReminder({
        vehicleId: maintenance.vehicleId,
        maintenanceType: 'Cambio de Aceite',
        dueDate: nextDate.toISOString(),
        mileage: nextMileage,
        isActive: true
      });
    }
  }

  // Cargar vehículos desde el backend para alinear IDs y datos
  refreshVehicles(): void {
    const userId = this.getCurrentUserId();
    if (!userId || !this.isOnline) {
      return;
    }

    this.http.get<Vehicle[]>(`${this.apiUrl}/vehicles`)
      .pipe(
        catchError(error => {
          console.error('Error al obtener vehículos:', error);
          return of(null);
        })
      )
      .subscribe(vehicles => {
        if (!vehicles) return;

        const incoming = vehicles.filter(v => String(v.userId) === String(userId));
        if (incoming.length === 0) {
          // Avisar que el backend devolvió vacío; mantener lista local si existe
          this.vehiclesBackendEmptySubject.next(true);
          if (this.vehicles.length > 0) {
            return;
          }
        } else {
          this.vehiclesBackendEmptySubject.next(false);
        }

        const merged = this.getVehicles(incoming, userId);
        this.vehicles = merged;
        this.vehiclesSubject.next([...this.vehicles]);
        this.saveData();
      });
  }

  // Cargar mantenimientos desde el backend para alinear datos
  refreshMaintenances(): void {
    const userId = this.getCurrentUserId();
    if (!userId || !this.isOnline) {
      return;
    }

    this.http.get<Maintenance[]>(`${this.apiUrl}/maintenances`)
      .pipe(
        catchError(error => {
          console.error('Error al obtener mantenimientos:', error);
          return of(null);
        })
      )
      .subscribe(maintenances => {
        if (!maintenances) {
          return;
        }
        const incoming = maintenances.filter(m => m.userId === userId);
        if (incoming.length === 0 && this.maintenances.length > 0) {
          return;
        }

        this.maintenances = incoming;
        this.maintenancesSubject.next([...this.maintenances]);
        this.saveData();
      });
  }

  // Cargar recordatorios desde el backend para alinear datos
  refreshReminders(): void {
    const userId = this.getCurrentUserId();
    if (!userId || !this.isOnline) {
      return;
    }

    this.http.get<Reminder[]>(`${this.apiUrl}/reminders`)
      .pipe(
        catchError(error => {
          console.error('Error al obtener recordatorios:', error);
          return of(null);
        })
      )
      .subscribe(reminders => {
        if (!reminders) {
          return;
        }

        const incoming = reminders.filter(r => r.userId === userId);
        if (incoming.length === 0 && this.reminders.length > 0) {
          return;
        }

        this.reminders = incoming;
        this.remindersSubject.next([...this.reminders]);
        this.saveData();
      });
  }
}