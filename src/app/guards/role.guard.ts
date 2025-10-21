import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { NotificationService } from '../core/services/notification.service';
import { MESSAGES } from '../shared/constants/messages';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  canActivate(): boolean {
    const user = this.authService.getCurrentUser();
    
    if (user?.perfis?.includes('ADMIN') ||
        user?.perfis?.includes('CURADOR')) {
      return true;
    }
    
    this.notificationService.warning(MESSAGES.GUARD.SEM_PERMISSAO);
    this.router.navigate(['/dashboard']);
    return false;
  }
}