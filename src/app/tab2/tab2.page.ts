import { Component } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonFab, IonFabButton, IonIcon,
  IonList, IonItem, IonLabel, IonItemSliding, IonItemOptions, IonItemOption,
  IonModal, IonButton, IonInput, IonSelect, IonSelectOption, IonTextarea, IonButtons
} from '@ionic/angular/standalone';
import { ExploreContainerComponent } from '../explore-container/explore-container.component';
import { addIcons } from 'ionicons';
import { add, build } from 'ionicons/icons';
import { DataService } from '../services/data.service';
import { Maintenance } from '../models/maintenance.model';
import { Vehicle } from '../models/vehicle.model';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonFab, IonFabButton,
    IonIcon, IonList, IonItem, IonLabel, IonItemSliding, IonItemOptions,
    IonItemOption, IonModal, IonButton, IonInput, IonSelect, IonSelectOption,
    IonTextarea, FormsModule, IonButtons
  ],
  standalone: true,
})
export class Tab2Page {
  isAlertOpen = false;
  alertButtons = ['Action'];
  maintenances: Maintenance[] = [];
  vehicles: Vehicle[] = [];
  isModalOpen = false;
  isEditModalOpen = false;
  editMaintenance: Maintenance | null = null;
  
  newMaintenance: Maintenance = {
    vehicleId: '',
    type: '',
    date: new Date().toISOString(),
    mileage: 0,
    notes: '',
    cost: 0
  };

  maintenanceTypes = [
    'Cambio de Aceite',
    'Cambio de Filtros',
    'Cambio de Frenos',
    'Alineación y Balanceo',
    'Cambio de Batería',
    'Cambio de Llantas',
    'Revisión General',
    'Otro'
  ];
  private subscription = new Subscription();

  constructor(private dataService: DataService) {
    addIcons({ add, build });
    this.loadData();
  }

  ngOnInit() {
    this.subscription.add(
      this.dataService.getVehiclesObservable().subscribe(vehicles => {
        this.vehicles = vehicles;
      })
    );

    this.subscription.add(
      this.dataService.getMaintenancesObservable().subscribe(maintenances => {
        this.maintenances = [...maintenances].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      })
    );
  }

  ionViewWillEnter() {
    this.dataService.refreshVehicles();
    this.dataService.refreshMaintenances();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
  loadData() {
    this.vehicles = this.dataService.getVehicles();
    this.maintenances = this.dataService.getMaintenances();
    
    // Ordenar por fecha más reciente
    this.maintenances.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }

  getVehicleName(vehicleId: string): string {
    const vehicle = this.vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Vehículo desconocido';
  }

  openModal() {
    if (this.vehicles.length === 0) {
      alert('Debes agregar al menos un vehículo primero');
      return;
    }
    
    this.isModalOpen = true;
    this.resetForm();
  }

  closeModal() {
    this.isModalOpen = false;
  }

  resetForm() {
    this.newMaintenance = {
      vehicleId: this.vehicles.length > 0 ? this.vehicles[0].id! : '',
      type: this.maintenanceTypes[0],
      date: new Date().toISOString(),
      mileage: 0,
      notes: '',
      cost: 0
    };
  }

  saveMaintenance() {
    if (this.validateForm()) {
      this.dataService.addMaintenance({...this.newMaintenance});
      
      // Crear recordatorio automático para cambio de aceite (cada 5000 km o 6 meses)
      if (this.newMaintenance.type === 'Cambio de Aceite') {
        const dueDate = new Date(this.newMaintenance.date);
        dueDate.setMonth(dueDate.getMonth() + 6);
        
        this.dataService.addReminder({
          vehicleId: this.newMaintenance.vehicleId,
          maintenanceType: 'Cambio de Aceite',
          dueDate: dueDate.toISOString(),
          mileage: this.newMaintenance.mileage + 5000,
          isActive: true
        });
      }
      
      this.loadData();
      this.closeModal();
    }
  }

  validateForm(): boolean {
    return this.newMaintenance.vehicleId !== '' && 
           this.newMaintenance.type !== '' && 
           this.newMaintenance.mileage > 0;
  }

  deleteMaintenance(id: string) {
    this.dataService.deleteMaintenance(id);
    this.loadData();
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }

  setOpen(isOpen: boolean) {
    this.isAlertOpen = isOpen;
  }

  openEditMaintenance(maintenance: Maintenance) {
    this.editMaintenance = { ...maintenance };
    this.isEditModalOpen = true;
  }

  closeEditMaintenance() {
    this.isEditModalOpen = false;
    this.editMaintenance = null;
  }

  saveEditMaintenance() {
    if (!this.editMaintenance) return;

    this.dataService.updateMaintenance(this.editMaintenance);
    this.loadData();
    this.closeEditMaintenance();
  }
}
