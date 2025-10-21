import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError, timer } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface LoginRequest {
  cpf: string;
  senha: string;
  manterConectado?: boolean;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: UserInfo;
  expiresIn: number;
}

export interface UserInfo {
  id: string;
  cpf: string;
  nome: string;
  email: string;
  perfis: string[];
}

export interface UsuarioResponse {
  id: string;
  nome: string;
  email: string;
  tipo: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  token: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  
  private readonly API_URL = environment.apiUrl || 'http://localhost:8080/calculadoraacv/backend';
  private readonly TOKEN_KEY = 'auth_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private readonly USER_KEY = 'user_info';
  
  private authStateSubject = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null
  });
  
  public authState$ = this.authStateSubject.asObservable();
  private refreshTokenTimer?: any;

  constructor() {
    this.initializeAuthState();
  }

  private initializeAuthState(): void {
    // Primeiro verifica se há dados salvos localmente
    const storedUser = this.getStoredUser();
    const storedToken = this.getStoredToken();
    
    if (storedUser && storedToken) {
      // Se há dados locais, define o estado temporariamente
      this.updateAuthState(true, storedUser, storedToken);
    }
    
    // Só verifica com o servidor se Gov.br estiver habilitado
    if (environment.govBrEnabled) {
      // Sempre verifica com o servidor para confirmar
      this.checkAuthStatus().subscribe({
        next: (response) => {
          if (response.authenticated && response.user) {
            const user: UserInfo = {
              id: response.user.id,
              nome: response.user.nome,
              email: response.user.email,
              cpf: response.user.cpf || '',
              perfis: [response.user.tipo]
            };
            this.updateAuthState(true, user, 'session-token');
            
            // Atualiza os dados locais com as informações mais recentes
            localStorage.setItem(this.USER_KEY, JSON.stringify(user));
          } else {
            this.clearAuthData();
          }
        },
        error: () => {
          this.clearAuthData();
        }
      });
    } else {
      // Para desenvolvimento, usar autenticação mock
      console.log('Gov.br desabilitado - usando autenticação de desenvolvimento');
      this.setupDevelopmentAuth();
    }
  }

  private setupDevelopmentAuth(): void {
    const devUser: UserInfo = {
      id: '1',
      nome: 'Administrador Dev',
      email: 'admin@dev.local',
      cpf: '12345678901',
      perfis: ['ADMIN']
    };
    
    this.updateAuthState(true, devUser, 'dev-token');
    localStorage.setItem(this.USER_KEY, JSON.stringify(devUser));
    localStorage.setItem(this.TOKEN_KEY, 'dev-token');
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    const headers = this.createHeaders();
    
    return this.http.post<LoginResponse>(
      `${this.API_URL}/public/auth/login`,
      credentials,
      { headers, withCredentials: true }
    ).pipe(
      tap(response => this.handleLoginSuccess(response)),
      catchError(error => this.handleAuthError(error))
    );
  }

  logout(): Observable<any> {
    // Always clear local data first
    this.clearAuthData();
    
    // Try to notify server, but don't depend on it
    return this.http.post<any>(
      `${this.API_URL}/auth/logout`,
      {},
      { 
        withCredentials: true,
        headers: this.createAuthHeaders()
      }
    ).pipe(
      tap(() => {
        // Server logout successful
      }),
      catchError((error) => {
        // Server logout failed, but local logout completed
        return of({ message: 'Local logout completed' });
      }),
      tap(() => {
        // Always navigate to login after logout attempt
        setTimeout(() => {
          this.router.navigate(['/login'], { replaceUrl: true });
        }, 100);
      })
    );
  }

  refreshToken(): Observable<LoginResponse> {
    const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
    
    if (!refreshToken) {
      return throwError(() => new Error('Refresh token não encontrado'));
    }

    const headers = this.createHeaders();
    
    return this.http.post<LoginResponse>(
      `${this.API_URL}/public/auth/refresh`,
      { refreshToken },
      { headers, withCredentials: true }
    ).pipe(
      tap(response => this.handleLoginSuccess(response)),
      catchError(error => {
        this.clearAuthData();
        this.router.navigate(['/login']);
        return this.handleAuthError(error);
      })
    );
  }

  isAuthenticated(): boolean {
    return this.authStateSubject.value.isAuthenticated;
  }

  getCurrentUser(): UserInfo | null {
    return this.authStateSubject.value.user;
  }

  getToken(): string | null {
    return this.authStateSubject.value.token;
  }

  private handleLoginSuccess(response: LoginResponse): void {
    localStorage.setItem(this.TOKEN_KEY, response.token);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, response.refreshToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(response.user));
    
    this.updateAuthState(true, response.user, response.token);
    this.scheduleTokenRefresh(response.expiresIn);
  }

  private handleLogoutSuccess(): void {
    this.clearAuthData();
    this.router.navigate(['/login']);
  }

  private updateAuthState(isAuthenticated: boolean, user: UserInfo | null, token: string | null): void {
    this.authStateSubject.next({
      isAuthenticated,
      user,
      token
    });
  }

  private clearAuthData(): void {
    // Clear all storage
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    sessionStorage.clear(); // Clear session storage too
    
    // Clear timers
    if (this.refreshTokenTimer) {
      clearTimeout(this.refreshTokenTimer);
      this.refreshTokenTimer = undefined;
    }
    
    // Update auth state
    this.updateAuthState(false, null, null);
  }

  private scheduleTokenRefresh(expiresIn?: number): void {
    if (this.refreshTokenTimer) {
      clearTimeout(this.refreshTokenTimer);
    }
    
    const refreshTime = expiresIn ? (expiresIn - 300) * 1000 : 50 * 60 * 1000;
    
    this.refreshTokenTimer = setTimeout(() => {
      this.refreshToken().subscribe({
        error: () => {
          this.clearAuthData();
          this.router.navigate(['/login']);
        }
      });
    }, refreshTime);
  }

  private createHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Request-Id': this.generateRequestId()
    });
  }

  private createAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Request-Id': this.generateRequestId()
    });
  }

  private generateRequestId(): string {
    return 'req_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  private getStoredToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private getStoredUser(): UserInfo | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  private handleAuthError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Erro na autenticação';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.status === 401) {
      errorMessage = 'Credenciais inválidas';
      this.clearAuthData();
      this.router.navigate(['/login']);
    } else if (error.status === 403) {
      errorMessage = 'Acesso negado';
    } else if (error.status === 0) {
      errorMessage = 'Erro de conexão com o servidor';
    }
    
    return throwError(() => new Error(errorMessage));
  }

  loginWithGovBr(): void {
    if (!environment.govBrEnabled) {
      console.warn('Gov.br está desabilitado no ambiente de desenvolvimento');
      this.setupDevelopmentAuth();
      this.router.navigate(['/funcoes-administrativas']);
      return;
    }
    
    this.http.get<{message: string, redirectUrl: string}>(`${this.API_URL}/auth/login-url`, {
      withCredentials: true
    }).subscribe({
      next: (response) => {
        window.location.href = response.redirectUrl;
      },
      error: (error) => {
        console.error('Erro ao obter URL de login Gov.br:', error);
      }
    });
  }

  checkAuthStatus(): Observable<{authenticated: boolean, user?: any}> {
    if (!environment.govBrEnabled) {
      // Retorna autenticação mock para desenvolvimento
      return of({
        authenticated: true,
        user: {
          id: '1',
          nome: 'Administrador Dev',
          email: 'admin@dev.local',
          cpf: '12345678901',
          tipo: 'ADMIN'
        }
      });
    }
    
    return this.http.get<{authenticated: boolean, user?: any}>(`${this.API_URL}/auth/status`, {
      withCredentials: true
    }).pipe(
      tap(response => {
        if (response.authenticated && response.user) {
          const loginResponse: LoginResponse = {
            token: 'oauth-session',
            refreshToken: 'oauth-session',
            expiresIn: 3600,
            user: {
              id: response.user.id,
              nome: response.user.nome,
              email: response.user.email,
              cpf: response.user.cpf || '',
              perfis: [response.user.tipo]
            }
          };
          
          this.handleLoginSuccess(loginResponse);
        } else {
          this.clearAuthData();
        }
      }),
      catchError(error => {
        this.clearAuthData();
        return throwError(() => new Error('Erro ao verificar status de autenticação'));
      })
    );
  }

  // Adicionar método para desenvolvimento
  loginForDevelopment(): Observable<LoginResponse> {
    const devCredentials = {
      cpf: '12345678901',
      senha: 'dev123',
      manterConectado: false
    };
    
    return this.http.post<LoginResponse>(
      `${this.API_URL}/public/auth/login`,
      devCredentials,
      { withCredentials: true }
    ).pipe(
      tap(response => this.handleLoginSuccess(response)),
      catchError(error => {
        console.warn('Login de desenvolvimento falhou, tentando autenticação de sessão...');
        return this.checkAuthStatus().pipe(
          map(status => {
            if (status.authenticated) {
              return {
                token: 'session-token',
                refreshToken: 'session-refresh',
                expiresIn: 3600,
                user: {
                  id: status.user.id,
                  nome: status.user.nome,
                  email: status.user.email,
                  cpf: status.user.cpf || '',
                  perfis: [status.user.tipo]
                }
              };
            }
            throw new Error('Não foi possível autenticar');
          })
        );
      })
    );
  }
}