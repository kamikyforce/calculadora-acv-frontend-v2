import { MenuItem } from "../components/hamburger-menu/hamburger-menu.component";

export const STANDARD_MENU_ITEMS: MenuItem[] = [
  {
    id: 'inicio',
    label: 'Início',
    icon: 'fas fa-home',
    route: '/inicio'
  },
  {
    id: 'funcoes-administrativas',
    label: 'Funções Administrativas',
    icon: 'fas fa-cogs',
    children: [
      {
        id: 'acompanhamento',
        label: 'Acompanhamento',
        icon: 'fas fa-chart-line',
        route: '/acompanhamento'
      },
      {
        id: 'certificadoras',
        label: 'Certificadoras',
        icon: 'fas fa-certificate',
        route: '/certificadoras'
      },
      {
        id: 'industrias',
        label: 'Indústrias',
        icon: 'fas fa-industry',
        route: '/industrias'
      },
      {
        id: 'administradores',
        label: 'Administradores',
        icon: 'fas fa-users-cog',
        route: '/administradores'
      },
      {
        id: 'fatores-emissao',
        label: 'Fatores de Emissão',
        icon: 'fas fa-calculator',
        route: '/banco-de-fatores'
      }
    ]
  },
  {
    id: 'calculos',
    label: 'Cálculos Registrados',
    route: '/calculos-registrados',
    icon: 'fas fa-calculator'
  },
  {
    id: 'energia-e-combustiveis',
    label: 'Energia e Combustíveis',
    icon: 'fas fa-bolt',
    route: '/energia-e-combustiveis'
  },
  {
    id: 'rebanho',
    label: 'Rebanho',
    icon: 'fas fa-hippo',
    route: '/rebanho'
  },
  {
    id: 'mut',
    label: 'MUT',
    icon: 'fas fa-seedling',
    route: '/mut'
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