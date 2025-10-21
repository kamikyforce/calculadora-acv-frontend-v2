import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { HamburgerMenuComponent, MenuItem } from '../../shared/components/hamburger-menu/hamburger-menu.component';
import { AuthService } from '../../core/services/auth.service';
import { BrLoadingComponent } from '../../shared/components/br-loading/br-loading.component';
import { AccessibilityService } from '../../core/services/accessibility.service';
import { NotificationService } from '../../core/services/notification.service';
import { STANDARD_MENU_ITEMS } from '../../shared/constants/menu-items';
import { IndustriaService, IndustriaResponse, IndustriaRequest, UsuarioIndustriaRequest, TipoIndustria, UsuarioAtivoInfo } from '../../core/services/industria.service';
import { AdministradorService } from '../../core/services/administrador.service';

interface Industria {
  id: number;
  cnpj: string;
  fazenda: string;
  dataCadastro: string;
  quantidadeInventarios: number;
  tipoIndustria: TipoIndustria;
  ativo: boolean;
  estado: string;
}

interface IndustriaForm {
  cnpj: string;
  fazenda: string;
  estado: string;
  tipoIndustria: TipoIndustria;
  ativo: boolean;
  quantidadeInventarios: number;
}

@Component({
  selector: 'app-industrias',
  standalone: true,
  imports: [CommonModule, FormsModule, HamburgerMenuComponent, BrLoadingComponent],
  templateUrl: './industrias.component.html',
  styleUrls: ['./industrias.component.scss']
})
export class IndustriasComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  isHighContrast = false;
  isVLibrasActive = false;

  readonly Math = Math;

  readonly TipoIndustria = TipoIndustria;

  get currentDateFormatted(): string {
    try {
      const date = new Date();
      if (isNaN(date.getTime())) {
        return '01/01/2024';
      }
      return date.toLocaleDateString('pt-BR');
    } catch (error) {
      console.error('Erro ao formatar data atual:', error);
      return '01/01/2024';
    }
  }

  // Loading states
  isLoading = false;
  loadingMessage = '';

  // Modal states
  showCreateModal = false;
  showEditModal = false;
  showDeleteModal = false;
  showCancelConfirmModal = false;
  showSaveConfirmModal = false;
  showCnpjExistsModal = false;
  showStatusConfirmModal = false;
  showUserErrorModal = false;
  showUserActiveModal = false;
  showUserInactiveAdminModal = false;
  showDeleteUserModal = false;
  showCpfExistsModal = false;
  showCpfNotFoundModal = false;
  showRequiredFieldsModal = false;
  requiredFieldsErrors: string[] = [];
  isEditMode = false;
  cpfExistsInfo: { cpf: string, nome: string, tipo: string } | null = null;

  // Selected item for operations
  selectedItem: Industria | null = null;
  pendingAction: 'cancel' | 'save' | 'status' | null = null;
  pendingStatusChange: { id: number; newStatus: boolean } | null = null;
  selectedUserIndex: number | null = null;

  // Form data
  novaIndustria: IndustriaForm = this.getInitialFormState();

  industriaUsers: any[] = [];
  originalIndustriaUsers: any[] = [];
  
  // Múltiplas linhas de usuários para preenchimento
  userRows: any[] = [];
  
  novoUsuario = {
    cpf: '',
    nome: '',
    dataCadastro: '',
    ativo: true
  };

  private initializeUserDate(): void {
    if (!this.novoUsuario.dataCadastro) {
      this.novoUsuario.dataCadastro = this.currentDateFormatted;
    }
  }
  
  isCpfLoading = false;
  isCpfVerificando = false;
  cpfJaExisteEmOutraIndustria = false;
  cpfNaoEncontrado = false;
  cpfInvalido = false;
  usuarioAtivoInfo: UsuarioAtivoInfo | null = null;
  pendingUserActivation: any = null;


  // Data arrays
  readonly estados = [
    { sigla: 'AC', nome: 'Acre' },
    { sigla: 'AL', nome: 'Alagoas' },
    { sigla: 'AP', nome: 'Amapá' },
    { sigla: 'AM', nome: 'Amazonas' },
    { sigla: 'BA', nome: 'Bahia' },
    { sigla: 'CE', nome: 'Ceará' },
    { sigla: 'DF', nome: 'Distrito Federal' },
    { sigla: 'ES', nome: 'Espírito Santo' },
    { sigla: 'GO', nome: 'Goiás' },
    { sigla: 'MA', nome: 'Maranhão' },
    { sigla: 'MT', nome: 'Mato Grosso' },
    { sigla: 'MS', nome: 'Mato Grosso do Sul' },
    { sigla: 'MG', nome: 'Minas Gerais' },
    { sigla: 'PA', nome: 'Pará' },
    { sigla: 'PB', nome: 'Paraíba' },
    { sigla: 'PR', nome: 'Paraná' },
    { sigla: 'PE', nome: 'Pernambuco' },
    { sigla: 'PI', nome: 'Piauí' },
    { sigla: 'RJ', nome: 'Rio de Janeiro' },
    { sigla: 'RN', nome: 'Rio Grande do Norte' },
    { sigla: 'RS', nome: 'Rio Grande do Sul' },
    { sigla: 'RO', nome: 'Rondônia' },
    { sigla: 'RR', nome: 'Roraima' },
    { sigla: 'SC', nome: 'Santa Catarina' },
    { sigla: 'SP', nome: 'São Paulo' },
    { sigla: 'SE', nome: 'Sergipe' },
    { sigla: 'TO', nome: 'Tocantins' }
  ];

  // Campo tipo de indústria removido temporariamente

  readonly menuItems: MenuItem[] = STANDARD_MENU_ITEMS.map(item => ({
    ...item,
    active: item.id === 'industrias'
  }));

  // Table data
  industrias: Industria[] = [];
  filteredIndustrias: Industria[] = [];

  // UI state
  isMenuOpen = false;
  searchTerm = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;

  private readonly accessibilityService = inject(AccessibilityService);
  private readonly notificationService = inject(NotificationService);

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly industriaService: IndustriaService,
    private readonly administradorService: AdministradorService
  ) {
    // Subscribe to accessibility states
    this.accessibilityService.isHighContrast$.subscribe(state => {
      this.isHighContrast = state;
    });

    this.accessibilityService.isVLibrasActive$.subscribe(state => {
      this.isVLibrasActive = state;
    });
  }

  ngOnInit(): void {
    this.carregarIndustrias();
    this.initializeUserDate();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Helper methods for initial states
  private getInitialFormState(): IndustriaForm {
    return {
      cnpj: '',
      fazenda: '',
      estado: 'SP',
      tipoIndustria: TipoIndustria.INDUSTRIA,
      ativo: true,
      quantidadeInventarios: 0
    };
  }

  // Método para detectar mudanças no status da indústria
  onIndustriaStatusChange(): void {
    if (!this.novaIndustria.ativo) {
      // Se a indústria foi marcada como inativa, desativar todos os usuários
      this.industriaUsers.forEach(user => {
        user.ativo = false;
      });
      this.userRows.forEach(row => {
        row.ativo = false;
      });
    }
  }

  // Método setLoading que estava faltando
  private setLoading(loading: boolean, message: string = ''): void {
    this.isLoading = loading;
    this.loadingMessage = message;
  }

  // Método updateFilteredData que estava faltando
  private updateFilteredData(): void {
    this.filteredIndustrias = this.industrias.filter(industria => {
      const matchesSearch = !this.searchTerm ||
        industria.fazenda.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        industria.cnpj.includes(this.searchTerm) ||
        industria.estado.toLowerCase().includes(this.searchTerm.toLowerCase());

      return matchesSearch;
    });

    this.totalItems = this.filteredIndustrias.length;
    this.currentPage = 1;
  }

  // Métodos de modal que estavam faltando
  openCreateModal(): void {
    this.selectedItem = null;
    this.novaIndustria = this.getInitialFormState();
    this.industriaUsers = [];
    this.originalIndustriaUsers = [];
    this.userRows = [];
    this.resetUserForm();
    this.resetCPFValidation();
    // Inicializar com uma linha vazia para usuários
    this.addUserRow();
    this.showCreateModal = true;
    this.isEditMode = false;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.resetForm();
    this.userRows = []; // Limpar linhas de usuário
  }

  confirmCloseCreateModal(): void {
    this.pendingAction = 'cancel';
    this.showCancelConfirmModal = true;
  }

  confirmSubmitCreate(): void {
    // Verificar se CNPJ já existe em indústrias
    if (this.checkCnpjExists(this.novaIndustria.cnpj)) {
      this.showCnpjExistsModal = true;
      return;
    }
    
    // Processar todas as linhas de usuários antes de validar
    this.processAllUserRows();
    
    // Verificar se tem pelo menos um usuário válido após processar
    if (!this.industriaUsers || this.industriaUsers.length === 0) {
      this.showUserErrorModal = true;
      return;
    }
    
    this.pendingAction = 'save';
    this.showSaveConfirmModal = true;
  }

  checkCnpjExists(cnpj: string): boolean {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    return this.industrias.some(industria => 
      industria.cnpj.replace(/\D/g, '') === cnpjLimpo
    );
  }

  closeCancelConfirmModal(): void {
    this.showCancelConfirmModal = false;
    this.pendingAction = null;
  }

  closeSaveConfirmModal(): void {
    this.showSaveConfirmModal = false;
    this.pendingAction = null;
  }

  closeCnpjExistsModal(): void {
    this.showCnpjExistsModal = false;
  }

  closeStatusConfirmModal(): void {
    this.showStatusConfirmModal = false;
    this.pendingAction = null;
    this.pendingStatusChange = null;
  }

  closeUserErrorModal(): void {
    this.showUserErrorModal = false;
  }

  closeUserActiveModal(): void {
    this.showUserActiveModal = false;
    this.usuarioAtivoInfo = null;
    this.pendingUserActivation = null;
  }

  closeUserInactiveAdminModal(): void {
    this.showUserInactiveAdminModal = false;
    this.pendingUserActivation = null;
  }

  openDeleteUserModal(index: number): void {
    this.selectedUserIndex = index;
    this.showDeleteUserModal = true;
  }

  closeDeleteUserModal(): void {
    this.showDeleteUserModal = false;
    this.selectedUserIndex = null;
  }

  closeCpfExistsModal(): void {
    this.showCpfExistsModal = false;
    this.cpfExistsInfo = null;
  }

  closeCpfNotFoundModal(): void {
    this.showCpfNotFoundModal = false;
  }

  closeRequiredFieldsModal(): void {
    this.showRequiredFieldsModal = false;
    this.requiredFieldsErrors = [];
  }

  confirmDeleteUser(): void {
    if (this.selectedUserIndex !== null) {
      this.industriaUsers.splice(this.selectedUserIndex, 1);
      this.closeDeleteUserModal();
    }
  }

  forceAddUser(): void {
    // Fechar o modal de alerta
    this.showUserActiveModal = false;
    this.usuarioAtivoInfo = null;
    
    // Adicionar o usuário mesmo com o conflito
    this.adicionarUsuarioALista();
  }



  forceActivateUser(): void {
    // Fechar o modal de alerta
    this.showUserActiveModal = false;
    
    // Encontrar o usuário que estava sendo ativado e forçar a ativação
    if (this.pendingUserActivation) {
      this.pendingUserActivation.ativo = true;
      this.pendingUserActivation = null;
    }
    
    this.usuarioAtivoInfo = null;
  }

  confirmCancel(): void {
    if (this.showCreateModal) {
      this.closeCreateModal();
    } else if (this.showEditModal) {
      this.closeEditModal();
    }
    this.closeCancelConfirmModal();
  }

  confirmSave(): void {
    const wasEditMode = this.isEditMode;
    this.closeSaveConfirmModal();
    if (wasEditMode) {
      this.onSubmitEditForm();
    } else {
      this.onSubmitCreateForm();
    }
  }

  openEditModal(industria: Industria): void {
    this.selectedItem = industria;
    this.showEditModal = true;
    this.isEditMode = true;
    this.novaIndustria = {
      cnpj: this.getFormattedCNPJ(industria.cnpj),
      fazenda: industria.fazenda,
      estado: industria.estado,
      tipoIndustria: industria.tipoIndustria,
      ativo: industria.ativo,
      quantidadeInventarios: industria.quantidadeInventarios
    };
    // Inicializar com uma linha vazia para usuários
    this.addUserRow();
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedItem = null;
    this.isEditMode = false;
    // Não resetar o form automaticamente para preservar os dados dos usuários
    this.novaIndustria = this.getInitialFormState();
    this.industriaUsers = [];
    this.originalIndustriaUsers = [];
    this.userRows = []; // Limpar linhas de usuário
    this.resetUserForm();
  }

  confirmCloseEditModal(): void {
    this.pendingAction = 'cancel';
    this.showCancelConfirmModal = true;
  }

  confirmSubmitEdit(): void {
    // Verificar se CNPJ já existe em indústrias (exceto o próprio)
    if (this.checkCnpjExistsForEdit(this.novaIndustria.cnpj, this.selectedItem?.id)) {
      this.showCnpjExistsModal = true;
      return;
    }
    
    // Verificar se CNPJ já existe em certificadoras
    const cnpjLimpo = this.novaIndustria.cnpj.replace(/\D/g, '');
    this.industriaService.verificarCnpjExisteEmCertificadora(cnpjLimpo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (existeEmCertificadora) => {
          if (existeEmCertificadora) {
            this.notificationService.error('O usuário em questão já se encontra ativo em outro segmento do sistema.');
            return;
          }
          
          // Processar todas as linhas de usuários antes de validar
          this.processAllUserRows();
          
          // Verificar se tem pelo menos um usuário válido após processar
          if (!this.industriaUsers || this.industriaUsers.length === 0) {
            this.showUserErrorModal = true;
            return;
          }
          
          this.pendingAction = 'save';
          this.showSaveConfirmModal = true;
        },
        error: () => {
          // Em caso de erro na verificação, continua com o fluxo normal
          // Processar todas as linhas de usuários antes de validar
          this.processAllUserRows();
          
          // Verificar se tem pelo menos um usuário válido após processar
          if (!this.industriaUsers || this.industriaUsers.length === 0) {
            this.showUserErrorModal = true;
            return;
          }
          
          this.pendingAction = 'save';
          this.showSaveConfirmModal = true;
        }
      });
  }

  checkCnpjExistsForEdit(cnpj: string, currentId?: number): boolean {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    return this.industrias.some(industria => 
      industria.cnpj.replace(/\D/g, '') === cnpjLimpo && industria.id !== currentId
    );
  }

  openDeleteModal(industria: Industria): void {
    this.selectedItem = industria;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.selectedItem = null;
  }

  // Data loading
  carregarIndustrias(): void {
    this.setLoading(true, 'Carregando indústrias...');

    this.industriaService.listar()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: IndustriaResponse[]) => {
          this.industrias = response.map(item => this.mapResponseToIndustria(item));
          this.updateFilteredData();
          this.setLoading(false);
        },
        error: (error) => {
          this.setLoading(false);
          this.notificationService.handleHttpError(error);
        }
      });
  }

  private mapResponseToIndustria(response: IndustriaResponse): Industria {
    return {
      id: response.id,
      cnpj: response.cnpj,
      fazenda: response.nome,
      dataCadastro: this.formatDateFromBackend(response.dataCadastro),
      quantidadeInventarios: response.inventariosTratados,
      tipoIndustria: response.tipo,
      ativo: response.ativo,
      estado: response.estado
    };
  }

  private formatDateFromBackend(dateString: string): string {
    if (!dateString) {
      return new Date().toLocaleDateString('pt-BR');
    }
    return dateString;
  }

  onSubmitCreate(): void {
    if (!this.isFormValid()) {
      return;
    }

    // Verificar se tem pelo menos um usuário (já processado na confirmação)
    if (!this.industriaUsers || this.industriaUsers.length === 0) {
      this.showUserErrorModal = true;
      return;
    }

    this.setLoading(true, 'Criando indústria...');

    const usuarios = this.industriaUsers.map(user => ({
      cpf: user.cpf.replace(/\D/g, ''),
      nome: user.nome,
      dataCadastro: user.dataCadastro,
      ativo: user.ativo
    }));

    const createRequest: IndustriaRequest = {
      nome: this.novaIndustria.fazenda,
      cnpj: this.novaIndustria.cnpj.replace(/\D/g, ''),
      estado: this.novaIndustria.estado,
      tipo: this.novaIndustria.tipoIndustria,
      ativo: this.novaIndustria.ativo,
      inventariosTratados: this.novaIndustria.quantidadeInventarios,
      usuarios: usuarios
    };

    this.industriaService.criar(createRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: IndustriaResponse) => {
          const novaIndustria = this.mapResponseToIndustria(response);
          this.industrias.unshift(novaIndustria);
          this.updateFilteredData();
          this.closeCreateModal();
          this.setLoading(false);
          this.notificationService.success('Indústria criada com sucesso!');
        },
        error: (error) => {
          this.setLoading(false);
          this.notificationService.handleHttpError(error);
        }
      });
  }

  onSubmitEdit(): void {
    if (!this.selectedItem || !this.isFormValid()) {
      return;
    }

    // Verificar se tem pelo menos um usuário (já processado na confirmação)
    if (!this.industriaUsers || this.industriaUsers.length === 0) {
      this.showUserErrorModal = true;
      return;
    }

    // Se a indústria está sendo desativada (estava ativa e agora está inativa), desativar todos os usuários
    if (this.selectedItem.ativo && !this.novaIndustria.ativo) {
      this.industriaUsers.forEach(user => {
        user.ativo = false;
      });
      this.userRows.forEach(row => {
        row.ativo = false;
      });
    }

    this.setLoading(true, 'Atualizando indústria...');

    const usuarios = this.industriaUsers.map(user => ({
      cpf: user.cpf.replace(/\D/g, ''),
      nome: user.nome,
      dataCadastro: user.dataCadastro,
      ativo: user.ativo
    }));

    const updateRequest: IndustriaRequest = {
      nome: this.novaIndustria.fazenda,
      cnpj: this.novaIndustria.cnpj.replace(/\D/g, ''),
      estado: this.novaIndustria.estado,
      tipo: this.novaIndustria.tipoIndustria,
      ativo: this.novaIndustria.ativo,
      inventariosTratados: this.novaIndustria.quantidadeInventarios,
      usuarios: usuarios
    };

    this.industriaService.atualizar(this.selectedItem.id, updateRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: IndustriaResponse) => {
          const index = this.industrias.findIndex(ind => ind.id === this.selectedItem!.id);
          if (index !== -1) {
            this.industrias[index] = this.mapResponseToIndustria(response);
            this.updateFilteredData();
          }
          this.setLoading(false);
          this.closeEditModal();
          this.notificationService.success('Indústria atualizada com sucesso!');
        },
        error: (error) => {
          this.setLoading(false);
          this.notificationService.handleHttpError(error);
        }
      });
  }

  confirmarDelecao(): void {
    if (!this.selectedItem) {
      return;
    }

    this.setLoading(true, 'Excluindo indústria...');

    this.industriaService.deletar(this.selectedItem.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.industrias = this.industrias.filter(ind => ind.id !== this.selectedItem!.id);
          this.updateFilteredData();
          this.closeDeleteModal();
          this.setLoading(false);
          this.notificationService.success('Indústria excluída com sucesso!');
        },
        error: () => {
          this.setLoading(false);
        }
      });
  }

  toggleStatus(id: number): void {
    const industria = this.industrias.find(ind => ind.id === id);
    if (!industria) {
      return;
    }

    const novoStatus = !industria.ativo;
    this.selectedItem = industria;
    this.pendingStatusChange = { id, newStatus: novoStatus };
    this.pendingAction = 'status';
    this.showStatusConfirmModal = true;
  }

  confirmStatusChange(): void {
    if (!this.pendingStatusChange) {
      return;
    }

    const { id, newStatus } = this.pendingStatusChange;
    const industria = this.industrias.find(ind => ind.id === id);
    if (!industria) {
      return;
    }

    const operacao = newStatus ? this.industriaService.ativar(id) : this.industriaService.desativar(id);

    this.setLoading(true, `${newStatus ? 'Ativando' : 'Desativando'} indústria...`);

    operacao
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          industria.ativo = newStatus;
          this.updateFilteredData();
          this.setLoading(false);
          this.notificationService.success(`Indústria ${newStatus ? 'ativada' : 'desativada'} com sucesso!`);
          this.closeStatusConfirmModal();
        },
        error: (error) => {
          this.setLoading(false);
          this.closeStatusConfirmModal();
          this.notificationService.handleHttpError(error);
        }
      });
  }

  private isFormValid(): boolean {
    const { cnpj, fazenda, estado, tipoIndustria, quantidadeInventarios } = this.novaIndustria;
    this.requiredFieldsErrors = [];
    
    if (!fazenda.trim()) {
      this.requiredFieldsErrors.push('Nome da fazenda');
    }
    
    if (!cnpj.trim() || cnpj.replace(/\D/g, '').length !== 14) {
      this.requiredFieldsErrors.push('CNPJ válido (14 dígitos)');
    }
    
    if (!estado) {
      this.requiredFieldsErrors.push('Estado');
    }
    
    if (!Object.values(TipoIndustria).includes(tipoIndustria)) {
      this.requiredFieldsErrors.push('Tipo de indústria');
    }
    
    if (this.requiredFieldsErrors.length > 0) {
      this.showRequiredFieldsModal = true;
      return false;
    }
    
    return true;
  }

  // Método de busca
  onSearch(): void {
    this.updateFilteredData();
  }

  // Formatting methods
  formatCNPJ(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (!target) return;

    const cleaned = target.value.replace(/\D/g, '');
    const formatted = cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');

    target.value = formatted;
    this.novaIndustria.cnpj = formatted;
  }

  getFormattedCNPJ(cnpj: string): string {
    const cleaned = cnpj.replace(/\D/g, '');
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  formatCPFDisplay(cpf: string): string {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length === 11) {
      return cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cpf;
  }

  // Pagination
  get paginatedData(): Industria[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredIndustrias.slice(startIndex, endIndex);
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  changeItemsPerPage(items: number): void {
    this.itemsPerPage = items;
    this.currentPage = 1;
  }

  // Form reset
  resetForm(): void {
    this.novaIndustria = this.getInitialFormState();
    this.selectedItem = null;
    this.industriaUsers = [];
    this.originalIndustriaUsers = [];
    this.userRows = []; // Limpar as linhas de usuários
    this.resetUserForm();
  }

  // Logout
  logout(): void {
    this.authService.logout()
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  // Accessibility methods
  toggleHighContrast(): void {
    this.accessibilityService.toggleHighContrast();
  }

  toggleVLibras(): void {
    this.accessibilityService.toggleVLibras();
  }

  // Menu methods
  onMenuToggle(isOpen: boolean): void {
    this.isMenuOpen = isOpen;
  }

  onMenuItemClick(menuItem: MenuItem): void {
    if (menuItem.route) {
      this.router.navigate([menuItem.route]);
    }
    this.isMenuOpen = false;
  }

  // Action methods for table buttons
  editarIndustria(id: number): void {
    const industria = this.industrias.find(ind => ind.id === id);
    if (!industria) {
      console.error('Indústria não encontrada:', id);
      return;
    }

    this.isEditMode = true;

    this.selectedItem = industria;
    this.novaIndustria = {
      cnpj: this.getFormattedCNPJ(industria.cnpj),
      fazenda: industria.fazenda,
      estado: industria.estado,
      tipoIndustria: industria.tipoIndustria,
      ativo: industria.ativo,
      quantidadeInventarios: industria.quantidadeInventarios
    };
    
    this.resetCPFValidation();
    
    this.setLoading(true, 'Carregando usuários da indústria...');
    this.industriaService.buscarUsuarios(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (usuarios: UsuarioIndustriaRequest[]) => {
          this.industriaUsers = usuarios.map(user => ({
            cpf: this.formatCPFDisplay(user.cpf),
            nome: user.nome,
            dataCadastro: user.dataCadastro || new Date().toLocaleDateString('pt-BR'),
            ativo: user.ativo !== undefined ? user.ativo : true
          }));
          this.originalIndustriaUsers = [...this.industriaUsers];
          this.setLoading(false);
          this.isEditMode = true;
          this.showEditModal = true;
        },
        error: () => {
          this.industriaUsers = [];
          this.originalIndustriaUsers = [];
          this.setLoading(false);
          this.showEditModal = true;
        }
      });
  }

  excluirIndustria(id: number): void {
    const industria = this.industrias.find(ind => ind.id === id);
    if (industria) {
      this.openDeleteModal(industria);
    }
  }

  // Confirm delete method for modal
  confirmDelete(): void {
    this.confirmarDelecao();
  }

  formatCPFInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    
    if (value.length <= 11) {
      value = value.replace(/(\d{3})(\d)/, '$1.$2');
      value = value.replace(/(\d{3})(\d)/, '$1.$2');
      value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    
    this.novoUsuario.cpf = value;
    
    if (value.length === 14) {
      this.cpfInvalido = false;
      this.validateCPF(value);
    } else {
      this.resetCPFValidation();
    }
  }

  private validateCPF(cpf: string): void {
    if (cpf.length < 14) {
      this.resetCPFValidation();
      return;
    }

    const cpfNumerico = cpf.replace(/\D/g, '');
    
    // Primeiro verificar se o CPF já existe na lista atual de usuários
    const cpfJaExisteNaLista = this.industriaUsers.some(user => {
      const userCpfNumerico = user.cpf.replace(/\D/g, '');
      return userCpfNumerico === cpfNumerico;
    });

    if (cpfJaExisteNaLista) {
      this.cpfExistsInfo = {
        cpf: this.formatCPFDisplay(cpfNumerico),
        nome: this.novoUsuario.nome || 'Usuário já presente na lista',
        tipo: 'indústria atual'
      };
      this.showCpfExistsModal = true;
      // Limpar o formulário
      this.novoUsuario.cpf = '';
      this.novoUsuario.nome = '';
      this.novoUsuario.dataCadastro = '';
      return;
    }

    this.isCpfVerificando = true;
    this.cpfJaExisteEmOutraIndustria = false;
    this.cpfNaoEncontrado = false;

    const cpfFormatado = this.formatCPFDisplay(cpfNumerico);

    // Verificar se o CPF existe em certificadoras
    this.industriaService.verificarCpfExisteEmCertificadora(cpfNumerico)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (existeEmCertificadora) => {
          if (existeEmCertificadora) {
            this.notificationService.error('O usuário em questão já se encontra ativo em outro segmento do sistema.');
            this.resetCPFValidation();
            return;
          }

          // Se não existe em certificadoras, continuar com a validação normal
          this.continuarValidacaoCPF(cpfNumerico);
        },
        error: () => {
          this.resetCPFValidation();
        }
      });
  }

  private continuarValidacaoCPF(cpfNumerico: string): void {
    const foiRemovidoLocalmente = this.originalIndustriaUsers.some(user => 
      user.cpf.replace(/\D/g, '') === cpfNumerico
    ) && !this.industriaUsers.some(user => 
      user.cpf.replace(/\D/g, '') === cpfNumerico
    );

    if (foiRemovidoLocalmente) {
      this.industriaService.buscarUsuarioPorCpf(cpfNumerico)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (usuario) => {
            if (usuario) {
              this.novoUsuario.nome = usuario.nome;
              this.novoUsuario.dataCadastro = new Date().toLocaleDateString('pt-BR');
              this.cpfNaoEncontrado = false;
            } else {
              this.showCpfNotFoundModal = true;
              this.novoUsuario.nome = '';
              this.novoUsuario.dataCadastro = '';
            }
            this.isCpfVerificando = false;
          },
          error: () => {
            this.showCpfNotFoundModal = true;
            this.novoUsuario.nome = '';
            this.novoUsuario.dataCadastro = '';
            this.isCpfVerificando = false;
          }
        });
      return;
    }

    const industriaId = this.selectedItem?.id;
    this.industriaService.verificarCpfExisteEmOutraIndustria(cpfNumerico, industriaId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response && response.existe) {
            // Mostrar modal de CPF existente
             this.cpfExistsInfo = {
               cpf: cpfNumerico,
               nome: response.nome || 'Indústria não identificada',
               tipo: response.tipo || 'indústria'
             };
            this.showCpfExistsModal = true;
            this.isCpfVerificando = false;
            // Limpar o CPF do formulário
            this.novoUsuario.cpf = '';
            this.novoUsuario.nome = '';
            this.novoUsuario.dataCadastro = '';
            return;
          }

          this.industriaService.buscarUsuarioPorCpf(cpfNumerico)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (usuario) => {
                if (usuario) {
                  this.novoUsuario.nome = usuario.nome;
                  this.novoUsuario.dataCadastro = new Date().toLocaleDateString('pt-BR');
                  this.cpfNaoEncontrado = false;
                } else {
                  this.showCpfNotFoundModal = true;
                  this.novoUsuario.nome = '';
                  this.novoUsuario.dataCadastro = '';
                }
                this.isCpfVerificando = false;
              },
              error: () => {
                this.showCpfNotFoundModal = true;
                this.novoUsuario.nome = '';
                this.novoUsuario.dataCadastro = '';
                this.isCpfVerificando = false;
              }
            });
        },
        error: () => {
          this.isCpfVerificando = false;
        }
      });
  }

  private resetCPFValidation(): void {
    this.isCpfVerificando = false;
    this.cpfJaExisteEmOutraIndustria = false;
    this.cpfNaoEncontrado = false;
    this.cpfInvalido = false;
  }



  onSubmitCreateForm(): void {
    // Chamar o método de criação real
    this.onSubmitCreate();
  }

  onSubmitEditForm(): void {
    // Chamar o método de edição real
    this.onSubmitEdit();
  }

  // Adicionar nova linha de usuário
  addUserRow(): void {
    this.userRows.push({
      cpf: '',
      nome: '',
      dataCadastro: this.currentDateFormatted,
      ativo: true,
      isCpfLoading: false,
      isCpfVerificando: false,
      cpfJaExisteEmOutraIndustria: false,
      cpfNaoEncontrado: false,
      cpfInvalido: false
    });
  }

  // Verificar se pode adicionar nova linha (última linha deve estar preenchida)
  canAddNewRow(): boolean {
    if (this.userRows.length === 0) {
      return true;
    }
    const lastRow = this.userRows[this.userRows.length - 1];
    return lastRow.cpf.trim() !== '' && lastRow.nome.trim() !== '';
  }

  // Processar todas as linhas de usuários ao confirmar
  processAllUserRows(): void {
    const validRows = this.userRows.filter(row => 
      row.cpf.trim() !== '' && 
      row.nome.trim() !== '' && 
      !row.cpfJaExisteEmOutraIndustria && 
      !row.cpfInvalido
    );

    // Verificar CPFs duplicados entre as linhas válidas
    const cpfsProcessados = new Set<string>();
    const cpfsDuplicados = new Set<string>();
    
    validRows.forEach(row => {
      const cpfNumerico = row.cpf.replace(/\D/g, '');
      if (cpfsProcessados.has(cpfNumerico)) {
        cpfsDuplicados.add(cpfNumerico);
      } else {
        cpfsProcessados.add(cpfNumerico);
      }
    });

    // Verificar CPFs duplicados com usuários já existentes na lista
    validRows.forEach(row => {
      const cpfNumerico = row.cpf.replace(/\D/g, '');
      const cpfJaExisteNaLista = this.industriaUsers.some(user => {
        const userCpfNumerico = user.cpf.replace(/\D/g, '');
        return userCpfNumerico === cpfNumerico;
      });
      
      if (cpfJaExisteNaLista) {
        cpfsDuplicados.add(cpfNumerico);
      }
    });

    // Se houver CPFs duplicados, mostrar modal de erro
    if (cpfsDuplicados.size > 0) {
      const cpfsDuplicadosFormatados = Array.from(cpfsDuplicados).map(cpf => this.formatCPFDisplay(cpf));
      this.cpfExistsInfo = {
        cpf: cpfsDuplicadosFormatados.join(', '),
        nome: 'Múltiplos usuários',
        tipo: 'indústria atual'
      };
      this.showCpfExistsModal = true;
      return;
    }

    // Adicionar usuários válidos à lista principal
    validRows.forEach(row => {
      const cpfFormatado = this.formatCPFDisplay(row.cpf.replace(/\D/g, ''));
      this.industriaUsers.push({
        cpf: cpfFormatado,
        nome: row.nome,
        dataCadastro: row.dataCadastro,
        ativo: row.ativo
      });
    });

    // Limpar as linhas após processar
    this.userRows = [];
  }

  addUser(): void {
    if (!this.novoUsuario.cpf || !this.novoUsuario.nome) {
      this.showUserErrorModal = true;
      return;
    }

    const cpfNumerico = this.novoUsuario.cpf.replace(/\D/g, '');
    const industriaId = this.selectedItem?.id || undefined;

    console.log('DEBUG addUser - CPF:', cpfNumerico, 'IndustriaId:', industriaId, 'IsEditMode:', this.isEditMode);

    // Primeiro verificar se o usuário está inativo no administrador
    this.administradorService.verificarUsuarioInativoAdministrador(cpfNumerico)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (isInativo) => {
          if (isInativo) {
            // Usuário está inativo no administrador, mostrar modal de alerta
            this.showUserInactiveAdminModal = true;
            return;
          }

          // Usuário não está inativo no administrador, verificar se está ativo em outro local
          this.industriaService.verificarUsuarioAtivoEmOutroLocal(cpfNumerico, industriaId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (info) => {
                if (info) {
                  // Usuário está ativo em outro local, mostrar modal de alerta
                  this.usuarioAtivoInfo = info;
                  this.showUserActiveModal = true;
                  return;
                }

                // Usuário não está ativo em outro local, pode adicionar
                this.adicionarUsuarioALista();
              },
              error: (error) => {
                console.error('Erro ao verificar usuário ativo em outro local:', error);
                // Em caso de erro, permitir adicionar o usuário
                this.adicionarUsuarioALista();
              }
            });
        },
        error: (error) => {
          console.error('Erro ao verificar usuário inativo no administrador:', error);
          // Em caso de erro, continuar com a verificação de usuário ativo em outro local
          this.industriaService.verificarUsuarioAtivoEmOutroLocal(cpfNumerico, industriaId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (info) => {
                if (info) {
                  this.usuarioAtivoInfo = info;
                  this.showUserActiveModal = true;
                  return;
                }
                this.adicionarUsuarioALista();
              },
              error: (error) => {
                console.error('Erro ao verificar usuário ativo em outro local:', error);
                this.adicionarUsuarioALista();
              }
            });
        }
      });
  }

  private adicionarUsuarioALista(): void {
    const cpfNumerico = this.novoUsuario.cpf.replace(/\D/g, '');
    const cpfFormatado = this.formatCPFDisplay(cpfNumerico);

    // Verificar se o CPF já existe na lista atual de usuários
    const cpfJaExiste = this.industriaUsers.some(user => {
      const userCpfNumerico = user.cpf.replace(/\D/g, '');
      return userCpfNumerico === cpfNumerico;
    });

    if (cpfJaExiste) {
      this.cpfExistsInfo = {
        cpf: cpfFormatado,
        nome: this.novoUsuario.nome,
        tipo: 'indústria atual'
      };
      this.showCpfExistsModal = true;
      return;
    }

    this.industriaUsers.push({
      cpf: cpfFormatado,
      nome: this.novoUsuario.nome,
      dataCadastro: this.novoUsuario.dataCadastro || new Date().toLocaleDateString('pt-BR'),
      ativo: this.novoUsuario.ativo
    });

    this.resetUserForm();
  }

  removeUser(index: number): void {
    this.openDeleteUserModal(index);
  }

  onUserStatusChange(user: any, event: any): void {
    const isBeingActivated = event.target.checked;
    
    // Se o usuário está sendo ativado (de inativo para ativo), verificar restrições
    if (isBeingActivated) {
      const cpfNumerico = user.cpf.replace(/\D/g, '');
      const industriaId = this.selectedItem?.id || undefined;
      
      console.log('DEBUG onUserStatusChange - CPF:', cpfNumerico, 'IndustriaId:', industriaId, 'IsEditMode:', this.isEditMode);
      
      // Primeiro, verificar se o usuário está inativo no administrador
      this.administradorService.verificarUsuarioInativoAdministrador(cpfNumerico)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (usuarioInativoAdmin) => {
            if (usuarioInativoAdmin) {
              // Usuário está inativo no administrador, reverter o status e mostrar modal de alerta
              user.ativo = false;
              this.pendingUserActivation = user;
              this.showUserInactiveAdminModal = true;
              return;
            }
            
            // Se não está inativo no administrador, verificar se está ativo em outro local
            this.industriaService.verificarUsuarioAtivoEmOutroLocal(cpfNumerico, industriaId)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (info) => {
                   if (info) {
                     // Usuário está ativo em outro local, reverter o status e mostrar modal de alerta
                     user.ativo = false;
                     this.pendingUserActivation = user;
                     this.usuarioAtivoInfo = info;
                     this.showUserActiveModal = true;
                     return;
                   }
                   
                   // Usuário não está ativo em outro local, pode ativar
                   user.ativo = true;
                 },
                error: (error) => {
                  console.error('Erro ao verificar usuário ativo em outro local:', error);
                  // Em caso de erro na verificação, reverter o status por segurança
                  user.ativo = false;
                  console.error('Erro ao verificar se o usuário já está ativo em outro local. Tente novamente.');
                }
              });
           },
          error: (error) => {
            console.error('Erro ao verificar usuário inativo no administrador:', error);
            // Em caso de erro na verificação, reverter o status por segurança
            user.ativo = false;
            console.error('Erro ao verificar se o usuário está inativo no administrador. Tente novamente.');
          }
        });
    }
    // Se está sendo desativado, não precisa verificar nada
  }

  private resetUserForm(): void {
    this.novoUsuario = {
      cpf: '',
      nome: '',
      dataCadastro: new Date().toLocaleDateString('pt-BR'),
      ativo: true // Sempre iniciar como ATIVO
    };
    this.resetCPFValidation();
  }

  // Validar CPF para uma linha específica
  validateCPFForRow(row: any, index: number): void {
    const cpf = row.cpf.replace(/\D/g, '');
    
    if (!cpf || cpf.length !== 11) {
      row.cpfInvalido = true;
      row.cpfNaoEncontrado = false;
      row.cpfJaExisteEmOutraIndustria = false;
      row.nome = '';
      return;
    }

    // Verificar se todos os dígitos são iguais (CPF inválido)
    if (/^(\d)\1{10}$/.test(cpf)) {
      row.cpfInvalido = true;
      row.cpfNaoEncontrado = false;
      row.cpfJaExisteEmOutraIndustria = false;
      row.nome = '';
      return;
    }

    row.cpfInvalido = false;
    row.isCpfVerificando = true;
    
    const industriaId = this.selectedItem?.id || undefined;

    // Primeiro verificar se o usuário está inativo no administrador
    this.administradorService.verificarUsuarioInativoAdministrador(cpf)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (isInativo) => {
          if (isInativo) {
            row.isCpfVerificando = false;
            // Usuário está inativo no administrador, mostrar modal de alerta
            this.showUserInactiveAdminModal = true;
            // Limpar o CPF do campo
            row.cpf = '';
            row.nome = '';
            return;
          }

          // Usuário não está inativo no administrador, verificar se está ativo em outro local
          this.industriaService.verificarUsuarioAtivoEmOutroLocal(cpf, industriaId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (info) => {
                row.isCpfVerificando = false;
                if (info) {
                  // Mostrar modal em vez de flag inline
                   this.cpfExistsInfo = {
                     cpf: cpf,
                     nome: info.nome || 'Entidade não identificada',
                     tipo: info.tipo || 'indústria'
                   };
                  this.showCpfExistsModal = true;
                  // Limpar o CPF do campo
                  row.cpf = '';
                  row.nome = '';
                  row.cpfJaExisteEmOutraIndustria = false; // Sempre false para não mostrar mensagem inline
                } else {
                  row.cpfJaExisteEmOutraIndustria = false;
                  this.buscarNomeUsuario(cpf, row);
                }
              },
              error: (error) => {
                row.isCpfVerificando = false;
                console.error('Erro ao verificar usuário ativo em outro local:', error);
              }
            });
        },
        error: (error) => {
          console.error('Erro ao verificar usuário inativo no administrador:', error);
          // Em caso de erro, continuar com a verificação de usuário ativo em outro local
          this.industriaService.verificarUsuarioAtivoEmOutroLocal(cpf, industriaId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (info) => {
                row.isCpfVerificando = false;
                if (info) {
                  this.cpfExistsInfo = {
                    cpf: cpf,
                    nome: info.nome || 'Entidade não identificada',
                    tipo: info.tipo || 'indústria'
                  };
                  this.showCpfExistsModal = true;
                  row.cpf = '';
                  row.nome = '';
                  row.cpfJaExisteEmOutraIndustria = false;
                } else {
                  row.cpfJaExisteEmOutraIndustria = false;
                  this.buscarNomeUsuario(cpf, row);
                }
              },
              error: (error) => {
                row.isCpfVerificando = false;
                console.error('Erro ao verificar usuário ativo em outro local:', error);
              }
            });
        }
      });
  }

  // Buscar nome do usuário para uma linha específica
  private buscarNomeUsuario(cpf: string, row: any): void {
    row.isCpfLoading = true;
    
    this.industriaService.buscarUsuarioPorCpf(cpf)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (usuario) => {
          row.isCpfLoading = false;
          if (usuario && usuario.nome) {
            row.nome = usuario.nome;
            row.cpfNaoEncontrado = false;
          } else {
            this.showCpfNotFoundModal = true;
            row.nome = '';
          }
        },
        error: (error) => {
          console.error('Erro ao buscar usuário por CPF:', error);
          row.isCpfLoading = false;
          this.showCpfNotFoundModal = true;
          row.nome = '';
        }
      });
  }

  // Formatar CPF para uma linha específica
  formatCPFInputForRow(event: Event, row: any, index: number): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    
    if (value.length <= 11) {
      value = value.replace(/(\d{3})(\d)/, '$1.$2');
      value = value.replace(/(\d{3})(\d)/, '$1.$2');
      value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      
      row.cpf = value;
      input.value = value;
      
      // Validar CPF quando completo
      const cpfNumerico = value.replace(/\D/g, '');
      if (cpfNumerico.length === 11) {
        // Primeiro verificar se o CPF já existe na lista atual
        // Verificar tanto em userRows (modo criação) quanto em industriaUsers (modo edição)
        const cpfJaExisteEmUserRows = this.userRows.some((user, userIndex) => {
          const userCpfNumerico = user.cpf.replace(/\D/g, '');
          return userCpfNumerico === cpfNumerico && userIndex !== index;
        });
        
        const cpfJaExisteEmIndustriaUsers = this.industriaUsers.some(user => {
          const userCpfNumerico = user.cpf.replace(/\D/g, '');
          return userCpfNumerico === cpfNumerico;
        });
        
        const cpfJaExisteNaLista = cpfJaExisteEmUserRows || cpfJaExisteEmIndustriaUsers;

        if (cpfJaExisteNaLista) {
          this.cpfExistsInfo = {
            cpf: this.formatCPFDisplay(cpfNumerico),
            nome: 'Usuário já presente na lista',
            tipo: 'indústria atual'
          };
          this.showCpfExistsModal = true;
          // Limpar a linha
          row.cpf = '';
          row.nome = '';
          row.dataCadastro = '';
          return;
        }

        this.validateCPFForRow(row, index);
      } else {
        row.cpfInvalido = false;
        row.cpfNaoEncontrado = false;
        row.cpfJaExisteEmOutraIndustria = false;
        row.nome = '';
      }
    }
  }

  // Remover linha de usuário
  removeUserRow(index: number): void {
    this.userRows.splice(index, 1);
  }



}