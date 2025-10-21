import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, switchMap, of } from 'rxjs';
import { HamburgerMenuComponent, MenuItem } from '../../shared/components/hamburger-menu/hamburger-menu.component';
import { AuthService } from '../../core/services/auth.service';
import { BrLoadingComponent } from '../../shared/components/br-loading/br-loading.component';
import { AccessibilityService } from '../../core/services/accessibility.service';
import { NotificationService } from '../../core/services/notification.service';
import { AdministradorService } from '../../core/services/administrador.service';
import { CertificadoraService } from '../../core/services/certificadora.service';
import { IndustriaService } from '../../core/services/industria.service';
import { 
  AdministradorResponse, 
  AdministradorCreateRequest,
  AdministradorUpdateRequest
} from '../../core/models/administrador.model';
import { STANDARD_MENU_ITEMS } from '../../shared/constants/menu-items';

enum PerfilAdministrador {
  ADMINISTRADOR_SISTEMA = 'ADMINISTRADOR_SISTEMA',
  ADMINISTRADOR_CERTIFICADORAS = 'ADMINISTRADOR_CERTIFICADORAS',
  VISUALIZADOR_CERTIFICADORAS = 'VISUALIZADOR_CERTIFICADORAS',
  ADMINISTRADOR_INDUSTRIAS = 'ADMINISTRADOR_INDUSTRIAS',
  VISUALIZADOR_INDUSTRIAS = 'VISUALIZADOR_INDUSTRIAS',
  VISUALIZADOR_EMISSOES = 'VISUALIZADOR_EMISSOES',
  CURADOR = 'CURADOR'
}

const PERFIL_ID_MAP = {
  [PerfilAdministrador.ADMINISTRADOR_SISTEMA]: 1,
  [PerfilAdministrador.CURADOR]: 2,
  [PerfilAdministrador.ADMINISTRADOR_CERTIFICADORAS]: 3,
  [PerfilAdministrador.VISUALIZADOR_EMISSOES]: 4,
  [PerfilAdministrador.VISUALIZADOR_CERTIFICADORAS]: 6,
  [PerfilAdministrador.ADMINISTRADOR_INDUSTRIAS]: 7,
  [PerfilAdministrador.VISUALIZADOR_INDUSTRIAS]: 8
};

interface Administrador {
  id: number;
  cpf: string;
  nome: string;
  email: string;
  dataCadastro: Date | string;
  orgao: string;
  perfil: string;
  ativo: boolean;
}

interface AdministradorForm {
  cpf: string;
  nome: string;
  orgao: string;
  perfil: PerfilAdministrador;
  perfilId: number;
  ativo: boolean;
}

@Component({
  selector: 'app-administradores',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, HamburgerMenuComponent, BrLoadingComponent],
  templateUrl: './administradores.component.html',
  styleUrls: ['./administradores.component.scss']
})
export class AdministradoresComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  
  // Accessibility states
  isHighContrast = false;
  isVLibrasActive = false;
  
  // Expose Math for template
  readonly Math = Math;
  
  // Expose enum for template
  readonly PerfilAdministrador = PerfilAdministrador;

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
  showCpfExistsModal = false;
  showStatusConfirmModal = false;
  showRequiredFieldsModal = false;
  requiredFieldsErrors: string[] = [];
  isEditMode = false;

  // Selected item for operations
  selectedItem: Administrador | null = null;
  pendingStatusChange: { id: number; newStatus: boolean } | null = null;
  cpfVinculadoInfo: {vinculado: boolean, entidades: Array<{tipo: string, nome: string, id?: number}>} | null = null;

  // Form data
  novoAdministrador: AdministradorForm = this.getInitialFormState();

  // Data arrays
  // Lista de órgãos removida - agora aceita qualquer valor textual

  readonly perfisAdministrador = [
    { value: PerfilAdministrador.ADMINISTRADOR_SISTEMA, label: 'Administrador do sistema' },
    { value: PerfilAdministrador.CURADOR, label: 'Curador' },
    { value: PerfilAdministrador.ADMINISTRADOR_CERTIFICADORAS, label: 'Administrador de certificadoras' },
    { value: PerfilAdministrador.VISUALIZADOR_CERTIFICADORAS, label: 'Visualizador de certificadoras' },
    { value: PerfilAdministrador.ADMINISTRADOR_INDUSTRIAS, label: 'Administrador de indústrias' },
    { value: PerfilAdministrador.VISUALIZADOR_INDUSTRIAS, label: 'Visualizador de indústrias' },
    { value: PerfilAdministrador.VISUALIZADOR_EMISSOES, label: 'Visualizador de emissões' }
  ];

  readonly menuItems: MenuItem[] = STANDARD_MENU_ITEMS.map(item => ({
    ...item,
    active: item.id === 'administradores'
  }));

  // Table data - agora será carregado do backend
  administradores: Administrador[] = [];

  filteredData: Administrador[] = [];
  paginatedData: Administrador[] = [];

  // UI state
  isMenuOpen = false;
  searchTerm = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;

  private readonly accessibilityService = inject(AccessibilityService);
  private readonly notificationService = inject(NotificationService);
  
  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly administradorService: AdministradorService,
    private readonly certificadoraService: CertificadoraService,
    private readonly industriaService: IndustriaService
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
    // Skip OAuth2 verification, go directly to loading data
    console.log('Bypassing OAuth2 - using admin login');
    this.carregarAdministradores();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Helper methods for initial states
  private getInitialFormState(): AdministradorForm {
    return {
      cpf: '',
      nome: '',
      orgao: '',
      perfil: PerfilAdministrador.ADMINISTRADOR_SISTEMA,
      perfilId: PERFIL_ID_MAP[PerfilAdministrador.ADMINISTRADOR_SISTEMA],
      ativo: true
    };
  }

  // Loading helper
  private setLoading(loading: boolean, message: string = ''): void {
    this.isLoading = loading;
    this.loadingMessage = message;
  }

  // Carregar administradores do backend
  carregarAdministradores(): void {
    this.setLoading(true, 'Carregando administradores...');

    this.administradorService.listar()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: AdministradorResponse[]) => {
          this.administradores = response.map(admin => ({
            id: admin.id,
            cpf: admin.usuario?.cpf || '00000000000',
            nome: admin.usuario?.nome || 'Nome não informado',
            email: admin.usuario?.email || 'email@exemplo.com',
            dataCadastro: admin.usuario?.dataCadastro ? new Date(admin.usuario.dataCadastro) : new Date(),
            orgao: admin.orgao,
            perfil: admin.perfil || 'ADMIN',
            ativo: admin.usuario?.ativo ?? true
          }));
          this.updateFilteredData();
          this.setLoading(false);
          console.log('Administradores carregados:', this.administradores);
        },
        error: (error) => {
          console.error('Erro ao carregar administradores:', error);
          // For development, create mock data if backend fails
          this.criarDadosMock();
          this.setLoading(false);
        }
      });
  }

  // Create mock data for development if backend is not available
  private criarDadosMock(): void {
    console.log('Creating mock data for development...');
    this.administradores = [
      {
        id: 1,
        cpf: '00000000000',
        nome: 'Administrador',
        email: 'admin@bndes.gov.br',
        dataCadastro: new Date('2024-01-15'),
        orgao: '',
        perfil: 'ADMIN',
        ativo: true
      }
    ];
    this.updateFilteredData();
  }

  // Search functionality
  onSearch(): void {
    this.updateFilteredData();
  }

  updateFilteredData(): void {
    if (!this.searchTerm.trim()) {
      this.filteredData = [...this.administradores];
    } else {
      const searchLower = this.searchTerm.toLowerCase();
      this.filteredData = this.administradores.filter(admin =>
        admin.nome.toLowerCase().includes(searchLower) ||
        admin.email.toLowerCase().includes(searchLower) ||
        admin.cpf.includes(searchLower) ||
        admin.orgao.toLowerCase().includes(searchLower) ||
        admin.perfil.toLowerCase().includes(searchLower)
      );
    }
    
    this.totalItems = this.filteredData.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    
    this.updatePaginatedData();
  }

  updatePaginatedData(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedData = this.filteredData.slice(startIndex, endIndex);
  }

  // Pagination methods
  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedData();
    }
  }
  
  toggleStatus(id: number): void {
    const administrador = this.administradores.find(admin => admin.id === id);
    if (!administrador) {
      return;
    }

    this.selectedItem = administrador;
    this.pendingStatusChange = {
      id: id,
      newStatus: !administrador.ativo
    };
    this.showStatusConfirmModal = true;
  }

  changeItemsPerPage(items: number): void {
    this.itemsPerPage = items;
    this.currentPage = 1;
    this.updateFilteredData();
  }

  // Modal management
  openCreateModal(): void {
    this.novoAdministrador = this.getInitialFormState();
    this.isEditMode = false;
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.novoAdministrador = this.getInitialFormState();
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedItem = null;
    this.novoAdministrador = this.getInitialFormState();
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.selectedItem = null;
  }

  // Novos métodos para confirmação de cancelamento
  confirmCloseCreateModal(): void {
    this.showCancelConfirmModal = true;
  }

  confirmCloseEditModal(): void {
    this.showCancelConfirmModal = true;
  }

  closeCancelConfirmModal(): void {
    this.showCancelConfirmModal = false;
  }

  confirmCancel(): void {
    this.showCancelConfirmModal = false;
    if (this.isEditMode) {
      this.closeEditModal();
    } else {
      this.closeCreateModal();
    }
  }

  // Novos métodos para confirmação de salvamento
  confirmSubmitCreate(): void {
    if (this.isFormValid()) {
      this.isEditMode = false;
      this.showSaveConfirmModal = true;
    }
  }

  confirmSubmitEdit(): void {
    if (this.isFormValid()) {
      this.isEditMode = true;
      this.showSaveConfirmModal = true;
    }
  }

  closeSaveConfirmModal(): void {
    this.showSaveConfirmModal = false;
  }

  confirmSave(): void {
    this.showSaveConfirmModal = false;
    if (this.isEditMode) {
      this.onSubmitEdit();
    } else {
      this.onSubmitCreate();
    }
  }

  // Modal para CPF já cadastrado
  showCpfExistsError(): void {
    this.showCpfExistsModal = true;
  }

  closeCpfExistsModal(): void {
    this.showCpfExistsModal = false;
  }

  closeStatusConfirmModal(): void {
    this.showStatusConfirmModal = false;
    this.pendingStatusChange = null;
    this.selectedItem = null;
  }

  closeRequiredFieldsModal(): void {
    this.showRequiredFieldsModal = false;
    this.requiredFieldsErrors = [];
  }

  confirmStatusChange(): void {
    if (!this.pendingStatusChange) {
      return;
    }

    const { id, newStatus } = this.pendingStatusChange;
    const administrador = this.administradores.find(admin => admin.id === id);
    if (!administrador) {
      return;
    }

    this.setLoading(true, `${newStatus ? 'Ativando' : 'Desativando'} administrador...`);

    const request$ = newStatus 
      ? this.administradorService.ativar(id)
      : this.administradorService.desativar(id);
    
    request$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          administrador.ativo = newStatus;
          this.updateFilteredData();
          this.setLoading(false);
          this.notificationService.success(
            `Administrador ${newStatus ? 'ativado' : 'desativado'} com sucesso!`
          );
          this.closeStatusConfirmModal();
        },
        error: () => {
          this.setLoading(false);
          this.notificationService.error(`Erro ao ${newStatus ? 'ativar' : 'desativar'} administrador.`);
          this.closeStatusConfirmModal();
        }
      });
  }

  // Método para verificar se CPF já existe
  checkCpfExists(cpf: string): boolean {
    const cpfLimpo = cpf.replace(/\D/g, '');
    return this.administradores.some(admin => 
      admin.cpf.replace(/\D/g, '') === cpfLimpo && admin.ativo
    );
  }

  // CRUD operations - integração com backend
  onSubmitCreate(): void {
    if (this.isFormValid()) {
      // Verificar se CPF já existe
      if (this.checkCpfExists(this.novoAdministrador.cpf)) {
        this.showCpfExistsError();
        return;
      }
      
      this.setLoading(true, 'Criando administrador...');
      
      const createRequest: AdministradorCreateRequest = {
        nome: this.novoAdministrador.nome,
        email: `${this.novoAdministrador.cpf.replace(/\D/g, '')}@temp.gov.br`, // Email temporário baseado no CPF
        cpf: this.novoAdministrador.cpf.replace(/\D/g, ''),
        orgao: this.novoAdministrador.orgao,
        perfilId: this.novoAdministrador.perfilId || 1
      };
      
      this.administradorService.criar(createRequest)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: AdministradorResponse) => {
            const novoAdmin: Administrador = {
              id: response.id,
              cpf: response.usuario?.cpf || createRequest.cpf,
              nome: response.usuario?.nome || createRequest.nome,
              email: response.usuario?.email || createRequest.email,
              dataCadastro: new Date(),
              orgao: response.orgao,
              perfil: response.perfil || 'ADMIN',
              ativo: true
            };
            
            this.administradores.unshift(novoAdmin);
            this.updateFilteredData();
            this.closeCreateModal();
            this.setLoading(false);
            this.notificationService.success('Administrador criado com sucesso!');
          },
          error: (error) => {
            console.error('Erro ao criar administrador:', error);
            this.setLoading(false);
            
            // Verificar se é erro de CPF já cadastrado
            if (error.error?.message?.includes('CPF') || error.error?.message?.includes('já cadastrado')) {
              this.showCpfExistsError();
            } else {
              this.notificationService.error('Erro ao criar administrador. Tente novamente.');
            }
          }
        });
    }
  }

  editarAdministrador(id: number): void {
    const administrador = this.administradores.find(admin => admin.id === id);
    if (!administrador) {
      console.error('Administrador não encontrado:', id);
      return;
    }

    this.selectedItem = administrador;
    this.isEditMode = true;
    
    const perfilEnum = Object.values(PerfilAdministrador).find(p => p === administrador.perfil) || PerfilAdministrador.VISUALIZADOR_EMISSOES;
    
    this.novoAdministrador = {
      cpf: this.getFormattedCPF(administrador.cpf),
      nome: administrador.nome,
      orgao: administrador.orgao,
      perfil: perfilEnum,
      perfilId: PERFIL_ID_MAP[perfilEnum],
      ativo: administrador.ativo
    };
    this.showEditModal = true;
  }

  onSubmitEdit(): void {
    if (this.selectedItem && this.isEditFormValid()) {
      this.setLoading(true, 'Atualizando administrador...');
      
      // Enviar apenas os campos editáveis (orgao e perfil)
      const updateRequest: AdministradorUpdateRequest = {
        orgao: this.novoAdministrador.orgao,
        perfilId: this.novoAdministrador.perfilId
      };
      
      console.log('Enviando dados completos para atualização:', updateRequest);
      
      this.administradorService.atualizarParcial(this.selectedItem.id, updateRequest)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: AdministradorResponse) => {
            const index = this.administradores.findIndex(a => a.id === this.selectedItem!.id);
            if (index !== -1) {
              this.administradores[index] = {
                id: response.id,
                cpf: response.usuario?.cpf || this.novoAdministrador.cpf,
                nome: response.usuario?.nome || this.novoAdministrador.nome,
                email: response.usuario?.email || `${this.novoAdministrador.cpf.replace(/\D/g, '')}@temp.gov.br`,
                dataCadastro: this.administradores[index].dataCadastro,
                orgao: response.orgao,
                perfil: response.perfil || this.getPerfilStringFromEnum(this.novoAdministrador.perfil),
                ativo: true
              };
              this.updateFilteredData();
            }
            this.closeEditModal();
            this.setLoading(false);
            this.notificationService.success('Administrador atualizado com sucesso!');
          },
          error: (error) => {
            console.error('Erro ao atualizar administrador:', error);
            this.setLoading(false);
            
            // Verificar se é erro de CPF já cadastrado
            if (error.error?.message?.includes('CPF') || error.error?.message?.includes('já cadastrado')) {
              this.showCpfExistsError();
            } else {
              // Fallback to local update if backend fails
              const index = this.administradores.findIndex(a => a.id === this.selectedItem!.id);
              if (index !== -1) {
                this.administradores[index] = {
                  ...this.selectedItem!,
                  cpf: this.novoAdministrador.cpf,
                  nome: this.novoAdministrador.nome,
                  email: `${this.novoAdministrador.cpf.replace(/\D/g, '')}@temp.gov.br`,
                  orgao: this.novoAdministrador.orgao,
                  perfil: this.getPerfilStringFromEnum(this.novoAdministrador.perfil),
                  ativo: this.novoAdministrador.ativo
                };
                this.updateFilteredData();
              }
              this.closeEditModal();
              this.notificationService.error('Erro ao atualizar administrador. Tente novamente.');
            }
          }
        });
    }
  }

  confirmarDelecao(administrador: Administrador): void {
    this.selectedItem = administrador;
    this.cpfVinculadoInfo = null;
    
    // Verificar se o CPF está vinculado a indústrias ou certificadoras
    this.setLoading(true, 'Verificando vinculações...');
    
    this.administradorService.verificarCpfVinculado(administrador.cpf)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.cpfVinculadoInfo = response;
          this.setLoading(false);
          this.showDeleteModal = true;
        },
        error: (error) => {
          console.error('Erro ao verificar CPF vinculado:', error);
          this.setLoading(false);
          // Em caso de erro, continua com a exclusão normal
          this.cpfVinculadoInfo = { vinculado: false, entidades: [] };
          this.showDeleteModal = true;
        }
      });
  }

  confirmDelete(): void {
    if (!this.selectedItem) {
      return;
    }

    this.setLoading(true, 'Excluindo administrador...');

    // Se há vinculações, excluir das entidades vinculadas primeiro
    if (this.cpfVinculadoInfo && this.cpfVinculadoInfo.vinculado) {
      this.excluirEntidadesVinculadas().then(() => {
        this.excluirAdministrador();
      }).catch((error) => {
        console.error('Erro na exclusão em cascata:', error);
        this.setLoading(false);
        this.notificationService.error('Erro ao excluir entidades vinculadas.');
      });
    } else {
      this.excluirAdministrador();
    }
  }

  private async excluirEntidadesVinculadas(): Promise<void> {
    if (!this.cpfVinculadoInfo || !this.selectedItem) {
      return;
    }

    const promises: Promise<any>[] = [];
    const cpfLimpo = this.selectedItem.cpf.replace(/\D/g, '');

    for (const entidade of this.cpfVinculadoInfo.entidades) {
      if (entidade.tipo === 'Certificadora' && entidade.id) {
        // Buscar usuários da certificadora e remover o usuário específico
        const promise = this.certificadoraService.buscarUsuarios(entidade.id)
          .pipe(
            switchMap((usuarios: any[]) => {
              // Filtrar o usuário a ser removido
              const usuariosAtualizados = usuarios.filter(u => 
                u.cpf.replace(/\D/g, '') !== cpfLimpo
              );
              
              // Buscar a certificadora atual
              return this.certificadoraService.buscarPorId(entidade.id!)
                .pipe(
                  switchMap((certificadora: any) => {
                    // Atualizar a certificadora com a nova lista de usuários
                    const certificadoraAtualizada = {
                      ...certificadora,
                      usuarios: usuariosAtualizados
                    };
                    
                    return this.certificadoraService.atualizar(entidade.id!, certificadoraAtualizada);
                  })
                );
            }),
            takeUntil(this.destroy$)
          ).toPromise();
        promises.push(promise);
      } else if (entidade.tipo === 'Indústria' && entidade.id) {
        // Buscar usuários da indústria e remover o usuário específico
        const promise = this.industriaService.buscarUsuarios(entidade.id)
          .pipe(
            switchMap((usuarios: any[]) => {
              // Filtrar o usuário a ser removido
              const usuariosAtualizados = usuarios.filter(u => 
                u.cpf.replace(/\D/g, '') !== cpfLimpo
              );
              
              // Buscar a indústria atual
              return this.industriaService.buscarPorId(entidade.id!)
                .pipe(
                  switchMap((industria: any) => {
                    // Atualizar a indústria com a nova lista de usuários
                    const industriaAtualizada = {
                      ...industria,
                      usuarios: usuariosAtualizados
                    };
                    
                    return this.industriaService.atualizar(entidade.id!, industriaAtualizada);
                  })
                );
            }),
            takeUntil(this.destroy$)
          ).toPromise();
        promises.push(promise);
      }
    }

    await Promise.all(promises);
  }

  private excluirAdministrador(): void {
    if (!this.selectedItem) {
      return;
    }

    this.administradorService.deletar(this.selectedItem.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.administradores = this.administradores.filter(admin => admin.id !== this.selectedItem!.id);
          this.updateFilteredData();
          this.closeDeleteModal();
          this.setLoading(false);
          this.notificationService.success('Administrador e entidades vinculadas excluídos com sucesso!');
        },
        error: () => {
          this.setLoading(false);
          this.notificationService.error('Erro ao excluir administrador.');
        }
      });
  }

  // Form validation
  private isFormValid(): boolean {
    const { cpf, nome, orgao, perfil } = this.novoAdministrador;
    this.requiredFieldsErrors = [];
    
    if (!nome.trim()) {
      this.requiredFieldsErrors.push('Nome');
    }
    
    if (!cpf.trim() || cpf.replace(/\D/g, '').length !== 11) {
      this.requiredFieldsErrors.push('CPF (deve ter 11 dígitos)');
    }
    
    if (!orgao) {
      this.requiredFieldsErrors.push('Órgão');
    }
    
    if (!Object.values(PerfilAdministrador).includes(perfil)) {
      this.requiredFieldsErrors.push('Perfil de administrador');
    }
    
    if (this.requiredFieldsErrors.length > 0) {
      this.showRequiredFieldsModal = true;
      return false;
    }
    
    return true;
  }

  // Form validation for edit mode (only editable fields)
  private isEditFormValid(): boolean {
    const { orgao, perfil } = this.novoAdministrador;
    
    if (!orgao) {
      console.error('Órgão é obrigatório');
      return false;
    }
    
    if (!Object.values(PerfilAdministrador).includes(perfil)) {
      console.error('Perfil de administrador inválido');
      return false;
    }
    
    return true;
  }

  // CPF formatting
  formatCPF(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    
    if (value.length <= 11) {
      value = value.replace(/(\d{3})(\d)/, '$1.$2');
      value = value.replace(/(\d{3})(\d)/, '$1.$2');
      value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    
    event.target.value = value;
    this.novoAdministrador.cpf = value;
  }

  getFormattedCPF(cpf: string): string {
    if (!cpf) return '';
    
    const cleanCPF = cpf.replace(/\D/g, '');
    
    if (cleanCPF.length === 11) {
      return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    
    return cpf;
  }

  // Utility methods
  private getPerfilStringFromEnum(perfil: PerfilAdministrador): string {
    const perfilObj = this.perfisAdministrador.find(p => p.value === perfil);
    return perfilObj ? perfilObj.label : perfil;
  }

  getPerfilLabel(perfil: string): string {
    const perfilObj = this.perfisAdministrador.find(p => p.value === perfil);
    return perfilObj ? perfilObj.label : perfil;
  }

  onPerfilChange(): void {
    this.novoAdministrador.perfilId = PERFIL_ID_MAP[this.novoAdministrador.perfil];
  }

  // Accessibility methods
  toggleHighContrast(): void {
    this.accessibilityService.toggleHighContrast();
  }

  toggleVLibras(): void {
    this.accessibilityService.toggleVLibras();
  }

  // Navigation methods
  onMenuToggle(isOpen: boolean): void {
    this.isMenuOpen = isOpen;
  }

  onMenuItemClick(menuItem: MenuItem): void {
    if (menuItem.route) {
      this.router.navigate([menuItem.route]);
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}