import { Component, CUSTOM_ELEMENTS_SCHEMA, AfterViewInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, LoginRequest } from '../../core/services/auth.service';
import { AccessibilityService } from '../../core/services/accessibility.service';
import { BrLoadingComponent } from '../../shared/components/br-loading/br-loading.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, BrLoadingComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements AfterViewInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private accessibilityService = inject(AccessibilityService);
  
  cpf: string = '';
  senha: string = '';
  manterConectado: boolean = false;
  showPassword: boolean = false;
  
  isLoading: boolean = false;
  loadingMessage: string = '';
  errorMessage: string = '';
  
  // Accessibility features - now managed by service
  isHighContrast: boolean = false;
  isVLibrasActive: boolean = false;

  ngAfterViewInit() {
    // Verifica se já está autenticado
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/funcoes-administrativas']);
    }
    
    this.initializeAccessibility();
  }

  formatCPF(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    
    if (value.length <= 11) {
      value = value.replace(/(\d{3})(\d)/, '$1.$2');
      value = value.replace(/(\d{3})(\d)/, '$1.$2');
      value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    
    this.cpf = value;
    event.target.value = value;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (!this.isValidForm()) {
      return;
    }

    this.isLoading = true;
    this.loadingMessage = 'Validando credenciais...';
    this.errorMessage = '';

    const credentials: LoginRequest = {
      cpf: this.cpf.replace(/\D/g, ''),
      senha: this.senha,
      manterConectado: this.manterConectado
    };

    this.authService.login(credentials).subscribe({
      next: (response) => {
        this.loadingMessage = 'Login realizado com sucesso! Redirecionando...';
        setTimeout(() => {
          this.isLoading = false;
          console.log('Login realizado com sucesso:', response.user);
          this.router.navigate(['/funcoes-administrativas']);
        }, 1000);
      },
      error: (error) => {
        this.isLoading = false;
        this.loadingMessage = '';
        this.errorMessage = error.message || 'Erro ao realizar login';
        console.error('Erro no login:', error);
      }
    });
  }

  private isValidForm(): boolean {
    if (!this.cpf || this.cpf.replace(/\D/g, '').length !== 11) {
      this.errorMessage = 'CPF deve ter 11 dígitos';
      return false;
    }
    
    if (!this.senha || this.senha.length < 6) {
      this.errorMessage = 'Senha deve ter pelo menos 6 caracteres';
      return false;
    }
    
    return true;
  }

  loginGovBr() {
    this.isLoading = true;
    this.loadingMessage = 'Conectando com Gov.br...';
    this.authService.loginWithGovBr();
  }
  
  toggleHighContrast() {
    this.accessibilityService.toggleHighContrast();
    this.isHighContrast = this.accessibilityService.getHighContrastState();
  }

  toggleVLibras() {
    this.accessibilityService.toggleVLibras();
    this.isVLibrasActive = this.accessibilityService.getVLibrasState();
  }

  private initializeAccessibility() {
    // Subscribe to accessibility states
    this.accessibilityService.isHighContrast$.subscribe(state => {
      this.isHighContrast = state;
    });
    
    this.accessibilityService.isVLibrasActive$.subscribe(state => {
      this.isVLibrasActive = state;
    });
  }

  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private generateCodeChallenge(): string {
    return 'code-challenge-placeholder';
  }
}