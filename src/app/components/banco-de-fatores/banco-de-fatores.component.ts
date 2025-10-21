import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MenuItem, HamburgerMenuComponent } from '../../shared/components/hamburger-menu/hamburger-menu.component';
import { AuthService } from '../../core/services/auth.service';
import { AccessibilityService } from '../../core/services/accessibility.service';

interface FatorCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
  status: 'active' | 'inactive' | 'maintenance';
}

@Component({
  selector: 'app-banco-de-fatores',
  standalone: true,
  imports: [CommonModule, HamburgerMenuComponent],
  templateUrl: './banco-de-fatores.component.html',
  styleUrls: ['./banco-de-fatores.component.scss']
})
export class BancoDeFatoresComponent {
  private router = inject(Router);
  private authService = inject(AuthService);
  private accessibilityService = inject(AccessibilityService);
  
  isMenuOpen = false;
  isHighContrast = false;
  isVLibrasActive = false;

  menuItems: MenuItem[] = [
    {
      id: 'inicio',
      label: 'Início',
      icon: 'fas fa-home',
      route: '/inicio'
    },
    {
      id: 'banco-de-fatores',
      label: 'Banco de Fatores',
      route: '/banco-de-fatores',
      icon: 'fas fa-database',
      active: true // Esta página está ativa
    },
    {
      id: 'funcoes-administrativas',
      label: 'Funções Administrativas',
      route: '/funcoes-administrativas',
      icon: 'fas fa-cogs'
    },
    {
      id: 'calculos',
      label: 'Cálculos Registrados',
      route: '/calculos-registrados',
      icon: 'fas fa-calculator'
    },
    {
      id: 'relatorios',
      label: 'Relatórios',
      icon: 'fas fa-chart-bar',
      children: [
        {
          id: 'relatorio-mensal',
          label: 'Relatório Mensal',
          icon: 'fas fa-calendar-alt',
          route: '/relatorios/mensal'
        },
        {
          id: 'relatorio-anual',
          label: 'Relatório Anual',
          icon: 'fas fa-calendar',
          route: '/relatorios/anual'
        }
      ]
    },
    {
      id: 'configuracoes',
      label: 'Configurações',
      icon: 'fas fa-cog',
      route: '/configuracoes'
    }
  ];

  fatorCards: FatorCard[] = [
    {
      id: 'rebanho',
      title: 'REBANHO',
      description: 'Gerencie fatores relacionados à pecuária.',
      icon: 'fas fa-hippo',
      route: '/rebanho',
      color: 'blue',
      status: 'active'
    },
    {
      id: 'producao-agricola',
      title: 'PRODUÇÃO AGRÍCOLA',
      description: 'Configure dados de emissões agrícolas.',
      icon: 'fas fa-seedling',
      route: '/producao-agricola',
      color: 'blue',
      status: 'active'
    },
    {
      id: 'mut',
      title: 'MUT',
      description: 'Ajuste fatores de mudanças no uso da terra.',
      icon: 'fas fa-mountain',
      route: '/mut',
      color: 'blue',
      status: 'active'
    },
    {
      id: 'energia-combustiveis',
      title: 'ENERGIA E COMBUSTÍVEIS',
      description: 'Administre fatores de consumo energético.',
      icon: 'fas fa-bolt',
      route: '/energia-e-combustiveis',
      color: 'blue',
      status: 'active'
    }
  ];

  constructor() {
    // Subscribe to accessibility states - seguindo o padrão do funcoes-administrativas
    this.accessibilityService.isHighContrast$.subscribe(state => {
      this.isHighContrast = state;
    });
    
    this.accessibilityService.isVLibrasActive$.subscribe(state => {
      this.isVLibrasActive = state;
    });
  }

  onMenuToggle(isOpen: boolean): void {
    this.isMenuOpen = isOpen;
  }

  onMenuItemClick(item: MenuItem): void {
    if (item.route) {
      this.router.navigate([item.route]);
    }
    this.isMenuOpen = false;
  }

  toggleHighContrast(): void {
    this.accessibilityService.toggleHighContrast();
  }

  toggleVLibras(): void {
    this.accessibilityService.toggleVLibras();
  }

  navigateToCard(cardId: string): void {
    switch (cardId) {
      case 'rebanho':
        this.router.navigate(['/rebanho']);
        break;
      case 'producao-agricola':
        this.router.navigate(['/producao-agricola']);
        break;
      case 'mut':
        this.router.navigate(['/mut']);
        break;
      case 'energia-combustiveis':
        this.router.navigate(['/energia-e-combustiveis']);
        break;
      default:
        console.log('Navegação não implementada para:', cardId);
    }
  }

  getCardClasses(card: FatorCard): string {
    return `fator-card card-${card.color} ${card.status}`;
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        // Logout handled by the service
      },
      error: (error) => {
        console.error('Erro ao fazer logout:', error);
      }
    });
  }
}