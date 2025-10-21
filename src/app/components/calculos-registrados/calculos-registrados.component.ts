import { Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, switchMap, map } from 'rxjs/operators';
import { MenuItem, HamburgerMenuComponent } from '../../shared/components/hamburger-menu/hamburger-menu.component';
import { ProcuracaoModalComponent, ProcuracaoData } from '../../shared/components/procuracao-modal/procuracao-modal.component';
import { AuthService } from '../../core/services/auth.service';
import { AccessibilityService } from '../../core/services/accessibility.service';
import { BrLoadingComponent } from '../../shared/components/br-loading/br-loading.component';
import { STANDARD_MENU_ITEMS } from '../../shared/constants/menu-items';
import { 
  CalculoRegistradoService, 
  CalculoRegistradoResponse, 
  CalculoRegistradoRequest,
  StatusCalculoRegistrado,
  TipoCertificacao,
  PagedResponse
} from '../../core/services/calculo-registrado.service';
import { CarConsultaService, CarStatus } from '../../core/services/car-consulta.service';
import { 
  InventarioJornadaService, 
  InventarioJornadaRequest, 
  InventarioJornadaResponse 
} from '../../core/services/inventario-jornada.service';

interface CalculoRegistrado {
  id?: number;
  car: string;
  fazenda: string;
  tipo: string;
  estado: string;
  municipio?: string;
  tamanho: number;
  ano: number;
  versao: string;
  status: 'Concluído' | 'Rascunho' | 'Ajustar';
  emissaoTotal: number;
  certificacao: 'Certificado' | 'Não certificado' | 'Não iniciado' | 'Em certificação';
}

@Component({
  selector: 'app-calculos-registrados',
  standalone: true,
  imports: [FormsModule, CommonModule, HamburgerMenuComponent, ProcuracaoModalComponent, BrLoadingComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './calculos-registrados.component.html',
  styleUrls: ['./calculos-registrados.component.scss']
})
export class CalculosRegistradosComponent {
  // Accessibility states
  isHighContrast = false;
  isVLibrasActive = false;
  
  showCreateModal: boolean = false;
  showEditModal: boolean = false;
  showViewModal: boolean = false;
  showDeleteModal: boolean = false;
  showCancelConfirmModal: boolean = false;
  showSaveConfirmModal: boolean = false;
  showRequiredFieldsModal: boolean = false;
  showProcuracaoModal: boolean = false;
  showProcuracaoSuccessModal: boolean = false;
  showPassword: boolean = false;
  showSuccessModal: boolean = false;
  showDuplicateNameModal: boolean = false;
  showCarDuplicateModal: boolean = false;
  searchTerm: string = '';
  
  // Dados filtrados
  filteredCalculos: CalculoRegistrado[] = [];
  
  isEditMode = false;
  successMessage: string = '';
  originalInventario: Partial<CalculoRegistrado> = {};
  duplicateNameMessage: string = '';
  isVerificandoNome = false;
  requiredFieldsErrors: string[] = [];
  carDuplicateMessage: string = '';
  
  // Propriedades para consulta de CAR
  carStatus: CarStatus | null = null;
  isConsultandoCAR = false;
  carNaoEncontrado = false;

  procuracaoData = {
    cpf: '',
    aceitoTermos: false
  };

  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 100;

  // Loading states
  isLoadingData = false;
  loadingMessage = '';

  // Item being edited or deleted
  selectedItem: CalculoRegistrado | null = null;

  // Dados do formulário de criação
  novoInventario: Partial<CalculoRegistrado> = {
    id: undefined,
    car: '',
    ano: new Date().getFullYear(),
    fazenda: '',
    tipo: 'Leite',
    estado: 'MG',
    municipio: '',
    tamanho: 1
  };

  // Dados simulados da tabela
  calculosRegistrados: CalculoRegistrado[] = [];

  estados = [
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

  tipos = ['Leite', 'Corte'];

  // Gerar anos dinamicamente: ano atual + 19 anos anteriores
  get anos(): number[] {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 20; i++) {
      years.push(currentYear - i);
    }
    return years;
  }

  isMenuOpen = false;
  menuItems: MenuItem[] = STANDARD_MENU_ITEMS.map(item => ({
    ...item,
    active: item.id === 'calculos'
  }));

  private scrimInstance: any;

  private readonly accessibilityService = inject(AccessibilityService);
  private carConsultaService = inject(CarConsultaService);
  private readonly destroy$ = new Subject<void>();
  
  constructor(
    private router: Router, 
    private authService: AuthService,
    private calculoRegistradoService: CalculoRegistradoService,
    private inventarioJornadaService: InventarioJornadaService
  ) {
    this.initializeAccessibility();
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

  ngOnInit() {
    this.loadCalculos();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateFilteredData(): void {
    if (!this.searchTerm.trim()) {
      this.filteredCalculos = [...this.calculosRegistrados];
    } else {
      const term = this.searchTerm.toLowerCase().trim();
      this.filteredCalculos = this.calculosRegistrados.filter(calculo => 
        calculo.car.toLowerCase().includes(term) ||
        calculo.fazenda.toLowerCase().includes(term) ||
        calculo.tipo.toLowerCase().includes(term)
      );
    }
    this.totalItems = this.filteredCalculos.length;
    this.currentPage = 1;
  }

  ngAfterViewInit() {
    // Initialize Scrim for delete modal if available
    if (typeof window !== 'undefined' && (window as any).Scrim) {
      const deleteModalScrim = document.querySelector('#deleteModalScrim');
      if (deleteModalScrim) {
        this.scrimInstance = new (window as any).Scrim({
          trigger: deleteModalScrim,
          closeElement: '[data-dismiss="true"]',
          escEnable: true,
          limitTabKey: true
        });
      }
    }
  }

  loadCalculos() {
    this.isLoadingData = true;
    this.loadingMessage = 'Carregando cálculos registrados...';

    this.calculoRegistradoService.listar({
      page: this.currentPage - 1, // Backend usa 0-based indexing
      size: this.itemsPerPage,
      sort: 'dataCriacao,desc'
    }).subscribe({
      next: (response: PagedResponse<CalculoRegistradoResponse>) => {
        this.calculosRegistrados = response.content.map((item) => this.mapResponseToInterface(item));
        this.totalItems = response.totalElements;
        this.isLoadingData = false;
        this.loadingMessage = '';
        this.updateFilteredData();
      },
      error: (error) => {
        console.error('Erro ao carregar cálculos:', error);
        this.isLoadingData = false;
        this.loadingMessage = '';
        // Carregar dados mockados em caso de erro para desenvolvimento
        this.loadMockData();
      }
    });
  }

  private loadMockData() {
    // Dados simulados da tabela (mantidos como fallback)
    this.calculosRegistrados = [];
    this.totalItems = this.calculosRegistrados.length;
    this.updateFilteredData();
  }

  private mapResponseToInterface(response: CalculoRegistradoResponse): CalculoRegistrado {
    return {
      id: response.id,
      car: response.car,
      fazenda: response.fazenda,
      tipo: response.tipo || '',
      estado: response.estado || '',
      municipio: response.municipio || '',
      tamanho: response.tamanho || 0,
      ano: response.ano || new Date().getFullYear(),
      versao: response.versao || 'v1',
      status: this.mapStatusToDisplay(response.status),
      emissaoTotal: response.emissaoTotal || 0,
      certificacao: this.mapCertificacaoToDisplay(response.certificacao)
    };
  }

  private mapStatusToDisplay(status: StatusCalculoRegistrado): 'Concluído' | 'Rascunho' | 'Ajustar' {
    switch (status) {
      case StatusCalculoRegistrado.CONCLUIDO:
        return 'Concluído';
      case StatusCalculoRegistrado.RASCUNHO:
        return 'Rascunho';
      case StatusCalculoRegistrado.AJUSTAR:
        return 'Ajustar';
      default:
        return 'Rascunho';
    }
  }

  private mapCertificacaoToDisplay(certificacao: TipoCertificacao): 'Certificado' | 'Não certificado' | 'Não iniciado' | 'Em certificação' {
    switch (certificacao) {
      case TipoCertificacao.CERTIFICADO:
        return 'Certificado';
      case TipoCertificacao.EM_CERTIFICACAO:
        return 'Em certificação';
      case TipoCertificacao.NAO_INICIADO:
        return 'Não iniciado';
      case TipoCertificacao.NAO_CERTIFICADO:
        return 'Não certificado';
      default:
        return 'Não iniciado';
    }
  }

  onSearch() {
    this.updateFilteredData();
  }

  openCreateModal() {
    this.isEditMode = false;
    this.resetForm();
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.resetForm();
    this.limparStatusCAR();
  }

  openEditModal(inventario: CalculoRegistrado) {
    this.isEditMode = true;
    this.selectedItem = inventario; // Definir o selectedItem
    this.novoInventario = { ...inventario };
    this.originalInventario = { ...inventario };
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.isEditMode = false;
    this.selectedItem = null;
    this.resetForm();
  }

  openViewModal(inventario: CalculoRegistrado) {
    this.selectedItem = inventario;
    this.novoInventario = { ...inventario };
    this.showViewModal = true;
  }

  closeViewModal() {
    this.showViewModal = false;
    this.selectedItem = null;
    this.resetForm();
  }

  resetForm() {
    this.novoInventario = {
      id: undefined,
      car: '',
      ano: new Date().getFullYear(),
      fazenda: '',
      tipo: 'Leite',
      estado: 'MG',
      municipio: '',
      tamanho: 1
    };
  }

  closeSuccessModal() {
    this.showSuccessModal = false;
    this.successMessage = '';
  }

  // Métodos de confirmação seguindo padrão das outras telas
  confirmCloseCreateModal(): void {
    if (this.hasUnsavedChanges()) {
      this.showCancelConfirmModal = true;
    } else {
      this.closeCreateModal();
    }
  }

  confirmCloseEditModal(): void {
    if (this.hasUnsavedChanges()) {
      this.showCancelConfirmModal = true;
    } else {
      this.closeEditModal();
    }
  }

  confirmSubmitCreate(): void {
    if (!this.validateRequiredFields()) {
      this.showRequiredFieldsModal = true;
      return;
    }
    
    // Verificar nome duplicado antes de mostrar modal de confirmação
    const fazenda = this.novoInventario.fazenda || '';
    this.verificarNomeDuplicadoAntesSalvar(fazenda, () => {
      this.showSaveConfirmModal = true;
    });
  }

  confirmSubmitEdit(): void {
    if (!this.validateRequiredFields()) {
      this.showRequiredFieldsModal = true;
      return;
    }
    
      // Verificar nome duplicado antes de mostrar modal de confirmação (excluindo o próprio registro)
    const fazenda = this.novoInventario.fazenda || '';
    const idExcluir = this.selectedItem?.id;
    console.log('DEBUG - Verificando nome duplicado na edição:', {
      fazenda: fazenda,
      idExcluir: idExcluir,
      selectedItem: this.selectedItem
    });
    this.verificarNomeDuplicadoAntesSalvar(fazenda, () => {
      this.showSaveConfirmModal = true;
    }, idExcluir);
  }

  // Métodos dos modais de confirmação
  confirmCancel(): void {
    this.showCancelConfirmModal = false;
    if (this.isEditMode) {
      this.closeEditModal();
    } else {
      this.closeCreateModal();
    }
  }

  closeCancelConfirmModal(): void {
    this.showCancelConfirmModal = false;
  }

  confirmSave(): void {
    this.showSaveConfirmModal = false;
    if (this.isEditMode) {
      this.onSubmitEdit();
    } else {
      this.onSubmitInventario();
    }
  }

  closeSaveConfirmModal(): void {
    this.showSaveConfirmModal = false;
  }

  closeRequiredFieldsModal(): void {
    this.showRequiredFieldsModal = false;
    this.requiredFieldsErrors = [];
  }

  validateRequiredFields(): boolean {
    this.requiredFieldsErrors = [];
    
    // Validação específica do formato do CAR
    if (this.novoInventario.car?.trim()) {
      const carRegex = /^[A-Z]{2}-\d{7}-[0-9A-F]{4}\.[0-9A-F]{4}\.[0-9A-F]{4}\.[0-9A-F]{4}\.[0-9A-F]{4}\.[0-9A-F]{4}\.[0-9A-F]{4}\.[0-9A-F]{4}$/;
      if (!carRegex.test(this.novoInventario.car)) {
        this.requiredFieldsErrors.push('Número do CAR deve estar no formato: UF-1234567-XXXX.XXXX.XXXX.XXXX.XXXX.XXXX.XXXX.XXXX');
      }
    } else {
      this.requiredFieldsErrors.push('Número do CAR');
    }
    
    if (!this.novoInventario.fazenda?.trim()) {
      this.requiredFieldsErrors.push('Nome da fazenda');
    } else if (this.novoInventario.fazenda.length > 100) {
      this.requiredFieldsErrors.push('Nome da fazenda deve ter no máximo 100 caracteres');
    }
    
    if (!this.novoInventario.tipo) {
      this.requiredFieldsErrors.push('Tipo de produção');
    }
    
    if (!this.novoInventario.estado) {
      this.requiredFieldsErrors.push('Estado');
    }
    
    if (!this.novoInventario.municipio?.trim()) {
      this.requiredFieldsErrors.push('Município');
    }
    
    if (!this.novoInventario.ano) {
      this.requiredFieldsErrors.push('Ano');
    }
    
    if (!this.novoInventario.tamanho) {
      this.requiredFieldsErrors.push('Tamanho da propriedade');
    }
    
    return this.requiredFieldsErrors.length === 0;
  }

  isFormValid(): boolean {
    return this.validateRequiredFields();
  }

  hasUnsavedChanges(): boolean {
    if (this.isEditMode) {
      return JSON.stringify(this.novoInventario) !== JSON.stringify(this.originalInventario);
    } else {
      // For create mode, check if any field has been filled
      return !!(
        this.novoInventario.car ||
        this.novoInventario.fazenda ||
        this.novoInventario.municipio ||
        (this.novoInventario.tamanho && this.novoInventario.tamanho > 0)
      );
    }
  }

  formatCAR(event: any): void {
    let value = event.target.value;
    
    // Remove todos os caracteres que não são letras, números, pontos ou hífens
    value = value.replace(/[^A-Za-z0-9.-]/g, '');
    
    // Converte para maiúsculas
    value = value.toUpperCase();
    
    // Aplica a máscara: UF-7dígitos-32hexadecimais separados por pontos a cada 4 caracteres
    if (value.length > 0) {
      let formatted = '';
      
      // Primeira parte: UF (2 letras)
      if (value.length <= 2) {
        formatted = value.replace(/[^A-Z]/g, '');
      } else {
        const uf = value.substring(0, 2).replace(/[^A-Z]/g, '');
        let remaining = value.substring(2).replace(/[^0-9A-F]/g, '');
        
        formatted = uf;
        
        if (remaining.length > 0) {
          formatted += '-';
          
          // Segunda parte: 7 dígitos
          if (remaining.length <= 7) {
            formatted += remaining.replace(/[^0-9]/g, '');
          } else {
            const digits = remaining.substring(0, 7).replace(/[^0-9]/g, '');
            let hex = remaining.substring(7);
            
            formatted += digits;
            
            if (hex.length > 0) {
              formatted += '-';
              
              // Terceira parte: 32 caracteres hexadecimais separados por pontos a cada 4
              hex = hex.replace(/[^0-9A-F]/g, '');
              let hexFormatted = '';
              
              for (let i = 0; i < hex.length && i < 32; i++) {
                if (i > 0 && i % 4 === 0) {
                  hexFormatted += '.';
                }
                hexFormatted += hex[i];
              }
              
              formatted += hexFormatted;
            }
          }
        }
      }
      
      // Verifica se excede o limite de 50 caracteres
      if (formatted.length > 50) {
        // Reverte para o valor anterior se exceder o limite
        return;
      }
      
      this.novoInventario.car = formatted;
      event.target.value = formatted;
      
      // Consulta o CAR automaticamente se o formato estiver completo
      this.consultarCARSeCompleto(formatted);
    } else {
      this.novoInventario.car = '';
      this.limparStatusCAR();
    }
  }

  /**
   * Consulta o CAR se o formato estiver completo e correto
   */
  private consultarCARSeCompleto(numeroCAR: string): void {
    // Limpa status anterior
    this.limparStatusCAR();
    
    // Verifica se o formato está completo (50 caracteres)
    if (this.carConsultaService.validarFormatoCAR(numeroCAR)) {
      this.isConsultandoCAR = true;
      
      this.carConsultaService.consultarCAR(numeroCAR).subscribe({
        next: (status) => {
          this.isConsultandoCAR = false;
          if (status) {
            this.carStatus = status;
            this.carNaoEncontrado = false;
            
            // Preenche automaticamente estado e município se disponíveis no CAR
            if (status.estado) {
              this.novoInventario.estado = status.estado;
            }
            if (status.municipio) {
              this.novoInventario.municipio = status.municipio;
            }
          } else {
            this.carStatus = null;
            this.carNaoEncontrado = true;
          }
        },
        error: (error) => {
          this.isConsultandoCAR = false;
          console.error('Erro ao consultar CAR:', error);
          this.carNaoEncontrado = true;
        }
      });
    }
  }

  /**
   * Limpa o status do CAR
   */
  private limparStatusCAR(): void {
    this.carStatus = null;
    this.carNaoEncontrado = false;
    this.isConsultandoCAR = false;
  }

  /**
   * Retorna a classe CSS para o status do CAR
   */
  getCarStatusClass(): string {
    if (this.carStatus) {
      return this.carConsultaService.getStatusClass(this.carStatus.status);
    }
    return '';
  }

  /**
   * Retorna o ícone para o status do CAR
   */
  getCarStatusIcon(): string {
    if (this.carStatus) {
      return this.carConsultaService.getStatusIcon(this.carStatus.status);
    }
    return '';
  }

  onSubmitInventario() {
    this.isLoadingData = true;
    this.loadingMessage = 'Salvando cálculo...';

    const request: CalculoRegistradoRequest = {
      car: this.novoInventario.car || '',
      fazenda: this.novoInventario.fazenda || '',
      tipo: this.novoInventario.tipo || 'Leite',
      estado: this.novoInventario.estado || 'MG',
      municipio: this.novoInventario.municipio || '',
      tamanho: this.novoInventario.tamanho || 0,
      ano: this.novoInventario.ano || new Date().getFullYear(),
      versao: 'v1',
      status: StatusCalculoRegistrado.RASCUNHO,
      emissaoTotal: 0,
      certificacao: TipoCertificacao.NAO_INICIADO
    };
    this.calculoRegistradoService.criar(request)
      .pipe(
        switchMap((calculoResponse) => {
          console.log('Cálculo criado com sucesso:', calculoResponse);

          const currentUser = this.authService.getCurrentUser();
          const usuarioId = currentUser?.id ? Number(currentUser.id) : null;

          if (!usuarioId) {
            console.error('Usuário não autenticado ou ID inválido ao criar InventarioJornada.');
            // Encerrar loading e manter na tela atual
            this.isLoadingData = false;
            this.loadingMessage = '';
            // Fallback: apenas recarregar lista
            this.loadCalculos();
            // Interromper fluxo
            throw new Error('Usuário inválido para criação de InventarioJornada');
          }

          const invRequest: InventarioJornadaRequest = {
            usuarioId,
            nome: (this.novoInventario.fazenda || `Inventário CAR ${this.novoInventario.car || ''}`).trim(),
            descricao: '',
            tipoRebanho: (this.novoInventario.tipo === 'Corte') ? 'CORTE' : 'LEITE',
            faseAtual: 1,
            status: 'EM_ANDAMENTO',
            fasesConcluidas: {}
          };

          return this.inventarioJornadaService.criar(usuarioId, invRequest).pipe(
            map((invResponse: InventarioJornadaResponse) => ({ calculoResponse, invResponse }))
          );
        })
      )
      .subscribe({
        next: ({ calculoResponse, invResponse }) => {
          console.log('Inventário da jornada criado com sucesso:', invResponse);
          this.closeCreateModal();
          this.isLoadingData = false;
          this.loadingMessage = '';

          if (invResponse?.id) {
            // Navegar para a jornada com o ID correto do InventarioJornada
            this.router.navigate(['/jornada-pecuarista', invResponse.id]);
          } else {
            // Fallback: recarregar a lista se não houver ID
            this.loadCalculos();
          }
        },
        error: (error) => {
          console.error('Erro no fluxo de criação (cálculo/inventário):', error);
          this.isLoadingData = false;
          this.loadingMessage = '';

          // Verificar se é erro de CAR duplicado do cálculo
          if (error?.error?.codigo === 'ERRO_VALIDACAO' && 
              error?.error?.mensagem?.includes('CAR já está sendo usado')) {
            this.carDuplicateMessage = error.error.mensagem;
            this.showCarDuplicateModal = true;
          } else {
            // Outros tipos de erro podem ser tratados aqui
            console.error('Erro não tratado:', error);
          }
        }
      });
  }

  // Edit modal methods
  editItem(car: string) {
    this.selectedItem = this.calculosRegistrados.find(item => item.car === car) || null;
    if (this.selectedItem) {
      // Create a copy for editing
      this.novoInventario = {
        car: this.selectedItem.car,
        ano: this.selectedItem.ano,
        fazenda: this.selectedItem.fazenda,
        tipo: this.selectedItem.tipo,
        estado: this.selectedItem.estado,
        municipio: this.selectedItem.municipio || '',
        tamanho: this.selectedItem.tamanho
      };
      this.originalInventario = { ...this.novoInventario };
      this.isEditMode = true;
      this.showEditModal = true;
    }
  }

  onSubmitEdit() {
    if (this.selectedItem && this.selectedItem.id) {
      this.isLoadingData = true;
      this.loadingMessage = 'Atualizando cálculo...';

      const request: CalculoRegistradoRequest = {
        car: this.novoInventario.car || '',
        fazenda: this.novoInventario.fazenda || '',
        tipo: this.novoInventario.tipo || 'Leite',
        estado: this.novoInventario.estado || 'MG',
        municipio: this.novoInventario.municipio || '',
        tamanho: this.novoInventario.tamanho || 0,
        ano: this.novoInventario.ano || new Date().getFullYear(),
        versao: this.selectedItem.versao,
        status: this.calculoRegistradoService.parseStatus(this.selectedItem.status),
        emissaoTotal: this.selectedItem.emissaoTotal,
        certificacao: this.calculoRegistradoService.parseCertificacao(this.selectedItem.certificacao)
      };

      this.calculoRegistradoService.atualizar(this.selectedItem.id, request).subscribe({
        next: (response) => {
          console.log('Cálculo atualizado com sucesso:', response);
          
          // Salvar dados do selectedItem ANTES de fechar o modal
          const itemEditado = { ...this.selectedItem };
          
          this.closeEditModal();
          // Após editar, tentar localizar um Inventário da Jornada existente do usuário
          const currentUser = this.authService.getCurrentUser();
          const usuarioId = currentUser?.id ? Number(currentUser.id) : null;

          const nomeAlvo = (this.novoInventario.fazenda || itemEditado?.fazenda || '').trim().toLowerCase();

          // Prosseguir mesmo que nomeAlvo esteja vazio; a heurística posterior usa CAR/nome
          if (!usuarioId) {
            // Fallback: recarregar lista caso não seja possível identificar o usuário
            this.loadCalculos();
            return;
          }

          this.isLoadingData = true;
          this.loadingMessage = 'Abrindo jornada...' ;

          this.inventarioJornadaService.listarPorUsuario(usuarioId).subscribe({
            next: (inventarios) => {
              const tipoAlvoRaw = (itemEditado?.tipo || 'Leite').trim().toUpperCase();
              const tipoAlvo = tipoAlvoRaw === 'CORTE' ? 'CORTE' : 'LEITE';
              const fazendaOriginal = (itemEditado?.fazenda || '').trim().toLowerCase();
              const carOriginal = (itemEditado?.car || '').trim();

              // Filtrar por tipo primeiro
              const candidatos = inventarios.filter(inv => (inv.tipoRebanho || '').trim().toUpperCase() === tipoAlvo);

              let match: InventarioJornadaResponse | undefined;

              if (fazendaOriginal) {
                match = candidatos.find(inv => {
                  const nomeInv = (inv.nome || '').trim().toLowerCase();
                  return nomeInv === fazendaOriginal;
                });
                if (match) {
                  console.log('DEBUG Edit->Jornada | Match exato por fazenda:', { id: match.id, nome: match.nome });
                }
              }

              if (!match && carOriginal) {
                const nomeCar = `inventário car ${carOriginal}`.trim().toLowerCase();
                match = candidatos.find(inv => {
                  const nomeInv = (inv.nome || '').trim().toLowerCase();
                  return nomeInv === nomeCar;
                });
                if (match) {
                  console.log('DEBUG Edit->Jornada | Match exato por CAR:', { id: match.id, nome: match.nome });
                }
              }

              // 3. Se ainda não encontrou, tentar match parcial por nome da fazenda
              if (!match && fazendaOriginal) {
                match = candidatos.find(inv => {
                  const nomeInv = (inv.nome || '').trim().toLowerCase();
                  return nomeInv.includes(fazendaOriginal) || fazendaOriginal.includes(nomeInv);
                });
                if (match) {
                  console.log('DEBUG Edit->Jornada | Match parcial por fazenda:', { id: match.id, nome: match.nome });
                }
              }

              // 4. Se ainda não encontrou, tentar match por CAR parcial no nome
              if (!match && carOriginal) {
                match = candidatos.find(inv => {
                  const nomeInv = (inv.nome || '').trim().toLowerCase();
                  return nomeInv.includes(carOriginal.toLowerCase());
                });
                if (match) {
                  console.log('DEBUG Edit->Jornada | Match parcial por CAR:', { id: match.id, nome: match.nome });
                }
              }

              // 5. Último recurso: se só há um candidato do tipo correto
              if (!match && candidatos.length === 1) {
                match = candidatos[0];
                console.log('DEBUG Edit->Jornada | Único candidato do tipo:', { id: match.id, nome: match.nome });
              }

              // 6. Se ainda não encontrou, usar heurística mais flexível: pegar o mais recente do tipo correto
              // (mas apenas se não há ambiguidade - máximo 3 candidatos para evitar o problema original)
              if (!match && candidatos.length > 1 && candidatos.length <= 3) {
                // Ordenar por data de atualização/criação mais recente
                const candidatosOrdenados = candidatos.sort((a, b) => {
                  const dataA = new Date(a.dataAtualizacao || a.dataCriacao || 0).getTime();
                  const dataB = new Date(b.dataAtualizacao || b.dataCriacao || 0).getTime();
                  return dataB - dataA; // Mais recente primeiro
                });
                match = candidatosOrdenados[0];
                console.log('DEBUG Edit->Jornada | Match por recência (poucos candidatos):', { id: match.id, nome: match.nome, candidatos: candidatos.length });
              }

              if (match?.id) {
                console.log('DEBUG Edit->Jornada | Navegando para Jornada:', `/jornada-pecuarista/${match.id}`);
                this.router.navigate(['/jornada-pecuarista', match.id]);
              } else {
                console.warn('DEBUG Edit->Jornada | Nenhum inventário correspondente encontrado para o cálculo específico. Navegando para jornada sem ID.');
                // Fallback: abrir Jornada sem ID para permitir criação de novo inventário
                this.router.navigate(['/jornada-pecuarista']);
              }
              this.isLoadingData = false;
              this.loadingMessage = '';
            },
            error: (err) => {
              console.error('DEBUG Edit->Jornada | Erro ao listar Inventários do usuário:', err);
              this.isLoadingData = false;
              this.loadingMessage = '';
              // Fallback: abrir Jornada sem ID caso listagem falhe
              this.router.navigate(['/jornada-pecuarista']);
            }
          });
        },
        error: (error) => {
          console.error('Erro ao atualizar cálculo:', error);
          this.isLoadingData = false;
          this.loadingMessage = '';
          
          // Verificar se é erro de CAR duplicado
          if (error?.error?.codigo === 'ERRO_VALIDACAO' && 
              error?.error?.mensagem?.includes('CAR já está sendo usado')) {
            this.carDuplicateMessage = error.error.mensagem;
            this.showCarDuplicateModal = true;
          } else {
            // Outros tipos de erro podem ser tratados aqui
            console.error('Erro não tratado:', error);
          }
        }
      });
    }
  }

  deleteItem(item: CalculoRegistrado) {
    this.selectedItem = item;
    this.showDeleteModal = true;

    // Show scrim if available
    if (this.scrimInstance) {
      this.scrimInstance.showScrim();
    }
  }

  openDeleteModal(item: CalculoRegistrado) {
    this.selectedItem = item;
    this.showDeleteModal = true;
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.selectedItem = null;

    // Hide scrim if available
    if (this.scrimInstance) {
      this.scrimInstance.hideScrim();
    }
  }

  confirmDelete() {
    if (this.selectedItem && this.selectedItem.id) {
      this.isLoadingData = true;
      this.loadingMessage = 'Excluindo cálculo...';

      this.calculoRegistradoService.excluir(this.selectedItem.id).subscribe({
        next: () => {
          console.log('Cálculo excluído com sucesso');
          this.closeDeleteModal();
          this.loadCalculos(); // Recarregar a lista
        },
        error: (error) => {
          console.error('Erro ao excluir cálculo:', error);
          this.isLoadingData = false;
          this.loadingMessage = '';
          // Aqui você pode adicionar uma notificação de erro
        }
      });
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Concluído':
        return 'status-concluido';
      case 'Rascunho':
        return 'status-rascunho';
      case 'Ajustar':
        return 'status-ajustar';
      default:
        return '';
    }
  }

  getCertificacaoClass(certificacao: string): string {
    switch (certificacao) {
      case 'Certificado':
        return 'cert-certificado';
      case 'Não certificado':
        return 'cert-nao-certificado';
      case 'Não iniciado':
        return 'cert-nao-iniciado';
      case 'Em certificação':
        return 'cert-em-certificacao';
      default:
        return '';
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  get paginatedItems(): CalculoRegistrado[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredCalculos.slice(startIndex, startIndex + this.itemsPerPage);
  }

  onMenuToggle(isOpen: boolean): void {
    this.isMenuOpen = isOpen;
  }

  onMenuItemClick(item: MenuItem): void {
    if (item.route) {
      this.router.navigate([item.route]);
      this.isMenuOpen = false;
    }
  }

  openProcuracaoModal(): void {
    this.showProcuracaoModal = true;
  }

  onProcuracaoClose(): void {
    this.showProcuracaoModal = false;
  }

  onProcuracaoSubmit(data: ProcuracaoData): void {
    console.log('Dados da procuração:', data);
    // Implementar lógica para salvar a procuração
    this.showProcuracaoModal = false;
  }

  onProcuracaoSuccess(): void {
    this.showProcuracaoSuccessModal = true;
  }

  closeProcuracaoSuccessModal(): void {
    this.showProcuracaoSuccessModal = false;
  }

  // Método para verificar nome duplicado antes de salvar
  verificarNomeDuplicadoAntesSalvar(fazenda: string, callback: () => void, idExcluir?: number): void {
    if (!fazenda || fazenda.trim().length === 0) {
      callback();
      return;
    }

    this.isVerificandoNome = true;
    const user = this.authService.getCurrentUser();
    const usuarioId = user?.id ? Number(user.id) : 0;
    const ano = this.novoInventario.ano || new Date().getFullYear();
    
    console.log('DEBUG - Chamando verificarFazendaExistente:', {
      fazenda: fazenda,
      ano: ano,
      usuarioId: usuarioId,
      idExcluir: idExcluir
    });
    
    this.calculoRegistradoService.verificarFazendaExistente(fazenda, ano, usuarioId, idExcluir)
      .subscribe({
        next: (existe: boolean) => {
          console.log('DEBUG - Resposta do backend:', existe);
          this.isVerificandoNome = false;
          if (existe) {
            this.duplicateNameMessage = `Já existe uma fazenda com o nome "${fazenda}" para o ano ${ano}. Por favor, escolha um nome diferente ou altere o ano.`;
            this.showDuplicateNameModal = true;
          } else {
            callback();
          }
        },
        error: (error: any) => {
          console.error('Erro ao verificar nome duplicado:', error);
          this.isVerificandoNome = false;
          // Em caso de erro na verificação, prosseguir com o salvamento
          callback();
        }
      });
  }

  // Método para fechar modal de nome duplicado
  closeDuplicateNameModal(): void {
    this.showDuplicateNameModal = false;
    this.duplicateNameMessage = '';
  }

  closeCarDuplicateModal(): void {
    this.showCarDuplicateModal = false;
    this.carDuplicateMessage = '';
  }

  // Método chamado quando o nome da fazenda é alterado
  onNomeFazendaChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (!target) return;

    const fazenda = target.value;
    this.novoInventario.fazenda = fazenda;
    
    // Reset do estado de nome duplicado quando o usuário digita
    this.showDuplicateNameModal = false;
    this.duplicateNameMessage = '';
  }

  // Método para extrair apenas o segundo número do CAR para exibição na tabela
  getCarDisplayNumber(car: string): string {
    if (!car) return '';
    
    // Formato esperado: UF-1234567-XXXX.XXXX.XXXX.XXXX.XXXX.XXXX.XXXX.XXXX
    // Queremos extrair apenas o "1234567" (segundo número)
    const parts = car.split('-');
    if (parts.length >= 2) {
      return parts[1]; // Retorna o segundo número (1234567)
    }
    
    return car; // Se não conseguir extrair, retorna o CAR completo
  }

  preventNegativeInput(event: any): void {
    const value = parseFloat(event.target.value);
    if (value < 0) {
      event.target.value = '';
      this.novoInventario.tamanho = 0;
    }
  }
}