import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, from, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { User } from '../models/user.model';
import { environment } from '../../environments/environment';
import { User as AppUser } from '../models/user.model';

import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser
} from '@angular/fire/auth';

import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc
} from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;
  private apiUrl = (window as any).__env?.apiUrl || environment.apiUrl;

  private http = inject(HttpClient);
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  constructor() {
    // Recuperar usuario almacenado localmente si existe
    const storedUser = localStorage.getItem('currentUser');
    const parsedUser: User | null = storedUser ? JSON.parse(storedUser) : null;

    // Inicializamos BehaviorSubject con valor inicial
    this.currentUserSubject = new BehaviorSubject<User | null>(parsedUser);
    this.currentUser = this.currentUserSubject.asObservable();
    
    onAuthStateChanged(this.auth, (fbUser: FirebaseUser | null) => {
      if (!fbUser) {
        this.currentUserSubject.next(null);
        localStorage.removeItem('currentUser');
        return;
      }
      this.currentUserSubject.next({
        id: fbUser.uid,
        username: this.currentUserSubject.value?.username || fbUser.email || '',
        email: fbUser.email || ''
      });
      localStorage.setItem('currentUser', JSON.stringify(this.currentUserSubject.value));
    });
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(email: string, password: string): Observable<User> {
    return this.http.post<any>(`${this.apiUrl}/auth/login`, { 
      username: email, 
      email, 
      password 
    }).pipe(
      map(resp => {
        const user: User = {
          id: resp.user?.id ?? '',
          username: resp.user?.username ?? '',
          email: resp.user?.email ?? email,
          token: resp.token
        };
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.currentUserSubject.next(user);
        return user;
      })
    );
  }

  register(user: User): Observable<User> {
    // Registro contra backend con JWT
    return this.http.post<any>(`${this.apiUrl}/auth/register`, {
        username: user.username,
        email: user.email,
        password: user.password
    }).pipe(
        map((resp) => {
            const newUser: User = {
                id: resp.id?.toString() ?? '',
                username: resp.username,
                email: resp.email,
                token: resp.token
            };
            localStorage.setItem('currentUser', JSON.stringify(newUser));
            this.currentUserSubject.next(newUser);
            return newUser;
        }),
        catchError((error) => {
            console.error('Error en registro (backend):', error);
            return throwError(() => error);
        })
    );
  }

  logout(): void {
    from(signOut(this.auth)).subscribe({
      next: () => {
        localStorage.removeItem('currentUser');
        this.currentUserSubject.next(null);
        window.dispatchEvent(new CustomEvent('user-logout'));
      },
      error: () => {
        localStorage.removeItem('currentUser');
        this.currentUserSubject.next(null);
        window.dispatchEvent(new CustomEvent('user-logout'));
      }
    });
  }

  isTokenValid(): boolean {
    return !!this.auth.currentUser;
  }

  isLoggedIn(): boolean {
    const storedUser = localStorage.getItem('currentUser');
    const token = storedUser ? JSON.parse(storedUser).token : null;
    return !!token;
  }

  async loginWithGoogle(): Promise<void> {
    const isNodeBackend = this.apiUrl.includes('/api');

    if (isNodeBackend) {
      const resp = await this.http.get<any>(`${this.apiUrl}/auth/google`).toPromise();
      const user: User = {
        id: resp.id?.toString() ?? '',
        username: resp.username ?? '',
        email: resp.email ?? '',
        token: resp.token
      };
      localStorage.setItem('currentUser', JSON.stringify(user));
      this.currentUserSubject.next(user);
      return;
    }

    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(this.auth, provider);
    const idToken = await cred.user.getIdToken();

    const resp = await this.http.post<any>(`${this.apiUrl}/auth/google`, { idToken }).toPromise();
    const user: User = {
      id: resp.user?.id ?? '',
      username: resp.user?.username ?? '',
      email: resp.user?.email ?? cred.user.email ?? '',
      token: resp.token
    };
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }
}
