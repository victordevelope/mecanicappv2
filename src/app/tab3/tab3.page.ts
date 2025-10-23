import { Component, OnInit, OnDestroy } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonIcon, IonLabel, IonItemSliding, IonItemOptions, IonItemOption, IonBadge } from '@ionic/angular/standalone';
import { ExploreContainerComponent } from '../explore-container/explore-container.component';
import { addIcons } from 'ionicons';
import { alertCircle, calendar, checkmarkCircle } from 'ionicons/icons';
import { DataService } from '../services/data.service';
import { Reminder } from '../models/reminder.model';
import { Vehicle } from '../models/vehicle.model';
import { Subscription } from 'rxjs';
import { IonModal, IonButton, IonInput, IonDatetime } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, 
    IonIcon, IonLabel, IonItemSliding, IonItemOptions, IonItemOption,
    IonModal, IonButton, IonInput, IonDatetime, FormsModule
  ],
  standalone: true,
})
export class Tab3Page implements OnInit, OnDestroy {
  reminders: Reminder[] = [];
  vehicles: Vehicle[] = [];
  private subscription = new Subscription();

  isEditModalOpen = false;
  editReminder: Reminder | null = null;
  editMaintenanceType = '';
  editDueDate = '';
  editMileage?: number;

  constructor(private dataService: DataService) {
    addIcons({ alertCircle, calendar, checkmarkCircle });
    // this.loadData();
  }

  loadData() {
    this.vehicles = this.dataService.getVehicles();
    this.reminders = this.dataService.getReminders().filter(r => r.isActive);
    
    // Ordenar por fecha más próxima
    this.reminders.sort((a, b) => {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }

  getVehicleName(vehicleId: string): string {
    const vehicle = this.vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Vehículo desconocido';
  }

  getDaysRemaining(dueDate: string): number {
    return this.dataService.getDaysRemaining(dueDate);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '' : date.toLocaleDateString();
  }

  getStatusColor(daysRemaining: number): string {
    if (daysRemaining > 7) return 'medium';  // lejano
    if (daysRemaining > 0) return 'warning'; // pronto
    if (daysRemaining === 0) return 'primary'; // hoy
    return 'danger'; // atrasado
  }



 

  markAsCompleted(reminder: Reminder) {
    // Marcar como completado (desactivar)
    reminder.isActive = false;
    this.dataService.updateReminder(reminder);
    
    // Crear un nuevo recordatorio para el próximo mantenimiento
    if (reminder.maintenanceType === 'Cambio de Aceite') {
      const dueDate = new Date(reminder.dueDate);
      dueDate.setMonth(dueDate.getMonth() + 6); // Próximo cambio en 6 meses
      
      this.dataService.addReminder({
        vehicleId: reminder.vehicleId,
        maintenanceType: reminder.maintenanceType,
        dueDate: dueDate.toISOString(),
        mileage: reminder.mileage ? reminder.mileage + 5000 : undefined, // +5000 km
        isActive: true
      });
    }
    
    this.loadData();
  }

  deleteReminder(id: string) {
    this.dataService.deleteReminder(id);
    this.loadData();
  }

  ionViewWillEnter() {
    // Refrescar en cada entrada al tab para evitar datos viejos
    this.dataService.refreshVehicles();
    this.dataService.refreshReminders();
  }

  ngOnInit() {
    this.subscription.add(
      this.dataService.getVehiclesObservable().subscribe(vehicles => {
        this.vehicles = vehicles;
      })
    );

    this.subscription.add(
      this.dataService.getRemindersObservable().subscribe(reminders => {
        this.reminders = reminders
          .filter(r => r.isActive)
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      })
    );

    // Cargar del backend si hay conexión
    this.dataService.refreshReminders();
  }

  openEdit(reminder: Reminder) {
    this.editReminder = { ...reminder };
    this.editMaintenanceType = reminder.maintenanceType;
    this.editDueDate = reminder.dueDate;
    this.editMileage = reminder.mileage;
    this.isEditModalOpen = true;
  }

  closeEdit() {
    this.isEditModalOpen = false;
    this.editReminder = null;
  }

  saveEdit() {
    if (!this.editReminder) return;

    const updated: Reminder = {
      ...this.editReminder,
      maintenanceType: this.editMaintenanceType,
      dueDate: this.editDueDate,
      mileage: this.editMileage
    };

    this.dataService.updateReminder(updated);
    this.closeEdit();
  }


  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
