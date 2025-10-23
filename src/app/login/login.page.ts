import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonItem, 
  IonLabel, IonInput, IonButton, IonCard, IonCardContent,
  IonCardHeader, IonCardTitle, IonAlert, IonLoading, IonIcon
} from '@ionic/angular/standalone';
import { AuthService } from '../services/auth.service';
import { User } from '../models/user.model';
import { addIcons } from 'ionicons';
import { logoGoogle } from 'ionicons/icons';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    FormsModule,
    NgIf,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonAlert,
    IonLoading,
    IonIcon
  ]
})
export class LoginPage {
  username: string = '';
  password: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';
  showRegister: boolean = false;
  
  // Datos para el registro
  newUser: User = {
    username: '',
    email: '',
    password: ''
  };
  confirmPassword: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    addIcons({ logoGoogle });
  }

  login() {
    this.isLoading = true;
    this.errorMessage = '';

    if (!this.username || !this.password) {
      this.errorMessage = 'Por favor ingresa usuario y contraseña';
      this.isLoading = false;
      return;
    }

    this.authService.login(this.username, this.password)
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.router.navigate(['/tabs/tab1']);
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = 'Usuario o contraseña incorrectos';
          console.error('Error de login:', error);
        }
      });
  }
  
  register() {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Validaciones básicas
    if (!this.newUser.username || !this.newUser.email || !this.newUser.password) {
      this.errorMessage = 'Por favor completa todos los campos';
      this.isLoading = false;
      return;
    }
    
    if (this.newUser.password !== this.confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden';
      this.isLoading = false;
      return;
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.newUser.email)) {
      this.errorMessage = 'Por favor ingresa un correo electrónico válido';
      this.isLoading = false;
      return;
    }
    
    this.authService.register(this.newUser)
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.errorMessage = '';
          // Mostrar mensaje de éxito y redirigir al login
          alert('Cuenta creada exitosamente. Por favor inicia sesión.');
          this.showRegister = false;
          this.username = this.newUser.username;
          this.password = '';
          // Limpiar formulario de registro
          this.newUser = {
            username: '',
            email: '',
            password: ''
          };
          this.confirmPassword = '';
        },
        error: (error) => {
          this.isLoading = false;
          this.errorMessage = error.error?.message || 'Error al crear la cuenta. Intenta nuevamente.';
          console.error('Error de registro:', error);
        }
      });
  }
  
  loginWithGoogle() {
    this.isLoading = true;
    this.authService.loginWithGoogle()
      .then(() => {
        this.isLoading = false;
        this.router.navigate(['/tabs']);
      })
      .catch((error: any) => {
        this.isLoading = false;
        this.errorMessage = error?.message || 'Error al iniciar sesión con Google';
      });
  }
}