import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, map, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private authService = inject(AuthService);
  private router = inject(Router);

  canActivate(): Observable<boolean | UrlTree> {
    // Se já está autenticado localmente, permite acesso
    if (this.authService.isAuthenticated()) {
      return of(true);
    }

    // Se não está autenticado localmente, verifica com o servidor
    return this.authService.checkAuthStatus().pipe(
      map(response => {
        if (response.authenticated) {
          return true;
        } else {
          return this.router.createUrlTree(['/login']);
        }
      }),
      catchError(() => {
        // Em caso de erro, redireciona para login
        return of(this.router.createUrlTree(['/login']));
      })
    );
  }
}