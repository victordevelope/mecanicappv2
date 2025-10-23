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

  constructor(private dataService: DataService) {
    addIcons({ add, car });
  }

  ngOnInit() {
    this.loadVehicles();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  loadVehicles() {
    // Usar observable para actualizaciones automáticas
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

  saveVehicle() {
    if (this.validateForm()) {
      this.dataService.addVehicle({ ...this.newVehicle });
      this.loadVehicles();
      this.closeModal();
    }
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
}
