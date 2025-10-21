import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, timeout } from 'rxjs/operators';
import { HamburgerMenuComponent, MenuItem } from '../../shared/components/hamburger-menu/hamburger-menu.component';
import { AuthService } from '../../core/services/auth.service';
import { CertificadoraService, CertificadoraResponse, CertificadoraRequest, UsuarioCertificadoraRequest, UsuarioAtivoInfo, TipoCertificadora } from '../../core/services/certificadora.service';
import { AdministradorService } from '../../core/services/administrador.service';
import { BrLoadingComponent } from '../../shared/components/br-loading/br-loading.component';
import { AccessibilityService } from '../../core/services/accessibility.service';
import { NotificationService } from '../../core/services/notification.service';

interface Certificadora {
  id: number;
  cnpj: string;
  nome: string;
  dataCadastro: string;
  inventariosProcessados: number;
  estado: string;
  tipoCertificador: TipoCertificadora;
  ativo: boolean;
}

interface CertificadoraUser {
  cpf: string;
  nome: string;
  dataCadastro: string;
  ativo: boolean;
}

interface CertificadoraForm {
  cnpj: string;
  nome: string;
  estado: string;
  tipoCertificador: TipoCertificadora;
  ativo: boolean;
}

@Component({
  selector: 'app-certificadoras',
  standalone: true,
  imports: [CommonModule, FormsModule, HamburgerMenuComponent, BrLoadingComponent],
  templateUrl: './certificadoras.component.html',
  styleUrls: ['./certificadoras.component.scss']
})
export class CertificadorasComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  
  // Accessibility states
  isHighContrast = false;
  isVLibrasActive = false;
  
  // Expose Math for template
  readonly Math = Math;
  
  // Expose enum for template
  readonly TipoCertificadora = TipoCertificadora;

  // Date helper for template
  get currentDateFormatted(): string {
    return new Date().toLocaleDateString('pt-BR');
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
  showStatusConfirmModal = false;
  showDeleteUserModal = false;
  showDeleteUserRowModal = false;
  showUserErrorModal = false;
  showCpfExistsModal = false;
  showCpfNotFoundModal = false;
  showUserActiveModal = false;
  showUserInactiveAdminModal = false;
  showRequiredFieldsModal = false;
  requiredFieldsErrors: string[] = [];
  usuarioAtivoInfo: UsuarioAtivoInfo | null = null;
  cpfExistsInfo: { cpf: string, nome: string, tipo: string } | null = null;
  pendingUserActivation: any = null;
  isEditMode = false;
  pendingAction: 'cancel' | 'save' | 'status' | null = null;
  pendingStatusChange: { id: number; newStatus: boolean } | null = null;

  // Selected item for operations
  selectedItem: Certificadora | null = null;
  selectedUserIndex: number | null = null;
  selectedUserRowIndex: number | null = null;

  certificadoraUsers: CertificadoraUser[] = [];
  originalCertificadoraUsers: CertificadoraUser[] = [];
  
  // Múltiplas linhas de usuários para preenchimento
  userRows: any[] = [];
  
  novaCertificadora: CertificadoraForm = this.getInitialFormState();
  novoUsuario: CertificadoraUser = this.getInitialUserState();

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

  readonly tiposCertificador = [
    { value: TipoCertificadora.FRIGORIFICO, label: 'Frigorífico' },
    { value: TipoCertificadora.LATICINIO, label: 'Laticínio' },
    { value: TipoCertificadora.AMBOS, label: 'Frigorífico e Laticínio' }
  ];

  readonly menuItems: MenuItem[] = [
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
      icon: 'fas fa-cogs'
    },
    {
      id: 'calculos',
      label: 'Cálculos Registrados',
      route: '/calculos-registrados',
      icon: 'fas fa-calculator'
    },
    {
      id: 'certificadoras',
      label: 'Certificadoras',
      route: '/certificadoras',
      icon: 'fas fa-certificate',
      active: true
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
      ],
      route: ''
    },
    {
      id: 'configuracoes',
      label: 'Configurações',
      icon: 'fas fa-cog',
      route: '/configuracoes'
    }
  ];

  // Table data
  certificadoras: Certificadora[] = [];
  filteredCertificadoras: Certificadora[] = [];

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
    private readonly certificadoraService: CertificadoraService,
    private readonly administradorService: AdministradorService,
    private readonly cdr: ChangeDetectorRef
  ) {
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

  private initializeAccessibility(): void {
    // Subscribe to accessibility states
    this.accessibilityService.isHighContrast$.subscribe(state => {
      this.isHighContrast = state;
    });
    
    this.accessibilityService.isVLibrasActive$.subscribe(state => {
      this.isVLibrasActive = state;
    });
  }

  ngOnInit(): void {
    this.carregarCertificadoras();
    this.initializeAccessibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Helper methods for initial states
  private getInitialFormState(): CertificadoraForm {
    return {
      cnpj: '',
      nome: '',
      estado: 'SP',
      tipoCertificador: TipoCertificadora.AMBOS,
      ativo: true
    };
  }

  private getInitialUserState(): CertificadoraUser {
    return {
      cpf: '',
      nome: '',
      dataCadastro: new Date().toLocaleDateString('pt-BR'),
      ativo: true
    };
  }

  // Método para detectar mudanças no status da certificadora
  onCertificadoraStatusChange(): void {
    if (!this.novaCertificadora.ativo) {
      // Se a certificadora foi marcada como inativa, desativar todos os usuários
      this.certificadoraUsers.forEach(user => {
        user.ativo = false;
      });
      this.userRows.forEach(row => {
        row.ativo = false;
      });
    }
  }

  // Data loading
  carregarCertificadoras(): void {
    this.setLoading(true, 'Carregando certificadoras...');

    this.certificadoraService.listar()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: CertificadoraResponse[]) => {
          this.certificadoras = response.map(cert => this.mapResponseToCertificadora(cert));
          this.updateFilteredData();
          this.setLoading(false);
        },
        error: () => {
          this.setLoading(false);
        }
      });
  }

  private mapResponseToCertificadora(response: CertificadoraResponse): Certificadora {
    return {
      id: response.id,
      cnpj: response.cnpj,
      nome: response.nome,
      dataCadastro: response.dataCadastro || new Date().toLocaleDateString('pt-BR'),
      inventariosProcessados: response.inventariosTratados || 0,
      estado: response.estado,
      tipoCertificador: response.tipo,
      ativo: response.ativo
    };
  }

  private mapToRequest(): CertificadoraRequest {
    // Enviar todos os usuários (originais + novos) para preservar os existentes
    const usuarios = this.certificadoraUsers.map(user => ({
      cpf: user.cpf.replace(/\D/g, ''),
      nome: user.nome,
      dataCadastro: user.dataCadastro,
      ativo: user.ativo
    }));

    console.log('Mapeando usuários para request:', usuarios);

    return {
      nome: this.novaCertificadora.nome.trim(),
      cnpj: this.novaCertificadora.cnpj.replace(/\D/g, ''),
      estado: this.novaCertificadora.estado,
      tipo: this.novaCertificadora.tipoCertificador,
      ativo: this.novaCertificadora.ativo,
      usuarios: usuarios
    };
  }

  // Loading state management
  private setLoading(loading: boolean, message = ''): void {
    this.isLoading = loading;
    this.loadingMessage = message;
  }

  // Menu handlers
  onMenuToggle(isOpen: boolean): void {
    this.isMenuOpen = isOpen;
  }

  onMenuItemClick(item: MenuItem): void {
    if (item.route) {
      this.router.navigate([item.route]);
      this.isMenuOpen = false;
    }
  }

  // Search and filtering
  onSearch(): void {
    this.updateFilteredData();
  }

  updateFilteredData(): void {
    const searchTermLower = this.searchTerm.trim().toLowerCase();
    
    if (!searchTermLower) {
      this.filteredCertificadoras = [...this.certificadoras];
    } else {
      this.filteredCertificadoras = this.certificadoras.filter(cert =>
        cert.nome.toLowerCase().includes(searchTermLower) ||
        cert.cnpj.includes(this.searchTerm) ||
        cert.estado.toLowerCase().includes(searchTermLower)
      );
    }
    
    this.totalItems = this.filteredCertificadoras.length;
    this.currentPage = 1;
  }

  // Status styling
  getStatusClass(ativo: boolean): string {
    return ativo ? 'status-active' : 'status-inactive';
  }

  // Create modal
  openCreateModal(): void {
    this.resetForm();
    this.cnpjJaExiste = false;
    this.isCnpjLoading = false;
    
    this.resetarEstadoCpf();
    
    this.isEditMode = false;
    this.showCreateModal = true;
    
    // Inicializar vazio
    this.userRows = [];
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.resetForm();
    this.resetarEstadoCpf();
    this.userRows = []; // Limpar linhas de usuário
  }

  confirmCloseCreateModal(): void {
    this.pendingAction = 'cancel';
    this.showCancelConfirmModal = true;
  }

  onSubmitCreate(): void {
    if (!this.isFormValid()) {
      return;
    }

    // Verificar se tem pelo menos um usuário
    if (!this.certificadoraUsers || this.certificadoraUsers.length === 0) {
      this.showUserErrorModal = true;
      return;
    }

    this.setLoading(true, 'Criando certificadora...');
    const request = this.mapToRequest();

    this.certificadoraService.criar(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: CertificadoraResponse) => {
          this.notificationService.success('Certificadora criada com sucesso!');
          this.carregarCertificadoras();
          this.closeCreateModal();
          this.setLoading(false);
        },
        error: (error) => {
          this.notificationService.handleHttpError(error);
          this.setLoading(false);
        }
      });
  }

  // Edit modal
  editarCertificadora(id: number): void {
    const certificadora = this.certificadoras.find(cert => cert.id === id);
    if (!certificadora) {
      console.error('Certificadora não encontrada:', id);
      return;
    }

    this.selectedItem = certificadora;
    this.novaCertificadora = {
      cnpj: this.getFormattedCNPJ(certificadora.cnpj),
      nome: certificadora.nome,
      estado: certificadora.estado,
      tipoCertificador: certificadora.tipoCertificador,
      ativo: certificadora.ativo
    };
    
    this.cnpjJaExiste = false;
    this.isCnpjLoading = false;
    
    this.resetarEstadoCpf();
    
    this.setLoading(true, 'Carregando usuários da certificadora...');
    this.certificadoraService.buscarUsuarios(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (usuarios: UsuarioCertificadoraRequest[]) => {
          console.log('Usuários carregados do backend:', usuarios);
          this.certificadoraUsers = usuarios.map(user => ({
            cpf: this.formatCPFDisplay(user.cpf),
            nome: user.nome,
            dataCadastro: user.dataCadastro || new Date().toLocaleDateString('pt-BR'),
            ativo: user.ativo !== undefined ? user.ativo : true
          }));
          console.log('Usuários mapeados para o frontend:', this.certificadoraUsers);
          this.originalCertificadoraUsers = [...this.certificadoraUsers];
          
          // Inicializar userRows apenas com os usuários existentes (sem linha vazia)
          this.userRows = this.certificadoraUsers.map(user => ({
            cpf: user.cpf,
            nome: user.nome,
            dataCadastro: user.dataCadastro,
            ativo: user.ativo,
            cpfJaExisteEmOutraCertificadora: false,
            cpfNaoEncontrado: false,
            cpfInvalido: false,
            isCpfLoading: false
          }));
          
          this.setLoading(false);
          this.isEditMode = true;
          this.showEditModal = true;
        },
        error: () => {
          this.certificadoraUsers = [];
          this.originalCertificadoraUsers = [];
          // Inicializar vazio em caso de erro
          this.userRows = [];
          this.setLoading(false);
          this.showEditModal = true;
        }
      });
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedItem = null;
    this.resetForm();
    this.resetarEstadoCpf();
    this.userRows = []; // Limpar linhas de usuário
  }

  confirmCloseEditModal(): void {
    this.pendingAction = 'cancel';
    this.showCancelConfirmModal = true;
  }

  closeCancelConfirmModal(): void {
    this.showCancelConfirmModal = false;
    this.pendingAction = null;
  }

  closeSaveConfirmModal(): void {
    this.showSaveConfirmModal = false;
    this.pendingAction = null;
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
    if (this.showCreateModal) {
      this.onSubmitCreate();
    } else if (this.showEditModal) {
      this.onSubmitEdit();
    }
    this.closeSaveConfirmModal();
  }

  confirmSubmitCreate(): void {
    if (this.isFormValid()) {
      // Processar todas as linhas de usuários antes da validação
      this.processAllUserRows();
      
      // Verificar se tem pelo menos um usuário
      if (!this.certificadoraUsers || this.certificadoraUsers.length === 0) {
        this.showUserErrorModal = true;
        return;
      }
      
      this.isEditMode = false;
      this.showSaveConfirmModal = true;
    }
  }

  confirmSubmitEdit(): void {
    if (this.isFormValid()) {
      // Processar todas as linhas de usuários antes da validação
      this.processAllUserRows();
      
      // Verificar se tem pelo menos um usuário
      if (!this.certificadoraUsers || this.certificadoraUsers.length === 0) {
        this.showUserErrorModal = true;
        return;
      }
      
      this.isEditMode = true;
      this.showSaveConfirmModal = true;
    }
  }

  onSubmitEdit(): void {
    if (!this.selectedItem || !this.isFormValid()) {
      return;
    }

    // Verificar se tem pelo menos um usuário
    if (!this.certificadoraUsers || this.certificadoraUsers.length === 0) {
      this.showUserErrorModal = true;
      return;
    }

    // Se a certificadora está sendo desativada (estava ativa e agora está inativa), desativar todos os usuários
    if (this.selectedItem.ativo && !this.novaCertificadora.ativo) {
      this.certificadoraUsers.forEach(user => {
        user.ativo = false;
      });
      this.userRows.forEach(row => {
        row.ativo = false;
      });
    }

    this.setLoading(true, 'Atualizando certificadora...');
    const request = this.mapToRequest();

    this.certificadoraService.atualizar(this.selectedItem.id, request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: CertificadoraResponse) => {
          this.notificationService.success('Certificadora atualizada com sucesso!');
          this.carregarCertificadoras();
          this.closeEditModal();
          this.setLoading(false);
        },
        error: (error) => {
          this.notificationService.handleHttpError(error);
          this.setLoading(false);
        }
      });
  }

  // Delete modal
  excluirCertificadora(id: number): void {
    this.selectedItem = this.certificadoras.find(cert => cert.id === id) || null;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.selectedItem = null;
  }

  confirmDelete(): void {
    if (!this.selectedItem) {
      return;
    }

    this.setLoading(true, 'Excluindo certificadora...');

    this.certificadoraService.deletar(this.selectedItem.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success('Certificadora excluída com sucesso!');
          this.carregarCertificadoras();
          this.closeDeleteModal();
          this.setLoading(false);
        },
        error: (error) => {
          this.notificationService.handleHttpError(error);
          this.setLoading(false);
        }
      });
  }

  // Status toggle
  toggleStatus(id: number): void {
    const certificadora = this.certificadoras.find(cert => cert.id === id);
    if (!certificadora) {
      return;
    }

    const novoStatus = !certificadora.ativo;
    this.selectedItem = certificadora;
    this.pendingStatusChange = { id, newStatus: novoStatus };
    this.pendingAction = 'status';
    this.showStatusConfirmModal = true;
  }

  closeStatusConfirmModal(): void {
    this.showStatusConfirmModal = false;
    this.selectedItem = null;
    this.pendingStatusChange = null;
    this.pendingAction = null;
  }

  confirmStatusChange(): void {
    if (!this.pendingStatusChange) {
      return;
    }

    const { id, newStatus } = this.pendingStatusChange;
    const certificadora = this.certificadoras.find(cert => cert.id === id);
    if (!certificadora) {
      return;
    }

    this.setLoading(true, 'Atualizando status...');

    const action = newStatus ? 'ativar' : 'desativar';
    
    const request$ = newStatus 
      ? this.certificadoraService.ativar(id)
      : this.certificadoraService.desativar(id);
    
    request$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notificationService.success(
            `Certificadora ${action === 'ativar' ? 'ativada' : 'desativada'} com sucesso!`
          );
          this.carregarCertificadoras();
          this.closeStatusConfirmModal();
        },
        error: (error) => {
          this.notificationService.handleHttpError(error);
          this.closeStatusConfirmModal();
        },
        complete: () => {
          this.setLoading(false);
        }
      });
  }

  // Form validation
  private isFormValid(): boolean {
    const { cnpj, nome, estado, tipoCertificador } = this.novaCertificadora;
    this.requiredFieldsErrors = [];
    
    if (!nome.trim()) {
      this.requiredFieldsErrors.push('Nome da certificadora');
    }
    
    if (!cnpj.trim() || cnpj.replace(/\D/g, '').length !== 14) {
      this.requiredFieldsErrors.push('CNPJ válido (14 dígitos)');
    }
    
    if (this.cnpjJaExiste) {
      this.requiredFieldsErrors.push('CNPJ não pode estar já cadastrado');
    }
    
    if (!estado) {
      this.requiredFieldsErrors.push('Estado');
    }
    
    if (!Object.values(TipoCertificadora).includes(tipoCertificador)) {
      this.requiredFieldsErrors.push('Tipo de certificador');
    }
    
    if (this.requiredFieldsErrors.length > 0) {
       this.showRequiredFieldsModal = true;
       return false;
     }
     
     return true;
  }

  // Formatting methods
  formatCNPJ(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (!target) return;

    const cleaned = target.value.replace(/\D/g, '');
    const formatted = cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    
    target.value = formatted;
    this.novaCertificadora.cnpj = formatted;
    
    if (cleaned.length === 14) {
      this.verificarCnpjDuplicado(cleaned);
    } else {
      this.cnpjJaExiste = false;
    }
  }

  getFormattedCNPJ(cnpj: string): string {
    const cleaned = cnpj.replace(/\D/g, '');
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  formatCPFDisplay(cpf: string): string {
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cpf;
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

  private resetCPFValidation(): void {
    this.isCpfVerificando = false;
    this.cpfJaExisteEmOutraCertificadora = false;
    this.cpfNaoEncontrado = false;
    this.cpfInvalido = false;
  }

  private validateCPF(cpf: string): void {
    if (cpf.length < 14) {
      this.resetCPFValidation();
      return;
    }

    const cpfNumerico = cpf.replace(/\D/g, '');
    
    // Primeiro verificar se o CPF já existe na lista atual de usuários
    const cpfJaExisteNaLista = this.certificadoraUsers.some(user => {
      const userCpfNumerico = user.cpf.replace(/\D/g, '');
      return userCpfNumerico === cpfNumerico;
    });

    if (cpfJaExisteNaLista) {
      this.cpfExistsInfo = {
        cpf: this.formatCPFDisplay(cpfNumerico),
        nome: this.novoUsuario.nome || 'Usuário já presente na lista',
        tipo: 'certificadora atual'
      };
      this.showCpfExistsModal = true;
      // Limpar o formulário
      this.novoUsuario.cpf = '';
      this.novoUsuario.nome = '';
      this.novoUsuario.dataCadastro = '';
      return;
    }

    this.isCpfVerificando = true;
    this.cpfJaExisteEmOutraCertificadora = false;
    this.cpfNaoEncontrado = false;
    
    // Buscar usuário por CPF
    this.buscarUsuarioPorCpf(cpfNumerico);
    
    // Verificar se CPF existe em outra certificadora
    this.verificarCpfExisteEmOutraCertificadora(cpfNumerico);
  }

  isCpfLoading = false;
  
  isCnpjLoading = false;
  cnpjJaExiste = false;
  
  isCpfVerificando = false;
  cpfJaExisteEmOutraCertificadora = false;
  cpfNaoEncontrado = false;
  cpfInvalido = false;

  private buscarUsuarioPorCpf(cpf: string): void {
    console.log('Buscando usuário por CPF:', cpf);
    this.isCpfLoading = true;
    
    this.cpfJaExisteEmOutraCertificadora = false;
    this.isCpfVerificando = false;
    this.cpfNaoEncontrado = false;
    
    this.certificadoraService.buscarUsuarioPorCpf(cpf)
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (usuario: UsuarioCertificadoraRequest) => {
          if (usuario) {
            this.novoUsuario.nome = usuario.nome;
            
            if (usuario.dataCadastro && typeof usuario.dataCadastro === 'string') {
              if (/^\d{2}\/\d{2}\/\d{4}$/.test(usuario.dataCadastro)) {
                this.novoUsuario.dataCadastro = usuario.dataCadastro;
              } else {
                try {
                  const data = new Date(usuario.dataCadastro);
                  if (!isNaN(data.getTime())) {
                    this.novoUsuario.dataCadastro = data.toLocaleDateString('pt-BR');
                  } else {
                    throw new Error('Data inválida');
                  }
                } catch (e) {
                  this.novoUsuario.dataCadastro = new Date().toLocaleDateString('pt-BR');
                }
              }
            } else {
              this.novoUsuario.dataCadastro = new Date().toLocaleDateString('pt-BR');
            }
            
            this.novoUsuario.ativo = usuario.ativo !== undefined ? usuario.ativo : true;
            
            this.verificarCpfExisteEmOutraCertificadora(cpf);
          } else {
            this.novoUsuario.nome = '';
            this.novoUsuario.dataCadastro = new Date().toLocaleDateString('pt-BR');
            this.novoUsuario.ativo = true;
            
            this.showCpfNotFoundModal = true;
          }
        },
        error: (error) => {
          this.novoUsuario.nome = '';
          this.novoUsuario.dataCadastro = new Date().toLocaleDateString('pt-BR');
          this.novoUsuario.ativo = true;
          
          this.cpfJaExisteEmOutraCertificadora = false;
          this.isCpfVerificando = false;
          
          if (error.status === 404) {
            this.showCpfNotFoundModal = true;
          } else {
            this.notificationService.error('Erro ao buscar usuário. Tente novamente.');
          }
        },
        complete: () => {
          this.isCpfLoading = false;
        }
      });
  }
  
  private verificarCpfExisteEmOutraCertificadora(cpf: string): void {
    this.isCpfVerificando = true;
    
    const cpfNumerico = cpf.replace(/\D/g, '');
    
    // Primeiro verificar se o CPF existe em indústrias
    this.certificadoraService.verificarCpfExisteEmIndustria(cpfNumerico)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response && response.existe) {
            // Mostrar modal em vez de notificação
             this.cpfExistsInfo = {
               cpf: cpfNumerico,
               nome: response.nome || 'Indústria não identificada',
               tipo: 'indústria'
             };
            this.showCpfExistsModal = true;
            this.cdr.detectChanges();
            // Limpar o CPF do formulário
            this.novoUsuario.cpf = '';
            this.novoUsuario.nome = '';
            this.novoUsuario.dataCadastro = '';
            this.cpfJaExisteEmOutraCertificadora = false;
            this.isCpfVerificando = false;
            return;
          }

          // Se não existe em indústrias, continuar com a validação normal
          const foiRemovidoLocalmente = this.originalCertificadoraUsers.some(user => 
            user.cpf.replace(/\D/g, '') === cpfNumerico
          ) && !this.certificadoraUsers.some(user => 
            user.cpf.replace(/\D/g, '') === cpfNumerico
          );

          if (foiRemovidoLocalmente) {
            this.cpfJaExisteEmOutraCertificadora = false;
            this.isCpfVerificando = false;
            return;
          }
          
          const certificadoraIdAtual = this.selectedItem ? this.selectedItem.id : undefined;
          
          this.certificadoraService.verificarCpfExisteEmOutraCertificadora(cpf, certificadoraIdAtual)
            .pipe(
              takeUntil(this.destroy$),
              timeout(8000)
            )
            .subscribe({
              next: (response: any) => {
                if (response && response.existe) {
                  // Mostrar modal em vez de flag inline
                   this.cpfExistsInfo = {
                     cpf: cpfNumerico,
                     nome: response.nome || 'Certificadora não identificada',
                     tipo: 'certificadora'
                   };
                  this.showCpfExistsModal = true;
                  this.cdr.detectChanges();
                  // Limpar o CPF do formulário
                  this.novoUsuario.cpf = '';
                  this.novoUsuario.nome = '';
                  this.novoUsuario.dataCadastro = '';
                }
                this.cpfJaExisteEmOutraCertificadora = false; // Sempre false para não mostrar mensagem inline
                this.isCpfVerificando = false;
               },
              error: (error) => {
                console.log('Erro ao verificar CPF em outra certificadora:', error);
                this.cpfJaExisteEmOutraCertificadora = false;
                this.isCpfVerificando = false;
              }
            });
        },
        error: () => {
          this.cpfJaExisteEmOutraCertificadora = false;
          this.isCpfVerificando = false;
        }
      });
  }

  private verificarCnpjDuplicado(cnpj: string): void {
    this.isCnpjLoading = true;
    
    if (this.selectedItem && this.selectedItem.cnpj.replace(/\D/g, '') === cnpj) {
      this.cnpjJaExiste = false;
      this.isCnpjLoading = false;
      return;
    }
    
    // Primeiro verificar se o CNPJ existe em indústrias
    this.certificadoraService.verificarCnpjExisteEmIndustria(cnpj)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (existeEmIndustria) => {
          if (existeEmIndustria) {
            this.notificationService.error('O usuário em questão já se encontra ativo em outro segmento do sistema.');
            this.cnpjJaExiste = true;
            this.isCnpjLoading = false;
            return;
          }

          // Se não existe em indústrias, verificar em certificadoras
          this.certificadoraService.verificarCnpjExiste(cnpj)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (existe) => {
                this.cnpjJaExiste = existe;
                this.isCnpjLoading = false;
              },
              error: () => {
                this.cnpjJaExiste = false;
                this.isCnpjLoading = false;
              }
            });
        },
        error: () => {
          this.cnpjJaExiste = false;
          this.isCnpjLoading = false;
        }
      });
  }

  // User management
  addUser(): void {
    if (!this.isUserValid()) {
      return;
    }

    const cpfLimpo = this.novoUsuario.cpf.replace(/\D/g, '');
    
    const cpfExiste = this.certificadoraUsers.some(user =>
      user.cpf.replace(/\D/g, '') === cpfLimpo
    );

    if (cpfExiste) {
      this.notificationService.error('CPF já cadastrado nesta certificadora!');
      return;
    }
    
    if (this.cpfJaExisteEmOutraCertificadora) {
      this.notificationService.error('Este CPF já está cadastrado em outra certificadora e não pode ser utilizado.');
      return;
    }

    const certificadoraId = this.selectedItem?.id || undefined;

    // Primeiro verificar se o usuário está inativo no administrador
    this.administradorService.verificarUsuarioInativoAdministrador(cpfLimpo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (isInativo) => {
          if (isInativo) {
            // Usuário está inativo no administrador, mostrar modal de alerta
            this.showUserInactiveAdminModal = true;
            return;
          }

          // Usuário não está inativo no administrador, verificar se está ativo em outro local
          this.certificadoraService.verificarUsuarioAtivoEmOutroLocal(cpfLimpo, certificadoraId)
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
          this.certificadoraService.verificarUsuarioAtivoEmOutroLocal(cpfLimpo, certificadoraId)
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
    const cpfJaExiste = this.certificadoraUsers.some(user => {
      const userCpfNumerico = user.cpf.replace(/\D/g, '');
      return userCpfNumerico === cpfNumerico;
    });

    if (cpfJaExiste) {
      this.cpfExistsInfo = {
        cpf: cpfFormatado,
        nome: this.novoUsuario.nome,
        tipo: 'certificadora atual'
      };
      this.showCpfExistsModal = true;
      return;
    }

    const usuario: CertificadoraUser = {
      cpf: cpfFormatado,
      nome: this.novoUsuario.nome.trim(),
      dataCadastro: new Date().toLocaleDateString('pt-BR'),
      ativo: this.novoUsuario.ativo
    };

    this.certificadoraUsers.push(usuario);
    this.novoUsuario = this.getInitialUserState();
    this.cpfJaExisteEmOutraCertificadora = false;
    
    this.notificationService.success('Usuário adicionado com sucesso!');
    console.log('Usuário adicionado:', usuario);
  }

  removeUser(index: number): void {
    this.openDeleteUserModal(index);
  }

  openDeleteUserModal(index: number): void {
    this.selectedUserIndex = index;
    this.showDeleteUserModal = true;
  }

  closeDeleteUserModal(): void {
    this.showDeleteUserModal = false;
    this.selectedUserIndex = null;
  }

  closeDeleteUserRowModal(): void {
    this.showDeleteUserRowModal = false;
    this.selectedUserRowIndex = null;
  }

  confirmDeleteUserRow(): void {
    if (this.selectedUserRowIndex !== null) {
      this.userRows.splice(this.selectedUserRowIndex, 1);
      this.closeDeleteUserRowModal();
    }
  }

  closeUserErrorModal(): void {
    this.showUserErrorModal = false;
  }

  closeCpfExistsModal(): void {
    this.showCpfExistsModal = false;
    this.cpfExistsInfo = null;
  }

  closeCpfNotFoundModal(): void {
    this.showCpfNotFoundModal = false;
  }

  closeUserActiveModal(): void {
    this.showUserActiveModal = false;
    this.usuarioAtivoInfo = null;
  }

  closeUserInactiveAdminModal(): void {
    this.showUserInactiveAdminModal = false;
  }

  closeRequiredFieldsModal(): void {
    this.showRequiredFieldsModal = false;
    this.requiredFieldsErrors = [];
  }

  confirmDeleteUser(): void {
    if (this.selectedUserIndex !== null && this.selectedUserIndex >= 0 && this.selectedUserIndex < this.certificadoraUsers.length) {
      this.certificadoraUsers.splice(this.selectedUserIndex, 1);
      this.closeDeleteUserModal();
    }
  }

  onUserStatusChange(user: any, event: any): void {
    const isBeingActivated = event.target.checked;
    
    // Se o usuário está sendo ativado (de inativo para ativo), verificar restrições
    if (isBeingActivated) {
      const cpfNumerico = user.cpf.replace(/\D/g, '');
      const certificadoraId = this.selectedItem?.id || undefined;
      
      console.log('DEBUG onUserStatusChange - CPF:', cpfNumerico, 'CertificadoraId:', certificadoraId, 'IsEditMode:', this.isEditMode);
      
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
            this.certificadoraService.verificarUsuarioAtivoEmOutroLocal(cpfNumerico, certificadoraId)
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

  private isUserValid(): boolean {
    const { cpf } = this.novoUsuario;
    
    if (!cpf.trim()) {
      console.error('CPF é obrigatório!');
      return false;
    }

    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      console.error('CPF deve ter 11 dígitos!');
      return false;
    }

    return true;
  }

  // Pagination
  get paginatedData(): Certificadora[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredCertificadoras.slice(startIndex, endIndex);
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
    this.novaCertificadora = this.getInitialFormState();
    this.selectedItem = null;
    this.certificadoraUsers = [];
    this.originalCertificadoraUsers = [];
    this.novoUsuario = this.getInitialUserState();
    this.userRows = [];
  }

   private resetarEstadoCpf(): void {
     this.cpfJaExisteEmOutraCertificadora = false;
     this.isCpfVerificando = false;
     this.isCpfLoading = false;
     this.cpfNaoEncontrado = false;
   }

  // Logout
  // Métodos para gerenciar múltiplas linhas de usuários
  addUserRow(): void {
    this.userRows.push({
      cpf: '',
      nome: '',
      dataCadastro: this.currentDateFormatted,
      ativo: true,
      cpfJaExisteEmOutraCertificadora: false,
      cpfNaoEncontrado: false,
      cpfInvalido: false,
      isCpfLoading: false
    });
  }

  canAddNewRow(): boolean {
    if (this.userRows.length === 0) return true;
    const lastRow = this.userRows[this.userRows.length - 1];
    return lastRow.cpf.trim() !== '' && lastRow.nome.trim() !== '';
  }

  removeUserRow(index: number): void {
    // Verificar se a linha tem dados preenchidos
    const row = this.userRows[index];
    if (row && ((row.cpf && row.cpf.trim() !== '') || (row.nome && row.nome.trim() !== ''))) {
      // Se tem dados, abrir modal de confirmação
      this.selectedUserRowIndex = index;
      this.showDeleteUserRowModal = true;
    } else {
      // Se não tem dados, remover diretamente
      this.userRows.splice(index, 1);
    }
  }

  processAllUserRows(): void {
    const validRows = this.userRows.filter(row => 
      row.cpf.trim() !== '' && 
      row.nome.trim() !== '' && 
      !row.cpfJaExisteEmOutraCertificadora && 
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

    // Remover verificação com lista existente - apenas verificar duplicatas entre as linhas atuais

    // Se houver CPFs duplicados, mostrar modal de erro
    if (cpfsDuplicados.size > 0) {
      const cpfsDuplicadosFormatados = Array.from(cpfsDuplicados).map(cpf => this.formatCPFDisplay(cpf));
      this.cpfExistsInfo = {
        cpf: cpfsDuplicadosFormatados.join(', '),
        nome: 'Múltiplos usuários',
        tipo: 'certificadora atual'
      };
      this.showCpfExistsModal = true;
      return;
    }

    // Adicionar usuários válidos à lista principal
    validRows.forEach(row => {
      const cpfFormatado = this.formatCPFDisplay(row.cpf.replace(/\D/g, ''));
      this.certificadoraUsers.push({
        cpf: cpfFormatado,
        nome: row.nome,
        dataCadastro: row.dataCadastro,
        ativo: row.ativo
      });
    });

    // Limpar as linhas após processar
    this.userRows = [];
  }

  validateCPFForRow(row: any, index: number): void {
    const cpf = row.cpf.replace(/\D/g, '');
    
    if (!cpf || cpf.length !== 11) {
      row.cpfInvalido = true;
      row.cpfNaoEncontrado = false;
      row.cpfJaExisteEmOutraCertificadora = false;
      row.nome = '';
      return;
    }

    // Verificar se todos os dígitos são iguais (CPF inválido)
    if (/^(\d)\1{10}$/.test(cpf)) {
      row.cpfInvalido = true;
      row.cpfNaoEncontrado = false;
      row.cpfJaExisteEmOutraCertificadora = false;
      row.nome = '';
      return;
    }

    row.cpfInvalido = false;
    row.isCpfVerificando = true;
    
    const certificadoraId = this.selectedItem?.id || undefined;

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
          this.certificadoraService.verificarUsuarioAtivoEmOutroLocal(cpf, certificadoraId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (info) => {
                row.isCpfVerificando = false;
                if (info) {
                  // Mostrar modal em vez de flag inline
                  this.cpfExistsInfo = {
                    cpf: cpf,
                    nome: info.nome || 'Entidade não identificada',
                    tipo: info.tipo || 'certificadora'
                  };
                  this.showCpfExistsModal = true;
                  this.cdr.detectChanges();
                  // Limpar o CPF do campo
                  row.cpf = '';
                  row.nome = '';
                  row.cpfJaExisteEmOutraCertificadora = false; // Sempre false para não mostrar mensagem inline
                } else {
                  row.cpfJaExisteEmOutraCertificadora = false;
                  this.buscarNomeUsuarioForRow(cpf, row);
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
          this.certificadoraService.verificarUsuarioAtivoEmOutroLocal(cpf, certificadoraId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (info) => {
                row.isCpfVerificando = false;
                if (info) {
                  this.cpfExistsInfo = {
                    cpf: cpf,
                    nome: info.nome || 'Entidade não identificada',
                    tipo: info.tipo || 'certificadora'
                  };
                  this.showCpfExistsModal = true;
                  this.cdr.detectChanges();
                  row.cpf = '';
                  row.nome = '';
                  row.cpfJaExisteEmOutraCertificadora = false;
                } else {
                  row.cpfJaExisteEmOutraCertificadora = false;
                  this.buscarNomeUsuarioForRow(cpf, row);
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

  private buscarNomeUsuarioForRow(cpf: string, row: any): void {
    this.certificadoraService.buscarUsuarioPorCpf(cpf)
      .pipe(
        timeout(10000),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response: any) => {
          row.isCpfLoading = false;
          if (response && response.nome) {
            row.nome = response.nome;
            row.cpfNaoEncontrado = false;
          } else {
            row.nome = '';
            this.showCpfNotFoundModal = true;
          }
        },
        error: (error: any) => {
          row.isCpfLoading = false;
          row.nome = '';
          this.showCpfNotFoundModal = true;
          console.error('Erro ao buscar usuário por CPF:', error);
        }
      });
  }

  private verificarCpfExisteEmOutraCertificadoraForRow(cpf: string, row: any): void {
    this.certificadoraService.verificarCpfExisteEmOutraCertificadora(cpf, this.selectedItem?.id)
      .pipe(
        timeout(10000),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response: any) => {
          if (response && response.existe) {
            // Mostrar modal em vez de flag inline
            this.cpfExistsInfo = {
              cpf: cpf,
              nome: response.nome || 'Certificadora não identificada',
              tipo: 'certificadora'
            };
            this.showCpfExistsModal = true;
            this.cdr.detectChanges();
            // Limpar o CPF do campo
            row.cpf = '';
            row.nome = '';
          }
          row.cpfJaExisteEmOutraCertificadora = false; // Sempre false para não mostrar mensagem inline
        },
        error: (error) => {
          console.error('Erro ao verificar CPF em outra certificadora:', error);
          row.cpfJaExisteEmOutraCertificadora = false;
        }
      });
  }

  formatCPFInputForRow(event: Event, row: any): void {
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
        const cpfJaExisteNaLista = this.userRows.some((user, index) => {
          const userCpfNumerico = user.cpf.replace(/\D/g, '');
          return userCpfNumerico === cpfNumerico && index !== this.userRows.indexOf(row);
        });

        if (cpfJaExisteNaLista) {
          this.cpfExistsInfo = {
            cpf: this.formatCPFDisplay(cpfNumerico),
            nome: 'Usuário já presente na lista',
            tipo: 'certificadora atual'
          };
          this.showCpfExistsModal = true;
          // Limpar a linha
          row.cpf = '';
          row.nome = '';
          row.dataCadastro = '';
          return;
        }

        this.validateCPFForRow(row, this.userRows.indexOf(row));
      } else {
        row.cpfInvalido = false;
        row.cpfNaoEncontrado = false;
        row.cpfJaExisteEmOutraCertificadora = false;
        row.nome = '';
      }
    }
  }

  logout(): void {
    this.authService.logout()
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }
}