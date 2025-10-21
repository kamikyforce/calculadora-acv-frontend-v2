import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MenuItem, HamburgerMenuComponent } from '../../shared/components/hamburger-menu/hamburger-menu.component';
import { AuthService } from '../../core/services/auth.service';
import { AccessibilityService } from '../../core/services/accessibility.service';

interface AdminCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
  status: 'active' | 'inactive' | 'maintenance';
}

@Component({
  selector: 'app-funcoes-administrativas',
  standalone: true,
  imports: [CommonModule, HamburgerMenuComponent],
  templateUrl: './funcoes-administrativas.component.html',
  styleUrls: ['./funcoes-administrativas.component.scss']
})
export class FuncoesAdministrativasComponent {
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
      id: 'funcoes-administrativas',
      label: 'Funções Administrativas',
      route: '/funcoes-administrativas',
      icon: 'fas fa-cogs',
      active: true // Esta página está ativa
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

  adminCards: AdminCard[] = [
    {
      id: 'acompanhamento',
      title: 'ACOMPANHAMENTO',
      description: 'Visualize os principais indicadores de emissões.',
      icon: 'fas fa-chart-line',
      route: '/acompanhamento',
      color: 'blue',
      status: 'active'
    },
    {
      id: 'certificadoras',
      title: 'CERTIFICADORAS',
      description: 'Gerencie certificadoras e acompanhe seus status.',
      icon: 'fas fa-certificate',
      route: '/certificadoras',
      color: 'blue',
      status: 'active'
    },
    {
      id: 'industrias',
      title: 'INDÚSTRIAS',
      description: 'Visualize e administre dados das indústrias.',
      icon: 'fas fa-industry',
      route: '/industrias',
      color: 'blue',
      status: 'active'
    },
    {
      id: 'administradores',
      title: 'ADMINISTRADORES',
      description: 'Controle usuários administradores e permissões.',
      icon: 'fas fa-users-cog',
      route: '/administradores',
      color: 'blue',
      status: 'active'
    },
    {
      id: 'fatores-emissao',
      title: 'FATORES DE EMISSÃO',
      description: 'Gerencie os fatores para cálculos de emissões.',
      icon: 'fas fa-calculator',
      route: '/banco-de-fatores',
      color: 'blue',
      status: 'active'
    },
    {
      id: 'rebanho',
      title: 'REBANHO',
      description: 'Gerencie dados de rebanho e insumos relacionados.',
      icon: 'fas fa-cow',
      route: '/rebanho',
      color: 'blue',
      status: 'active'
    }
  ];

  constructor(private router: Router, private authService: AuthService) {
    // Subscribe to accessibility states
    this.accessibilityService.isHighContrast$.subscribe(state => {
      this.isHighContrast = state;
    });
    
    this.accessibilityService.isVLibrasActive$.subscribe(state => {
      this.isVLibrasActive = state;
    });
  }

  toggleHighContrast(): void {
    this.accessibilityService.toggleHighContrast();
  }

  toggleVLibras(): void {
    this.accessibilityService.toggleVLibras();
  }

  onMenuToggle(isOpen: boolean): void {
    this.isMenuOpen = isOpen;
  }

  onMenuItemClick(item: MenuItem): void {
    this.router.navigate([item.route]);
    this.isMenuOpen = false;
  }

  navigateToCard(cardId: string): void {
    switch (cardId) {
      case 'acompanhamento':
        this.router.navigate(['/acompanhamento']);
        break;
      case 'certificadoras':
        this.router.navigate(['/certificadoras']); // Nova rota
        break;
      case 'industrias':
        this.router.navigate(['/industrias']);
        break;
      case 'administradores':
        this.router.navigate(['/administradores']);
        break;
      case 'fatores-emissao':
        this.router.navigate(['/banco-de-fatores']);
        break;
      default:
        console.log('Navegação não implementada para:', cardId);
    }
  }

  getCardClasses(card: AdminCard): string {
    return `admin-card card-${card.color} ${card.status}`;
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