import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { BrLoadingComponent } from '../../shared/components/br-loading/br-loading.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [CommonModule, BrLoadingComponent],
  templateUrl: './callback.component.html',
  styleUrls: ['./callback.component.scss']
})
export class CallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  
  isLoading = true;
  errorMessage = '';
  successMessage = '';
  redirectProgress = 0;

  ngOnInit() {
    this.handleCallback();
  }

  private handleCallback() {
    // Check if Gov.br is enabled
    if (!environment.govBrEnabled) {
      console.log('Gov.br está desabilitado - redirecionando para login');
      this.isLoading = false;
      this.errorMessage = 'Autenticação Gov.br não está disponível no ambiente de desenvolvimento.';
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 2000);
      return;
    }

    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      const state = params['state'];
      const error = params['error'];
      const errorDescription = params['error_description'];

      if (error) {
        this.handleError(error, errorDescription);
        return;
      }

      if (code && state) {
        // Since processGovBrCallback doesn't exist and Gov.br is disabled,
        // we'll just redirect to login
        this.handleError('method_not_available', 'Autenticação Gov.br não está disponível');
      } else {
        this.handleError('invalid_request', 'Parâmetros de autenticação inválidos');
      }
    });
  }

  private handleError(error: string, description?: string) {
    this.isLoading = false;
    
    switch (error) {
      case 'access_denied':
        this.errorMessage = 'Acesso negado pelo usuário.';
        break;
      case 'invalid_request':
        this.errorMessage = 'Requisição inválida.';
        break;
      case 'server_error':
        this.errorMessage = 'Erro no servidor de autenticação.';
        break;
      case 'method_not_available':
        this.errorMessage = 'Autenticação Gov.br não está disponível no momento.';
        break;
      default:
        this.errorMessage = description || 'Erro na autenticação.';
    }
    
    console.error('Erro na autenticação:', { error, description });
    
    // Redirect to login after showing error
    setTimeout(() => {
      this.router.navigate(['/login']);
    }, 3000);
  }

  retryLogin() {
    this.router.navigate(['/login']);
  }
  
  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        
      },
      error: (error: any) => {
        console.error('Erro ao fazer logout:', error);
      }
    });
  }
}