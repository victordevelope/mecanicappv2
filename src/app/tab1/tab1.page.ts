import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonFab,
  IonFabButton,
  IonIcon,
  IonModal,
  IonButton,
  IonInput,
  IonButtons
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, car } from 'ionicons/icons';
import { ExploreContainerComponent } from '../explore-container/explore-container.component';
import { DataService } from '../services/data.service';
import { Vehicle } from '../models/vehicle.model';
import { FormsModule } from '@angular/forms';
import { IonSearchbar } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonFab,
    IonFabButton,
    IonIcon,
    IonModal,
    IonButton,
    IonInput,
    IonButtons,
    FormsModule,
    IonSearchbar
  ],
  standalone: true,
})
export class Tab1Page implements OnInit, OnDestroy {
  vehicles: Vehicle[] = [];
  filteredVehicles: Vehicle[] = [];
  searchTerm: string = '';
  isModalOpen = false;
  private subscription: Subscription = new Subscription();
  isEditModalOpen = false;
  editVehicle: Vehicle | null = null;

  newVehicle: Vehicle = {
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    plate: '',
  };

  constructor(private dataService: DataService, private authService: AuthService, private toastCtrl: ToastController) {
    addIcons({ add, car });
  }

  ngOnInit() {
    this.loadVehicles();

    // Avisar si el backend devuelve vacío y se mantiene la lista local
    this.subscription.add(
      this.dataService.getVehiclesBackendEmptyObservable().subscribe(isEmpty => {
        if (isEmpty) {
          this.showToast('El servidor no devolvió vehículos; manteniendo lista local.', 'warning');
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  loadVehicles() {
    // Usar observable para actualizaciones automáticas
    // Esto se activa tanto por refreshVehicles() como por la actualización interna en addVehicle()
    this.subscription.add(
      this.dataService.getVehiclesObservable().subscribe(vehicles => {
        this.vehicles = vehicles;
        this.filterVehicles();
      })
    );
  }

  filterVehicles() {
    if (!this.searchTerm) {
      this.filteredVehicles = [...this.vehicles];
      return;
    }
    
    const searchTermLower = this.searchTerm.toLowerCase();
    this.filteredVehicles = this.vehicles.filter(vehicle => 
      vehicle.brand.toLowerCase().includes(searchTermLower) || 
      vehicle.model.toLowerCase().includes(searchTermLower) || 
      vehicle.plate.toLowerCase().includes(searchTermLower)
    );
  }

  openModal() {
    this.isModalOpen = true;
    this.resetForm();
  }

  closeModal() {
    this.isModalOpen = false;
  }

  resetForm() {
    this.newVehicle = {
      brand: '',
      model: '',
      year: new Date().getFullYear(),
      plate: '',
    };
  }

  // 🚀 CORRECCIÓN 3: Manejar la respuesta asíncrona (Observable)
  saveVehicle() {
    if (!this.validateForm()) {
      this.showToast('Completa marca, modelo y placa.', 'danger');
      return;
    }

    // Validar sesión con id de usuario
    const userId = this.authService.currentUserValue?.id;
    if (!userId || userId.trim() === '') {
      this.showToast('Sesión inválida. Inicia sesión nuevamente.', 'danger');
      return;
    }

    // Llamamos al servicio y nos suscribimos para esperar la respuesta
    this.dataService.addVehicle({ ...this.newVehicle }).subscribe({
      next: (response) => {
        // Se ejecuta cuando el backend (o el manejo offline) finaliza con éxito
        this.showToast('Vehículo registrado con éxito.', 'success');
        this.loadVehicles(); // Opcional, el Observable ya notifica, pero es seguro mantenerlo
        this.closeModal();
      },
      error: (err) => {
        // Se ejecuta si hay un error en la llamada HTTP
        console.error('Error al registrar vehículo:', err);
        const errorMessage = err.error?.message || 'Error al conectar con el servidor. Intenta de nuevo.';
        this.showToast(errorMessage, 'danger');
      }
    });
  }

  validateForm(): boolean {
    return (
      this.newVehicle.brand.trim() !== '' &&
      this.newVehicle.model.trim() !== '' &&
      this.newVehicle.plate.trim() !== ''
    );
  }

  openEditVehicle(vehicle: Vehicle) {
    this.editVehicle = { ...vehicle };
    this.isEditModalOpen = true;
  }

  closeEditVehicle() {
    this.isEditModalOpen = false;
    this.editVehicle = null;
  }

  deleteVehicle(id: string) {
    this.dataService.deleteVehicle(id);
    this.loadVehicles();
  }

  saveEditVehicle() {
    if (!this.editVehicle) return;
    this.dataService.updateVehicle(this.editVehicle);
    this.closeEditVehicle();
  }

  private async showToast(message: string, color: 'danger' | 'warning' | 'success' = 'warning') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}