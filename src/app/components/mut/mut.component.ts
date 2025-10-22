import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { AccessibilityService } from '../../core/services/accessibility.service';
import { NotificationService } from '../../core/services/notification.service';
import { MutService } from '../../core/services/mut.service';

import { HamburgerMenuComponent, MenuItem } from '../../shared/components/hamburger-menu/hamburger-menu.component';
import { MutModalComponent } from './mut-modal/mut-modal.component';
// Import do modal de importação comentado temporariamente
// import { MutImportModalComponent } from './mut-import-modal/mut-import-modal.component';
import { MESSAGES } from '../../shared/constants/messages';

import { MutResponse, MutFiltros, MutPagedResponse, TipoMudanca, Bioma, EscopoEnum } from '../../core/models/mut.model';

@Component({
  selector: 'app-mut',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HamburgerMenuComponent,
    MutModalComponent
    // MutImportModalComponent comentado temporariamente
  ],
  templateUrl: './mut.component.html',
  styleUrls: ['./mut.component.scss']
})
export class MutComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private subscriptions = new Subscription();

  fatoresMut: MutResponse[] = [];
  fatoresFiltrados: MutResponse[] = [];
  paginatedData: MutResponse[] = [];

  isLoading = false;
  isHighContrast = false;
  isVLibrasActive = false;

  // Modal
  isModalVisible = false;
  modalMode: 'create' | 'edit' = 'create';
  fatorSelecionado: MutResponse | null = null;
  // Modal de importação comentado temporariamente
  // isImportModalVisible = false;

  // Modal de confirmação de exclusão
  showDeleteModal = false;
  fatorParaRemover: MutResponse | null = null;

  // Filtros
  filtros: MutFiltros = {};
  termoBusca = '';
  searchTerm = ''; // Alias for termoBusca
  private searchSubject = new Subject<string>();
  sugestoesBusca: string[] = [];
  searchSuggestions: string[] = []; // Alias for sugestoesBusca
  mostrarSugestoes = false;
  showSuggestions = false; // Alias for mostrarSugestoes
  
  // Controles de visualização
  modoVisualizacao: 'tabela' | 'cards' = 'tabela';
  mostrarFiltrosAvancados = false;
  
  // Ordenação
  campoOrdenacao = 'dataAtualizacao';
  sortField = 'dataAtualizacao'; // Alias for campoOrdenacao
  direcaoOrdenacao: 'ASC' | 'DESC' = 'DESC';
  sortDirection: 'ASC' | 'DESC' = 'DESC'; // Alias for direcaoOrdenacao

  // Paginação
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;

  // Opções
  TipoMudanca = TipoMudanca;
  Bioma = Bioma;
  EscopoEnum = EscopoEnum;

  // Dropdowns dos filtros (listagem)
  isEscopoOpen = false;
  isTipoMudancaOpen = false;
  isBiomaOpen = false;

  // Dropdowns da paginação
  isItemsPerPageOpen = false;
  isPageOpen = false;

  // Opções (renderização dos radios)
  escopoOptions: EscopoEnum[] = [EscopoEnum.ESCOPO1, EscopoEnum.ESCOPO3];
  tipoMudancaOptions: TipoMudanca[] = [TipoMudanca.SOLO, TipoMudanca.VEGETACAO, TipoMudanca.DESMATAMENTO];
  biomaOptions: Bioma[] = [
    Bioma.AMAZONIA,
    Bioma.CAATINGA,
    Bioma.CERRADO,
    Bioma.MATA_ATLANTICA,
    Bioma.PAMPA,
    Bioma.PANTANAL
  ];
  itemsPerPageOptions: number[] = [10, 25, 50];

  // Menu
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
      icon: 'fas fa-database'
    },
    {
      id: 'mut',
      label: 'MUT',
      route: '/mut',
      icon: 'fas fa-seedling',
      active: true
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
  isMenuOpen = false;

  // Usuário
  userProfile: any = null;
  userProfileService: any; // Remove initialization here

  constructor(
    private router: Router,
    public authService: AuthService,
    private accessibilityService: AccessibilityService,
    private notificationService: NotificationService,
    private mutService: MutService
  ) {
    // Initialize userProfileService in constructor after authService is available
    this.userProfileService = this.authService;
  }

  ngOnInit(): void {
    this.loadUserProfile();
    this.setupAccessibilitySubscriptions();
    this.setupSearchDebounce();
    this.carregarFatores();
  }

  ngAfterViewInit(): void {
    this.initializeVLibras();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.unsubscribe();
  }

  private setupSearchDebounce(): void {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(searchTerm => {
        this.termoBusca = searchTerm;
        this.searchTerm = searchTerm;
        
        if (searchTerm && searchTerm.trim()) {
          this.onBuscarInstantaneo();
          this.buscarSugestoes(searchTerm);
        } else {
          this.currentPage = 1;
          this.carregarFatores();
          this.sugestoesBusca = [];
          this.mostrarSugestoes = false;
          this.searchSuggestions = [];
          this.showSuggestions = false;
        }
      });
  }

  // Add the missing buscarSugestoes method
  private buscarSugestoes(termo: string): void {
    const termoNormalizado = this.normalizarTexto(termo);

    const sugeridos: string[] = [];
    for (const fator of this.fatoresMut) {
      const nome = fator.nome || '';
      if (this.normalizarTexto(nome).includes(termoNormalizado)) {
        sugeridos.push(nome);
      }

      if (fator.tipoMudanca === TipoMudanca.SOLO && Array.isArray(fator.dadosSolo)) {
        for (const ds of fator.dadosSolo) {
          const anteriorPersist = ds.usoAnterior || '';
          const atualPersist = ds.usoAtual || '';

          if (this.normalizarTexto(anteriorPersist).includes(termoNormalizado)) {
            sugeridos.push(anteriorPersist);
          }
          if (this.normalizarTexto(atualPersist).includes(termoNormalizado)) {
            sugeridos.push(atualPersist);
          }

          if (!anteriorPersist && !atualPersist && ds.descricao) {
            const { anterior, atual } = this.extractUsoAnteriorAtual(ds.descricao);
            if (this.normalizarTexto(anterior).includes(termoNormalizado)) {
              sugeridos.push(anterior);
            }
            if (this.normalizarTexto(atual).includes(termoNormalizado)) {
              sugeridos.push(atual);
            }
          }
        }
      }

      if (sugeridos.length >= 5) break; // limitar cedo
    }

    const uniq = Array.from(new Set(sugeridos.filter(Boolean))).slice(0, 5);
    this.sugestoesBusca = uniq;
    this.searchSuggestions = uniq;
    this.mostrarSugestoes = uniq.length > 0;
    this.showSuggestions = uniq.length > 0;
  }

  private setupAccessibilitySubscriptions(): void {
    // NOTE: using the corrected observable names in AccessibilityService
    this.accessibilityService.isHighContrast$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isActive => {
        this.isHighContrast = isActive;
        this.updateBodyClass('high-contrast', isActive);
      });

    this.accessibilityService.isVLibrasActive$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isActive => {
        this.isVLibrasActive = isActive;
      });
  }

  private loadUserProfile(): void {
    // Primeiro, tentar obter o perfil atual do authService
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.userProfile = currentUser;
      console.log('👤 Perfil do usuário carregado:', this.userProfile);
    }
    
    // Também se inscrever para mudanças futuras
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(authState => {
        this.userProfile = authState.user;
        console.log('👤 Perfil do usuário atualizado:', this.userProfile);
      });
  }

  private initializeVLibras(): void {
    if (typeof window !== 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
      script.onload = () => {
        (window as any).VLibras.Widget('https://vlibras.gov.br/app');
      };
      document.head.appendChild(script);
    }
  }

  private updateBodyClass(className: string, add: boolean): void {
    if (typeof document !== 'undefined') {
      if (add) document.body.classList.add(className);
      else document.body.classList.remove(className);
    }
  }

  carregarFatores(): void {
    this.isLoading = true;
    
    // Preparar filtros para envio ao backend
    const filtrosParaEnvio: any = {
      page: Math.max(0, this.currentPage - 1), // Backend usa página baseada em 0
      size: this.itemsPerPage,
      sort: this.sortField,
      direction: this.sortDirection
    };
    
    // Adicionar filtros se estiverem definidos
    if (this.filtros.tipoMudanca) {
      filtrosParaEnvio.tipoMudanca = this.filtros.tipoMudanca;
    }
    if (this.filtros.escopo) {
      filtrosParaEnvio.escopo = this.filtros.escopo;
    }
    if (this.filtros.bioma) {
      filtrosParaEnvio.bioma = this.filtros.bioma;
    }
    
    // Adicionar termo de busca se existir
    if (this.termoBusca && this.termoBusca.trim()) {
      filtrosParaEnvio.search = this.termoBusca.trim();
    }
    
    this.mutService.listar(filtrosParaEnvio)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.fatoresMut = response.content || [];
          this.totalItems = response.totalElements || 0;
          this.totalPages = response.totalPages || 0;
          
          // Se não há termo de busca, usar dados paginados diretamente
          if (!this.termoBusca || !this.termoBusca.trim()) {
            this.fatoresFiltrados = [...this.fatoresMut];
            this.paginatedData = [...this.fatoresMut];
          } else {
            // Se há termo de busca, aplicar filtro local adicional
            this.filtrarDadosLocalmente(this.termoBusca);
          }
          
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Erro ao carregar fatores MUT:', error);
          this.notificationService.error('Erro ao carregar fatores MUT');
          this.isLoading = false;
          
          // Reset data on error
          this.fatoresMut = [];
          this.fatoresFiltrados = [];
          this.paginatedData = [];
          this.totalItems = 0;
          this.totalPages = 0;
        }
      });
  }

  /** ===== Filtros + Paginação ===== */

  aplicarFiltros(): void {
    // Reset para primeira página ao aplicar filtros
    this.currentPage = 1;
    this.carregarFatores(); // Recarregar dados do backend com novos filtros
  }

  onBuscar(): void {
    this.currentPage = 1; // Reset para primeira página ao buscar
    this.carregarFatores(); // Executar busca diretamente
  }

  onSearchInput(valueOrEvent: any): void {
    const value = typeof valueOrEvent === 'string' ? valueOrEvent : (valueOrEvent?.target?.value ?? '');
    this.termoBusca = value;
    this.searchTerm = value;
    this.searchSubject.next(value);

    // restauração imediata ao apagar
    if (!value.trim()) {
      this.currentPage = 1;
      this.fatoresFiltrados = [...this.fatoresMut];
      this.updatePaginatedData();
    }
  }

  onBuscarInstantaneo(): void {
    this.currentPage = 1;
    this.filtrarDadosLocalmente(this.termoBusca);
  }

  // Novo método para tratar busca por Enter
  onBuscarPorEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.onBuscar();
    }
  }

  selecionarSugestao(sugestao: string): void {
    this.termoBusca = sugestao;
    this.mostrarSugestoes = false;
    this.searchSubject.next(sugestao);
  }

  ocultarSugestoes(): void {
    // Delay para permitir clique na sugestão
    setTimeout(() => {
      this.mostrarSugestoes = false;
    }, 200);
  }

  alternarModoVisualizacao(): void {
    this.modoVisualizacao = this.modoVisualizacao === 'tabela' ? 'cards' : 'tabela';
  }

  alternarFiltrosAvancados(): void {
    this.mostrarFiltrosAvancados = !this.mostrarFiltrosAvancados;
  }

  onLimparFiltros(): void {
    this.filtros = {};
    this.termoBusca = '';
    this.currentPage = 1;
    this.carregarFatores();
  }

  private updateFilteredData(): void {
    // Com paginação do backend, apenas atualizamos os dados paginados
    // Os filtros são aplicados no backend através do método carregarFatores
    this.updatePaginatedData();
  }

  // Novo método para filtrar dados localmente
  filtrarDadosLocalmente(termo: string): void {
    if (!termo || termo.trim() === '') {
      this.fatoresFiltrados = [...this.fatoresMut];
    } else {
      const termoNormalizado = this.normalizarTexto(termo);

      this.fatoresFiltrados = this.fatoresMut.filter(fator => {
        // Nome do fator
        const nome = this.normalizarTexto(fator.nome || '');

        // Campos de uso (persistidos e extraídos da descrição)
        let usoAnteriorAgregado = '';
        let usoAtualAgregado = '';

        if (fator.tipoMudanca === TipoMudanca.SOLO && Array.isArray(fator.dadosSolo)) {
          for (const ds of fator.dadosSolo) {
            const anteriorPersist = this.normalizarTexto(ds.usoAnterior || '');
            const atualPersist = this.normalizarTexto(ds.usoAtual || '');

            if (anteriorPersist || atualPersist) {
              usoAnteriorAgregado += ` ${anteriorPersist}`;
              usoAtualAgregado += ` ${atualPersist}`;
            } else if (ds.descricao) {
              const { anterior, atual } = this.extractUsoAnteriorAtual(ds.descricao);
              usoAnteriorAgregado += ` ${this.normalizarTexto(anterior)}`;
              usoAtualAgregado += ` ${this.normalizarTexto(atual)}`;
            }
          }
        }

        // Matching apenas em campos relevantes
        const match =
          nome.includes(termoNormalizado) ||
          (usoAnteriorAgregado && usoAnteriorAgregado.includes(termoNormalizado)) ||
          (usoAtualAgregado && usoAtualAgregado.includes(termoNormalizado));

        return match;
      });
    }
    
    // Atualizar paginação local
    this.updatePaginatedData();
  }

  updatePaginatedData(): void {
    this.totalItems = this.fatoresFiltrados.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage) || 0;
    
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedData = this.fatoresFiltrados.slice(startIndex, endIndex);
  }

  /**
   * Força a atualização imediata da tabela
   * Útil após operações que modificam os dados localmente
   */
  private forceTableUpdate(): void {
    this.paginatedData = [...this.fatoresMut];
    // Força detecção de mudanças no próximo ciclo
    setTimeout(() => {
      this.paginatedData = [...this.fatoresMut];
    }, 0);
  }

  changePage(event: any): void {
    const newPage = typeof event === 'number' ? event : parseInt(event.target?.value, 10);
    if (isNaN(newPage)) return;
    if (newPage >= 1 && newPage <= this.totalPages && newPage !== this.currentPage) {
      this.currentPage = newPage;
      
      if (this.termoBusca && this.termoBusca.trim()) {
        this.updatePaginatedData();
      } else {
        this.carregarFatores();
      }
    }
  }

  changeItemsPerPage(event: any): void {
    const newItemsPerPage = typeof event === 'number' ? event : parseInt(event.target?.value, 10);
    if (isNaN(newItemsPerPage)) return;
    if (newItemsPerPage !== this.itemsPerPage) {
      this.itemsPerPage = newItemsPerPage;
      this.currentPage = 1;
      
      if (this.termoBusca && this.termoBusca.trim()) {
        this.updatePaginatedData();
      } else {
        this.carregarFatores();
      }
    }
  }

  get pages(): number[] {
    const totalPages = Math.max(1, this.totalPages);
    const pagesArray = Array.from({ length: totalPages }, (_, i) => i + 1);
    console.log('📄 [MUT] Array de páginas gerado:', pagesArray, 'Total páginas:', totalPages);
    return pagesArray;
  }

  get displayedFrom(): number {
    if (this.totalItems === 0) return 0;
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  get displayedTo(): number {
    if (this.totalItems === 0) return 0;
    return Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
  }

  // ✅ CORRIGIDO: propriedade para controle de permissões
  get canManage(): boolean {
    if (!this.userProfile) {
      console.log('❌ Sem perfil de usuário');
      return false;
    }
    
    // Verificar se o usuário tem perfis de ADMIN ou CURADOR
    const hasAdminRole = this.userProfile.perfis?.includes('ADMIN') || 
                        this.userProfile.perfis?.includes('ADMINISTRADOR') ||
                        this.userProfile.tipo === 'ADMINISTRADOR';
    
    const hasCuradorRole = this.userProfile.perfis?.includes('CURADOR') ||
                          this.userProfile.tipo === 'CURADOR';
    
    // console.log('🔐 Verificando permissões:', {
    //   userProfile: this.userProfile,
    //   hasAdminRole,
    //   hasCuradorRole,
    //   canManage: hasAdminRole || hasCuradorRole
    // });
    
    return hasAdminRole || hasCuradorRole;
  }

  onNovoFator(): void {
    if (!this.canManage) {
      this.notificationService.warning(MESSAGES.MUT.PERMISSAO_CRIAR);
      return;
    }
    this.modalMode = 'create';
    this.fatorSelecionado = null;
    this.isModalVisible = true;
    this.lockBodyScroll(true);
  }

  onEditarFator(fator: MutResponse): void {
    console.log('🔧 Tentando editar fator:', fator);
    console.log('🔐 Pode gerenciar?', this.canManage);
    console.log('👤 Perfil atual:', this.userProfile);
    
    if (!this.canManage) {
      console.log('❌ Sem permissão para editar');
      this.notificationService.warning(MESSAGES.MUT.PERMISSAO_EDITAR);
      return;
    }
    
    console.log('✅ Abrindo modal de edição');
    this.modalMode = 'edit';
    this.fatorSelecionado = fator;
    this.isModalVisible = true;
    this.lockBodyScroll(true);
  }

  onModalClose(): void {
    console.log('🚪 MODAL FECHADO SEM ALTERAÇÕES');
    this.isModalVisible = false;
    this.lockBodyScroll(false);
    // ✅ FIX: NÃO recarregar dados quando modal é fechado sem alterações
    // Removido: this.carregarFatores();
  }

  onRemoverFator(fator: MutResponse): void {
    // Funcionalidade de exclusão desabilitada conforme solicitado
    this.notificationService.info('Funcionalidade de exclusão temporariamente desabilitada.');
  }

  private rollbackDeletion(item: MutResponse, originalIndex: number): void {
    if (originalIndex >= 0 && originalIndex < this.fatoresMut.length) {
      this.fatoresMut.splice(originalIndex, 0, item);
    } else {
      this.fatoresMut.push(item);
    }
    
    this.totalItems = this.totalItems + 1;
    this.updateFilteredData();
    this.forceTableUpdate();
  }

  private handleDeletionError(error: any, itemName: string): void {
    const errorMessages = {
      400: `Não foi possível remover "${itemName}". Dados inválidos.`,
      403: `Você não tem permissão para remover "${itemName}".`,
      404: `O fator "${itemName}" não existe mais no servidor.`,
      409: `Não é possível remover "${itemName}" pois está sendo usado em cálculos.`,
      500: `Erro interno do servidor ao remover "${itemName}". Tente novamente.`
    };
    
    const message = errorMessages[error.status as keyof typeof errorMessages] || 
                   `Erro inesperado ao remover "${itemName}". Tente novamente.`;
    
    if (error.status === 404) {
      // Item doesn't exist anymore, don't rollback
      this.notificationService.warning(message);
      // Keep the item removed from UI since it doesn't exist on server
      this.fatoresMut = this.fatoresMut.filter(f => f.id !== parseInt(itemName, 10));
      this.updateFilteredData();
      this.forceTableUpdate();
    } else {
      this.notificationService.error(message);
    }
  }

  onModalSave(mutResponse: MutResponse): void {
    console.log('💾 MODAL SAVE - Resposta recebida:', mutResponse);
    this.isModalVisible = false;
    this.lockBodyScroll(false);
    
    // 🔥 OTIMIZAÇÃO: ATUALIZAR APENAS O ITEM ESPECÍFICO EM VEZ DE RECARREGAR TUDO
    if (this.modalMode === 'edit' && this.fatorSelecionado?.id) {
      // Modo edição: atualizar o item existente na lista
      const index = this.fatoresMut.findIndex(f => f.id === this.fatorSelecionado!.id);
      if (index !== -1) {
        // ✅ FIX: Garantir que a data de atualização seja preservada
        this.fatoresMut[index] = {
          ...mutResponse,
          // If dataAtualizacao is missing, set to now in ISO (but keep original format if provided)
          dataAtualizacao: mutResponse.dataAtualizacao || (new Date().toISOString())
        } as any;
        console.log('✅ Item atualizado na lista local com data de atualização');
        
        // Atualizar também as listas filtradas
        this.updateFilteredData();
        this.updatePaginatedData();
        this.forceTableUpdate(); // ✅ FIX: Forçar atualização da tabela
        
        // ✅ FIX: Mostrar notificação de sucesso
        this.notificationService.success('Fator MUT atualizado com sucesso!');
        return;
      }
    }
    
    // Para criação, adicionar o novo item à lista em vez de recarregar tudo
    if (this.modalMode === 'create') {
      console.log('➕ ADICIONANDO NOVO ITEM À LISTA...');
      this.fatoresMut.unshift(mutResponse); // Adicionar no início da lista
      this.updateFilteredData();
      this.updatePaginatedData();
      this.forceTableUpdate();
      
      // ✅ FIX: Mostrar notificação de sucesso
      this.notificationService.success('Fator MUT criado com sucesso!');
      return;
    }
    
    // Fallback: recarregar apenas se necessário
    console.log('🔄 RECARREGANDO DADOS DO BACKEND...');
    this.carregarFatores();
  }

  trackByFatorId(index: number, fator: MutResponse): number {
    return fator.id;
  }

  getTipoMudancaLabel(tipo: TipoMudanca): string {
    const labels: any = {
      [TipoMudanca.SOLO]: 'Solo',
      [TipoMudanca.VEGETACAO]: 'Vegetação',
      [TipoMudanca.DESMATAMENTO]: 'Desmatamento'
    };
    return labels[tipo] || (tipo as any);
  }

  getBiomaLabel(bioma: Bioma | undefined | null): string {
    if (!bioma) return '—';
    const labels: any = {
      [Bioma.AMAZONIA]: 'Amazônia',
      [Bioma.CAATINGA]: 'Caatinga',
      [Bioma.CERRADO]: 'Cerrado',
      [Bioma.MATA_ATLANTICA]: 'Mata Atlântica',
      [Bioma.PAMPA]: 'Pampa',
      [Bioma.PANTANAL]: 'Pantanal'
    };
    return labels[bioma] || (bioma as any);
  }

  getEscopoLabel(escopo: EscopoEnum): string {
    return escopo === EscopoEnum.ESCOPO1 ? 'Escopo 1' : 'Escopo 3';
  }

  /** Helpers para classes dinâmicas, evitando casts no template e null/undefined */
  private toKebab(value: unknown): string {
    return String(value ?? '').toLowerCase();
  }

  tipoClass(f: MutResponse | null | undefined): string {
    // Gera "tipo-solo" | "tipo-desmatamento" | "tipo-vegetacao"
    // Usa switch para ser robusto mesmo se os enums forem numéricos.
    switch (f?.tipoMudanca) {
      case TipoMudanca.SOLO: return 'tipo-solo';
      case TipoMudanca.DESMATAMENTO: return 'tipo-desmatamento';
      case TipoMudanca.VEGETACAO: return 'tipo-vegetacao';
      default: return 'tipo-';
    }
  }

  escopoClass(f: MutResponse | null | undefined): string {
    // Gera "escopo-escopo1" | "escopo-escopo3"
    switch (f?.escopo) {
      case EscopoEnum.ESCOPO1: return 'escopo-escopo1';
      case EscopoEnum.ESCOPO3: return 'escopo-escopo3';
      default: return 'escopo-';
    }
  }

  /** Linhas para a coluna "Detalhes" conforme o tipo - PADRÃO FIGMA */
  getResumoDetalhesList(f: MutResponse): { label: string; value: string }[] {
    const detalhes: { label: string; value: string }[] = [];
    if (!f) return [{ label: '', value: '—' }];

    const pushIf = (label: string, value?: string | number | null) => {
      const v = (value ?? '').toString().trim();
      if (v && v !== '—') detalhes.push({ label, value: v });
    };

    switch (f.tipoMudanca) {
      case TipoMudanca.SOLO: {
        const ds = f.dadosSolo?.[0];
        if (ds) {
          const anteriorPersist = ds.usoAnterior?.trim();
          const atualPersist = ds.usoAtual?.trim();

          if (anteriorPersist || atualPersist) {
            pushIf('Uso anterior', anteriorPersist || '—');
            pushIf('Uso atual', atualPersist || '—');
          } else {
            const descRaw = (ds.descricao || '').toString();
            const { anterior, atual } = this.extractUsoAnteriorAtual(descRaw);

            pushIf('Uso anterior', anterior || '—');
            pushIf('Uso atual', atual || '—');
          }

          if (ds.bioma) pushIf('Bioma', this.getBiomaLabel(ds.bioma));
        }
        break;
      }
      case TipoMudanca.DESMATAMENTO: {
        const d = f.dadosDesmatamento?.[0];
        if (d) {
          const ufs = (d.ufs && d.ufs.length) ? ` (${d.ufs.join(', ')})` : '';
          pushIf('Bioma', `${this.getBiomaLabel(d.bioma)}${ufs}`);
          pushIf('Fitofisionomia', d.nomeFitofisionomia);
          if (d.categoriaDesmatamento) pushIf('Categoria', d.categoriaDesmatamento);
        }
        break;
      }
      case TipoMudanca.VEGETACAO: {
        const d = f.dadosVegetacao?.[0];
        if (d) {
          if (Array.isArray(d.categoriasFitofisionomia) && d.categoriasFitofisionomia.length > 0) {
            pushIf('Categoria', d.categoriasFitofisionomia.join(', '));
          }
          pushIf('Parâmetro', d.parametro);
        }
        break;
      }
    }

    if (detalhes.length === 0) return [{ label: '', value: '—' }];
    return detalhes;
  }

  /** Extrai Uso anterior/atual de descrições com setas ou rótulos conforme regras do documento */
  private extractUsoAnteriorAtual(input: string): { anterior: string; atual: string } {
    const text = (input || '')
      .replace(/\s*[→➡➔]\s*/g, '->')      // normaliza setas comuns
      .replace(/\s+/g, ' ')
      .trim();

    // 1) Via rótulos explícitos
    const anteriorLabel = text.match(/uso\s*anterior\s*(?:[:–—-])\s*([^–—-]+?)(?:(?:\s*[–—-]\s*)|$)/i)?.[1] || '';
    const atualLabel    = text.match(/uso\s*atual\s*(?:[:–—-])\s*([^–—-]+?)(?:(?:\s*[–—-]\s*)|$)/i)?.[1] || '';
    if (anteriorLabel || atualLabel) {
      return {
        anterior: this.normalizeUsoTerm(anteriorLabel),
        atual: this.normalizeUsoTerm(atualLabel)
      };
    }

    // 2) Padrão "de X para Y" (documento)
    const dePara = text.match(/\bde\s+(.+?)\s+para\s+(.+?)(?:$|[.,;])/i);
    if (dePara) {
      return {
        anterior: this.normalizeUsoTerm(dePara[1]),
        atual: this.normalizeUsoTerm(dePara[2])
      };
    }

    // 3) Padrão genérico "X para Y" (sem "de")
    const para = text.match(/\b(.+?)\s+para\s+(.+?)(?:$|[.,;])/i);
    if (para) {
      return {
        anterior: this.normalizeUsoTerm(para[1]),
        atual: this.normalizeUsoTerm(para[2])
      };
    }

    // 4) Via seta (left -> right)
    const parts = text.split(/\s*->\s*/);
    if (parts.length === 2) {
      return {
        anterior: this.normalizeUsoTerm(parts[0]),
        atual: this.normalizeUsoTerm(parts[1])
      };
    }

    // 5) Separadores " - " ou " — " como fallback de seta
    const dash = text.split(/\s*[—–-]\s*/);
    if (dash.length === 2) {
      return {
        anterior: this.normalizeUsoTerm(dash[0]),
        atual: this.normalizeUsoTerm(dash[1])
      };
    }

    return { anterior: '', atual: '' };
  }

  /** Normaliza termos (remove referências, sufixos de solo e variações descritas na tabela) */
  private normalizeUsoTerm(term: string): string {
    const t = (term || '')
      // remove referências finais (ex.: (IPCC, 2019), (Maia et al., 2013))
      .replace(/\s*\([^)]*\)\s*$/g, '')
      // remove sufixos de tipo de solo
      .replace(/\s*-\s*Solo\s+\w+\b/gi, '')
      // normaliza variações citadas na tabela
      .replace(/Integração\s+lavoura-pecuária\(-floresta\)/gi, 'Integração lavoura-pecuária')
      .replace(/Pastagem\/?pastagem\s+melhorada/gi, 'Pastagem melhorada')
      .replace(/Melhorado\s+sem\s+uso\s+de\s+insumos/gi, 'Melhorado sem uso de insumos')
      .replace(/Melhorado\s+com\s+uso\s+de\s+insumos/gi, 'Melhorado com uso de insumos')
      .replace(/Cana-de-açúcar\s+com\s+queima/gi, 'Cana-de-açúcar com queima')
      .replace(/Cana-de-açúcar\s+sem\s+queima/gi, 'Cana-de-açúcar sem queima')
      // compacta espaços e remove pontuação terminal desnecessária
      .replace(/\s+/g, ' ')
      .replace(/[.,;]\s*$/g, '')
      .trim();
    return t;
  }

  private lockBodyScroll(lock: boolean) {
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  onMenuToggle(isOpen: boolean): void {
    this.isMenuOpen = isOpen;
  }

  onMenuItemClick(item: MenuItem): void {
    if (item.route) this.router.navigate([item.route]);
    this.isMenuOpen = false;
  }

  // Accessibility methods
  toggleHighContrast(): void {
    this.isHighContrast = !this.isHighContrast;
    if (this.accessibilityService && typeof this.accessibilityService.toggleHighContrast === 'function') {
      this.accessibilityService.toggleHighContrast();
    } else {
      // fallback: update body class immediately
      this.updateBodyClass('high-contrast', this.isHighContrast);
    }
  }

  toggleVLibras(): void {
    this.isVLibrasActive = !this.isVLibrasActive;
    if (this.accessibilityService && typeof this.accessibilityService.toggleVLibras === 'function') {
      this.accessibilityService.toggleVLibras();
    } else {
      // fallback: try to (re)initialize widget
      if (this.isVLibrasActive) this.initializeVLibras();
    }
  }

  get filtroEscopoDisplay(): string {
    return this.filtros.escopo ? this.getEscopoLabel(this.filtros.escopo) : 'Escopo';
  }

  get filtroTipoMudancaDisplay(): string {
    return this.filtros.tipoMudanca ? this.getTipoMudancaLabel(this.filtros.tipoMudanca) : 'Tipo de mudança';
  }

  get filtroBiomaDisplay(): string {
    return this.filtros.bioma ? this.getBiomaLabel(this.filtros.bioma) : 'Bioma';
  }

  get itemsPerPageDisplay(): string {
    return String(this.itemsPerPage);
  }

  get currentPageDisplay(): string {
    return String(this.currentPage);
  }

  trackByPage = (_: number, p: number) => p;

  getTipoFatorSoloLabel(tipoFatorSolo: string): string {
    const labels: { [key: string]: string } = {
      'CARBONO_ORGANICO': 'Carbono Orgânico',
      'DENSIDADE': 'Densidade', 
      'TEXTURA': 'Textura',
      'USO_ANTERIOR': 'Uso Anterior',
      'USO_ATUAL': 'Uso Atual'
    };
    return labels[tipoFatorSolo] || tipoFatorSolo || '—';
  }

  formatarData(dataArray: number[] | undefined): string {
    if (!dataArray || dataArray.length < 3) {
      return '—';
    }
    
    // dataArray format: [year, month, day, hour?, minute?, second?]
    const [year, month, day] = dataArray;
    const date = new Date(year, month - 1, day); // month is 0-indexed in JS Date
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  getDataAtualizacaoFormatada(fator: MutResponse): string {
    if (!fator.dataAtualizacao) return '—';
    
    // Se dataAtualizacao é um array [ano, mês, dia]
    if (Array.isArray(fator.dataAtualizacao) && fator.dataAtualizacao.length >= 3) {
      const [ano, mes, dia] = fator.dataAtualizacao as unknown as number[];
      return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
    }
    
    // Se dataAtualizacao é uma string
    if (typeof fator.dataAtualizacao === 'string') {
      try {
        const date = new Date(fator.dataAtualizacao);
        return date.toLocaleDateString('pt-BR');
      } catch {
        return fator.dataAtualizacao;
      }
    }
    
    return '—';
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Erro ao fazer logout:', error);
        this.notificationService.error(MESSAGES.MUT.ERRO.ERRO_LOGOUT);
      }
    });
  }

  // Ações dos filtros (setters + fecha dropdown)
  setEscopo(v: EscopoEnum | null): void {
    this.filtros.escopo = v ?? undefined;
    this.aplicarFiltros();
    this.isEscopoOpen = false;
  }

  setTipoMudanca(v: TipoMudanca | null): void {
    this.filtros.tipoMudanca = v ?? undefined;
    this.aplicarFiltros();
    this.isTipoMudancaOpen = false;
  }

  setBioma(v: Bioma | null): void {
    this.filtros.bioma = v ?? undefined;
    this.aplicarFiltros();
    this.isBiomaOpen = false;
  }

  // Ações da paginação (reutiliza seus métodos existentes)
  setItemsPerPage(n: number): void {
    this.changeItemsPerPage(n);
    this.isItemsPerPageOpen = false;
  }

  // Unified onSort (removed duplicated method)
  onSort(campo: string): void {
    if (this.sortField === campo) {
      this.sortDirection = this.sortDirection === 'ASC' ? 'DESC' : 'ASC';
    } else {
      this.sortField = campo;
      this.sortDirection = 'ASC';
    }
    
    this.campoOrdenacao = this.sortField;
    this.direcaoOrdenacao = this.sortDirection;
    
    this.currentPage = 1;
    this.carregarFatores();
  }

  getIconeOrdenacao(campo: string): string {
    if (this.sortField !== campo) {
      return 'fa-sort';
    }
    return this.sortDirection === 'ASC' ? 'fa-sort-up' : 'fa-sort-down';
  }

  // Método para exportar dados filtrados
  exportarDados(): void {
    if (!this.canManage) {
      this.notificationService.warning('Você não tem permissão para exportar dados.');
      return;
    }

    const filtrosExport = {
      ...this.filtros,
      termoBusca: this.termoBusca?.trim() || undefined,
      size: this.totalItems // Exportar todos os itens
    };

    this.mutService.listar(filtrosExport)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.exportarParaCSV(response.content);
        },
        error: (error) => {
          console.error('Erro ao exportar dados:', error);
          this.notificationService.error('Erro ao exportar dados.');
        }
      });
  }

  private exportarParaCSV(dados: MutResponse[]): void {
    if (!dados || dados.length === 0) {
      this.notificationService.warning('Nenhum dado para exportar.');
      return;
    }

    const headers = [
      'ID', 'Tipo de Mudança', 'Escopo', 'Bioma',
      'Fator CO2', 'Fator CH4', 'Fator N2O', 'Data Atualização'
    ];
    const csvContent = [
      headers.join(','),
      ...dados.map(fator => [
        fator.id,
        fator.tipoMudanca,
        fator.escopo,
        this.getBiomaFromFator(fator),
        this.getFatorCO2FromFator(fator),
        this.getFatorCH4FromFator(fator),
        this.getFatorN2OFromFator(fator),
        this.getDataAtualizacaoFormatada(fator)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `fatores-mut-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private getBiomaFromFator(fator: MutResponse): string {
    // Extrair bioma dos dados específicos
    if (fator.dadosDesmatamento && fator.dadosDesmatamento.length > 0) {
      return fator.dadosDesmatamento[0].bioma || '';
    }
    if (fator.dadosVegetacao && fator.dadosVegetacao.length > 0) {
      return fator.dadosVegetacao[0].bioma || '';
    }
    if (fator.dadosSolo && fator.dadosSolo.length > 0) {
      return fator.dadosSolo[0].bioma || '';
    }
    return '';
  }

  private getFatorCO2FromFator(fator: MutResponse): string {
    // Extrair fatorCO2 dos dados específicos
    if (fator.dadosDesmatamento && fator.dadosDesmatamento.length > 0 && fator.dadosDesmatamento[0].fatorCO2 !== undefined) {
      return fator.dadosDesmatamento[0].fatorCO2.toString();
    }
    if (fator.dadosVegetacao && fator.dadosVegetacao.length > 0 && fator.dadosVegetacao[0].fatorCO2 !== undefined) {
      return fator.dadosVegetacao[0].fatorCO2.toString();
    }
    if (fator.dadosSolo && fator.dadosSolo.length > 0 && fator.dadosSolo[0].fatorCO2 !== undefined) {
      return fator.dadosSolo[0].fatorCO2.toString();
    }
    return '';
  }

  private getFatorCH4FromFator(fator: MutResponse): string {
    // Extrair fatorCH4 dos dados específicos
    if (fator.dadosDesmatamento && fator.dadosDesmatamento.length > 0 && fator.dadosDesmatamento[0].fatorCH4 !== undefined) {
      return fator.dadosDesmatamento[0].fatorCH4.toString();
    }
    if (fator.dadosVegetacao && fator.dadosVegetacao.length > 0 && fator.dadosVegetacao[0].fatorCH4 !== undefined) {
      return fator.dadosVegetacao[0].fatorCH4.toString();
    }
    if (fator.dadosSolo && fator.dadosSolo.length > 0 && fator.dadosSolo[0].fatorCH4 !== undefined) {
      return fator.dadosSolo[0].fatorCH4.toString();
    }
    return '';
  }

  private getFatorN2OFromFator(fator: MutResponse): string {
    // Extrair fatorN2O dos dados específicos
    if (fator.dadosDesmatamento && fator.dadosDesmatamento.length > 0 && fator.dadosDesmatamento[0].fatorN2O !== undefined) {
      return fator.dadosDesmatamento[0].fatorN2O.toString();
    }
    if (fator.dadosVegetacao && fator.dadosVegetacao.length > 0 && fator.dadosVegetacao[0].fatorN2O !== undefined) {
      return fator.dadosVegetacao[0].fatorN2O.toString();
    }
    if (fator.dadosSolo && fator.dadosSolo.length > 0 && fator.dadosSolo[0].fatorN2O !== undefined) {
      return fator.dadosSolo[0].fatorN2O.toString();
    }
    return '';
  }

  // Método para normalizar texto removendo acentos e caracteres especiais
  private normalizarTexto(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais, mantém apenas letras, números e espaços
      .trim();
  }

  // Método para limpar busca
  limparBusca(): void {
    this.termoBusca = '';
    this.searchTerm = '';
    this.sugestoesBusca = [];
    this.searchSuggestions = [];
    this.mostrarSugestoes = false;
    this.showSuggestions = false;
    this.currentPage = 1;

    // restaura lista local imediatamente
    this.fatoresFiltrados = [...this.fatoresMut];
    this.updatePaginatedData();

    // e sincroniza com servidor sem travar UI
    if (this.searchSubject) {
      this.searchSubject.next('');
    } else {
      this.carregarFatores();
    }
  }

  // Método para aplicar filtro rápido
  aplicarFiltroRapido(tipo: 'todos' | 'solo' | 'vegetacao' | 'desmatamento'): void {
    switch (tipo) {
      case 'todos':
        this.filtros.tipoMudanca = undefined;
        break;
      case 'solo':
        this.filtros.tipoMudanca = TipoMudanca.SOLO;
        break;
      case 'vegetacao':
        this.filtros.tipoMudanca = TipoMudanca.VEGETACAO;
        break;
      case 'desmatamento':
        this.filtros.tipoMudanca = TipoMudanca.DESMATAMENTO;
        break;
    }
    this.aplicarFiltros();
  }

  setPage(p: number): void {
    this.changePage(p);
    this.isPageOpen = false;
  }
}
