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
import { InsumoRebanhoService } from '../../core/services/insumo-rebanho.service';
import {
  InsumoRebanhoRequest,
  InsumoRebanhoResponse,
  InsumoRebanhoFiltros,
  EscopoEnum,
  TipoInsumo,
  GrupoIngredienteAlimentar,
  FazParteDieta,
  UnidadeProdutoReferencia,
  FatoresEmissao
} from '../../core/models/insumo-rebanho.model';



interface InsumoForm {
  escopo1: {
    tipo: TipoInsumo;
    identificacaoProduto: string;
    fonteDataset: string;
    datasetProduto: string;
    uuidDataset: string;
    quantidadeProduto: number;
    unidade: string;
    metodoAvaliacaoGwp: string;
    geeTotal: number;
    co2Fossil: number;
    usoTerra: number;
    ch4Fossil: number;
    ch4Biogenico: number;
    n2o: number;
    outrasSubstancias: number;
    comentarios: string;
  };
  escopo3: {
    grupoIngrediente: GrupoIngredienteAlimentar;
    nomeProduto: string;
    tipo: TipoInsumo;
    quantidadeProdutoReferencia: number;
    unidadeProdutoReferencia: UnidadeProdutoReferencia;
    geeTotal: number;
    gwpFossil: number;
    gwpBiogenico: number;
    gwpTransformacao: number;
    dioxidoCarbonoFossil: number;
    dioxidoCarbonoMetano: number;
    metanoFossil: number;
    metanoBiogenico: number;
    oxidoNitroso: number;
    outrasSubstancias: number;
    fazParteDieta: FazParteDieta;
    ingrediente: string;
    notEu: string;
    energiaBruta: number;
    msKg: number;
    proteinaBruta: number;
    fatoresEmissao: FatoresEmissao;
    comentarios: string;
  };
}

@Component({
  selector: 'app-rebanho',
  standalone: true,
  imports: [CommonModule, FormsModule, BrLoadingComponent, HamburgerMenuComponent],
  templateUrl: './rebanho.component.html',
  styleUrls: ['./rebanho.component.scss']
})
export class RebanhoComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  isHighContrast = false;
  isVLibrasActive = false;
  
  // Menu properties
  menuItems: MenuItem[] = STANDARD_MENU_ITEMS;
  isMenuOpen = false;

  readonly Math = Math;
  readonly FazParteDieta = FazParteDieta;

  // Loading states
  isLoading = false;
  loadingMessage = '';

  // Modal states
  showCreateModal = false;
  showEditModal = false;

  showCancelConfirmModal = false;
  showSaveConfirmModal = false;
  showRequiredFieldsModal = false;
  showFieldLengthModal = false;
  showDuplicateNameModal = false;
  isEditMode = false;
  requiredFieldsErrors: string[] = [];
  fieldLengthErrors: string[] = [];
  
  isVerificandoNome = false;
  nomeJaExiste = false;
  isSaving = false;
  duplicateNameInfo = {
    nome: '',
    tipo: ''
  };

  // Selected item for operations
  selectedItem: InsumoRebanhoResponse | null = null;
  pendingAction: 'cancel' | 'save' | null = null;

  // Tab management
  activeTab: 'escopo1' | 'escopo3' = 'escopo1';

  // Form data
  novoInsumo: InsumoForm = this.getInitialFormState();

  // Opções para dropdowns
  readonly tiposInsumo = [
    { value: TipoInsumo.INGREDIENTES_ALIMENTARES, label: 'Ingredientes Alimentares' },
    { value: TipoInsumo.ANIMAIS_COMPRADOS, label: 'Animais Comprados' },
    { value: TipoInsumo.FERTILIZANTES, label: 'Fertilizantes' },
    { value: TipoInsumo.COMBUSTIVEIS, label: 'Combustíveis' },
    { value: TipoInsumo.ENERGIA, label: 'Energia' }
  ];

  readonly escopos = [
    { value: EscopoEnum.ESCOPO_1, label: 'Escopo 1' },
    { value: EscopoEnum.ESCOPO_2, label: 'Escopo 2' },
    { value: EscopoEnum.ESCOPO_3_PRODUCAO, label: 'Escopo 3 - Produção' },
    { value: EscopoEnum.ESCOPO_3_TRANSPORTE, label: 'Escopo 3 - Transporte' }
  ];

  readonly gruposIngredientes = [
    { value: GrupoIngredienteAlimentar.CEREAIS_E_GRAOS, label: 'Cereais e grãos' },
    { value: GrupoIngredienteAlimentar.LEGUMINOSAS, label: 'Leguminosas' },
    { value: GrupoIngredienteAlimentar.OLEAGINOSAS, label: 'Oleaginosas' }
  ];

  readonly unidadesProduto = [
    { value: UnidadeProdutoReferencia.KG, label: 'Quilograma (kg)' },
    { value: UnidadeProdutoReferencia.T, label: 'Tonelada (t)' },
    { value: UnidadeProdutoReferencia.G, label: 'Grama (g)' }
  ];

  readonly unidadesEscopo1 = [
    { value: 'KG', label: 'kg' },
    { value: 'T', label: 'ton' },
    { value: 'G', label: 'g' }
  ];

  readonly opcoesFazParteDieta = [
    { value: FazParteDieta.SIM, label: 'Sim' },
    { value: FazParteDieta.NAO, label: 'Não' }
  ];

  readonly fatoresEmissao = [
    { value: FatoresEmissao.CALCULADO, label: 'Calculado' },
    { value: FatoresEmissao.ESTIMADO, label: 'Estimado' }
  ];

  // Data
  insumos: InsumoRebanhoResponse[] = [];
  filteredInsumos: InsumoRebanhoResponse[] = [];

  // Search and pagination
  searchTerm = '';
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;

  private readonly accessibilityService = inject(AccessibilityService);
  private readonly notificationService = inject(NotificationService);
  private readonly insumoRebanhoService = inject(InsumoRebanhoService);

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService
  ) {
    this.accessibilityService.isHighContrast$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((isActive: boolean) => {
      this.isHighContrast = isActive;
    });
    
    this.accessibilityService.isVLibrasActive$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((isActive: boolean) => {
      this.isVLibrasActive = isActive;
    });
  }

  ngOnInit(): void {
    this.carregarInsumos();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getInitialFormState(): InsumoForm {
    return {
      escopo1: {
        tipo: '' as any,
        identificacaoProduto: '',
        fonteDataset: '',
        datasetProduto: '',
        uuidDataset: '',
        quantidadeProduto: 0,
        unidade: '',
        metodoAvaliacaoGwp: '',
        geeTotal: 0,
        co2Fossil: 0,
        usoTerra: 0,
        ch4Fossil: 0,
        ch4Biogenico: 0,
        n2o: 0,
        outrasSubstancias: 0,
        comentarios: ''
      },
      escopo3: {
        grupoIngrediente: '' as any,
        nomeProduto: '',
        tipo: '' as any,
        quantidadeProdutoReferencia: 0,
        unidadeProdutoReferencia: '' as any,
        geeTotal: 0,
        gwpFossil: 0,
        gwpBiogenico: 0,
        gwpTransformacao: 0,
        dioxidoCarbonoFossil: 0,
        dioxidoCarbonoMetano: 0,
        metanoFossil: 0,
        metanoBiogenico: 0,
        oxidoNitroso: 0,
        outrasSubstancias: 0,
        fazParteDieta: '' as any,
        ingrediente: '',
        notEu: '',
        energiaBruta: 0,
        msKg: 0,
        proteinaBruta: 0,
        fatoresEmissao: '' as any,
        comentarios: ''
      }
    };
  }

  private setLoading(loading: boolean, message: string = ''): void {
    this.isLoading = loading;
    this.loadingMessage = message;
  }

  private updateFilteredData(): void {
    if (!this.searchTerm.trim()) {
      this.filteredInsumos = [...this.insumos];
    } else {
      const term = this.searchTerm.toLowerCase().trim();
      this.filteredInsumos = this.insumos.filter(insumo => 
        insumo.identificacaoProduto.toLowerCase().includes(term) ||
        insumo.tipo.toLowerCase().includes(term) ||
        insumo.modulo.toLowerCase().includes(term) ||
        insumo.escopo.toLowerCase().includes(term)
      );
    }
    this.totalItems = this.filteredInsumos.length;
    this.currentPage = 1;
  }

  // Modal management
  openCreateModal(): void {
    this.isEditMode = false;
    this.novoInsumo = this.getInitialFormState();
    this.activeTab = 'escopo1';
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.resetForm();
  }

  confirmCloseCreateModal(): void {
    this.pendingAction = 'cancel';
    this.showCancelConfirmModal = true;
  }

  confirmCloseEditModal(): void {
    this.pendingAction = 'cancel';
    this.showCancelConfirmModal = true;
  }

  confirmSubmitCreate(): void {
    this.salvarInsumo();
  }

  confirmSubmitEdit(): void {
    this.salvarInsumo();
  }

  confirmCloseModal(): void {
    this.showCancelConfirmModal = true;
  }

  confirmSubmit(): void {
    this.showSaveConfirmModal = true;
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
    this.showCancelConfirmModal = false;
    if (this.isEditMode) {
      this.showEditModal = false;
    } else {
      this.showCreateModal = false;
    }
    this.resetForm();
  }

  confirmSave(): void {
    this.showSaveConfirmModal = false;
    if (this.isEditMode) {
      this.onSubmitEdit();
    } else {
      this.onSubmitCreate();
    }
  }

  openEditModal(insumo: InsumoRebanhoResponse): void {
    this.isEditMode = true;
    this.selectedItem = insumo;
    
    // Set active tab based on the record's scope
    this.activeTab = insumo.escopo === EscopoEnum.ESCOPO_1 ? 'escopo1' : 'escopo3';
    
    // Populate form with existing data
    this.novoInsumo = {
      escopo1: {
        tipo: insumo.tipo,
        identificacaoProduto: insumo.identificacaoProduto,
        fonteDataset: insumo.fonteDataset,
        datasetProduto: insumo.datasetProduto || '',
        uuidDataset: insumo.uuid || '',
        quantidadeProduto: insumo.quantidade || 0,
        unidade: insumo.unidade || '',
        metodoAvaliacaoGwp: insumo.metodoAvaliacaoGwp || '',
        geeTotal: insumo.geeTotalEscopo1 || 0,
        co2Fossil: insumo.co2FossilEscopo1 || 0,
        usoTerra: insumo.usoTerraEscopo1 || 0,
        ch4Fossil: insumo.ch4FossilEscopo1 || 0,
        ch4Biogenico: insumo.ch4BiogenicoEscopo1 || 0,
        n2o: insumo.n2oEscopo1 || 0,
        outrasSubstancias: insumo.outrasSubstanciasEscopo1 || 0,
        comentarios: insumo.comentariosEscopo1 || insumo.comentarios || ''
      },
      escopo3: {
        grupoIngrediente: insumo.grupoIngrediente || GrupoIngredienteAlimentar.CEREAIS_E_GRAOS,
        nomeProduto: insumo.nomeProduto || '',
        tipo: insumo.tipo,
        quantidadeProdutoReferencia: insumo.quantidadeProdutoReferencia || 1,
        unidadeProdutoReferencia: insumo.unidadeProduto || UnidadeProdutoReferencia.KG,

        geeTotal: insumo.geeTotalEscopo3 || 0,
        gwpFossil: insumo.gwp100FossilEscopo3 || 0,
        gwpBiogenico: insumo.gwp100BiogenicoEscopo3 || 0,
        gwpTransformacao: insumo.gwp100TransformacaoEscopo3 || 0,
        dioxidoCarbonoFossil: insumo.dioxidoCarbonoFossilEscopo3 || 0,
        dioxidoCarbonoMetano: insumo.dioxidoCarbonoMetanoTransformacaoEscopo3 || 0,
        metanoFossil: insumo.metanoFossilEscopo3 || 0,
        metanoBiogenico: insumo.metanoBiogenicoEscopo3 || 0,
        oxidoNitroso: insumo.oxidoNitrosoEscopo3 || 0,
        outrasSubstancias: insumo.outrasSubstanciasEscopo3 || 0,
        fazParteDieta: insumo.fazParteDieta || FazParteDieta.NAO,
        ingrediente: insumo.ingrediente || '',
        notEu: insumo.notEu || '',
        energiaBruta: insumo.energiaBruta || 0,
        msKg: insumo.ms || 0,
        proteinaBruta: insumo.proteinaBruta || 0,
        fatoresEmissao: insumo.fatoresEmissao || FatoresEmissao.CALCULADO,
        comentarios: insumo.comentariosEscopo3 || insumo.comentarios || ''
      }
    };
    
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.resetForm();
  }



  // Tab management
  setActiveTab(tab: 'escopo1' | 'escopo3'): void {
    this.activeTab = tab;
  }

  onDietaChange(): void {
    // Reset conditional fields when diet option changes
    if (this.novoInsumo.escopo3.fazParteDieta !== FazParteDieta.SIM) {
      this.novoInsumo.escopo3.ingrediente = '';
      this.novoInsumo.escopo3.notEu = '';
      this.novoInsumo.escopo3.energiaBruta = 0;
      this.novoInsumo.escopo3.msKg = 0;
      this.novoInsumo.escopo3.proteinaBruta = 0;
      this.novoInsumo.escopo3.fatoresEmissao = FatoresEmissao.CALCULADO;
    }
  }

  // Data operations
  carregarInsumos(): void {
    this.setLoading(true, 'Carregando insumos...');
    
    this.insumoRebanhoService.listar().subscribe({
      next: (insumos) => {
        this.insumos = insumos;
        this.updateFilteredData();
        this.setLoading(false);
      },
      error: (error) => {
        console.error('Erro ao carregar insumos:', error);
        this.notificationService.error('Erro ao carregar insumos');
        this.setLoading(false);
      }
    });
  }

  private criarInsumoRequest(): InsumoRebanhoRequest {
    const user = this.authService.getCurrentUser();
    
    if (!user?.id) {
      throw new Error('Usuário não autenticado');
    }
    
    const usuarioId = parseInt(user.id, 10);
    
    if (isNaN(usuarioId)) {
      throw new Error('ID do usuário inválido');
    }

    const escopo1 = this.novoInsumo.escopo1;
    const escopo3 = this.novoInsumo.escopo3;
    
    const escopo1HasData = escopo1.tipo?.trim() && escopo1.identificacaoProduto?.trim();
    const escopo3HasData = escopo3.nomeProduto?.trim() && escopo3.tipo?.trim();
    
    let escopoFinal: EscopoEnum;
    if (escopo3HasData && !escopo1HasData) {
      escopoFinal = EscopoEnum.ESCOPO_3_PRODUCAO;
    } else if (escopo1HasData && !escopo3HasData) {
      escopoFinal = EscopoEnum.ESCOPO_1;
    } else {
      escopoFinal = this.activeTab === 'escopo1' ? EscopoEnum.ESCOPO_1 : EscopoEnum.ESCOPO_3_PRODUCAO;
    }
    
    const request: InsumoRebanhoRequest = {
      usuarioId,
      modulo: 'REBANHO',
      
      // Usa o escopo determinado pela lógica acima
      escopo: escopoFinal,
      tipo: (escopoFinal === EscopoEnum.ESCOPO_1 ? escopo1.tipo : escopo3.tipo) || escopo1.tipo || escopo3.tipo,
      
      // Campos básicos - prioriza dados baseado no escopo final
      identificacaoProduto: (escopoFinal === EscopoEnum.ESCOPO_1 ? escopo1.identificacaoProduto : escopo3.nomeProduto) || escopo1.identificacaoProduto || escopo3.nomeProduto || '',
      fonteDataset: escopo1.fonteDataset || '',
      datasetProduto: escopo1.datasetProduto || '',
      nomeProduto: escopo3.nomeProduto || '',
      uuid: escopo1.uuidDataset || '',
      quantidade: escopo1.quantidadeProduto || 0,
      unidade: escopo1.unidade || '',
      unidadeProduto: escopo3.unidadeProdutoReferencia || UnidadeProdutoReferencia.KG,
      metodoAvaliacaoGwp: escopo1.metodoAvaliacaoGwp || 'IPCC 2021 GWP 100',
      
      gwp100Fossil: escopo3.gwpFossil || escopo1.geeTotal || 0,
      gwp100Biogenico: escopo3.gwpBiogenico || escopo1.usoTerra || 0,
      gwp100Transformacao: escopo3.gwpTransformacao || 0,
      co2Fossil: escopo3.dioxidoCarbonoFossil || escopo1.co2Fossil || 0,
      co2Ch4Transformacao: escopo3.dioxidoCarbonoMetano || 0,
      ch4Fossil: escopo3.metanoFossil || escopo1.ch4Fossil || 0,
      ch4Biogenico: escopo3.metanoBiogenico || escopo1.ch4Biogenico || 0,
      n2o: escopo3.oxidoNitroso || escopo1.n2o || 0,
      outrasSubstancias: escopo3.outrasSubstancias || escopo1.outrasSubstancias || 0,
      
      geeTotalEscopo1: escopo1.geeTotal || 0,
      co2FossilEscopo1: escopo1.co2Fossil || 0,
      usoTerraEscopo1: escopo1.usoTerra || 0,
      ch4FossilEscopo1: escopo1.ch4Fossil || 0,
      ch4BiogenicoEscopo1: escopo1.ch4Biogenico || 0,
      n2oEscopo1: escopo1.n2o || 0,
      outrasSubstanciasEscopo1: escopo1.outrasSubstancias || 0,
      
      geeTotalEscopo3: escopo3.geeTotal || 0,
      gwp100FossilEscopo3: escopo3.gwpFossil || 0,
      gwp100BiogenicoEscopo3: escopo3.gwpBiogenico || 0,
      gwp100TransformacaoEscopo3: escopo3.gwpTransformacao || 0,
      dioxidoCarbonoFossilEscopo3: escopo3.dioxidoCarbonoFossil || 0,
      dioxidoCarbonoMetanoTransformacaoEscopo3: escopo3.dioxidoCarbonoMetano || 0,
      metanoFossilEscopo3: escopo3.metanoFossil || 0,
      metanoBiogenicoEscopo3: escopo3.metanoBiogenico || 0,
      oxidoNitrosoEscopo3: escopo3.oxidoNitroso || 0,
      outrasSubstanciasEscopo3: escopo3.outrasSubstancias || 0,
      
      comentarios: escopo3.comentarios || escopo1.comentarios || '',
      comentariosEscopo1: escopo1.comentarios || '',
      comentariosEscopo3: escopo3.comentarios || ''
    };
    
    // Adiciona campos específicos do Escopo 3 apenas quando necessário
    if (escopoFinal === EscopoEnum.ESCOPO_3_PRODUCAO) {
      request.grupoIngrediente = escopo3.grupoIngrediente;
      request.fazParteDieta = escopo3.fazParteDieta;
      request.ingrediente = escopo3.ingrediente || '';
      request.notEu = escopo3.notEu || '';
      request.energiaBruta = escopo3.energiaBruta || 0;
      request.ms = escopo3.msKg || 0;
      request.proteinaBruta = escopo3.proteinaBruta || 0;
      request.fatoresEmissao = escopo3.fatoresEmissao;
      request.quantidadeProdutoReferencia = escopo3.quantidadeProdutoReferencia || 0;
    }
    
    // Valida valores numéricos para evitar overflow no banco (precision 10, scale 2)
    const numericFields = [
      'quantidade', 'gwp100Fossil', 'gwp100Biogenico', 'gwp100Transformacao',
      'co2Fossil', 'co2Ch4Transformacao', 'ch4Fossil', 'ch4Biogenico',
      'n2o', 'outrasSubstancias', 'energiaBruta', 'ms', 'proteinaBruta'
    ];
    
    for (const field of numericFields) {
      const value = (request as any)[field];
      if (typeof value === 'number' && value > 99999999.99) {
        throw new Error(`O valor do campo ${this.getFieldDisplayName(field)} (${value}) é muito grande. O valor máximo permitido é 99.999.999,99.`);
      }
    }
    
    // Remove apenas campos undefined/null, mas preserva strings vazias e números zero
    Object.keys(request).forEach(key => {
      const value = (request as any)[key];
      if (value === undefined || value === null) {
        delete (request as any)[key];
      }
      if (typeof value === 'string' && value === '' && !['comentarios'].includes(key)) {
        delete (request as any)[key];
      }
    });
    
    return request;
  }

  async onSubmitCreate(): Promise<void> {
    if (!this.isFormValid()) {
      return;
    }

    // Validação de comprimento desabilitada - limitadores aplicados diretamente nos campos HTML
    // if (!this.validateFieldLengths()) {
    //   return;
    // }

    const nomeParaValidar = this.activeTab === 'escopo1' ? 
      this.novoInsumo.escopo1.identificacaoProduto : 
      this.novoInsumo.escopo3.nomeProduto;
    
    if (await this.checkDuplicateName(nomeParaValidar)) {
      return;
    }
    
    this.setLoading(true, 'Cadastrando insumo...');
    
    try {
      const insumoRequest = this.criarInsumoRequest();
      this.insumoRebanhoService.criar(insumoRequest).subscribe({
        next: (insumo) => {
          this.insumos.push(insumo);
          this.updateFilteredData();
          this.setLoading(false);
          this.showCreateModal = false;
          this.resetForm();
          
          this.notificationService.success('Insumo cadastrado com sucesso!');
        },
        error: (error) => {
          console.error('Erro ao criar insumo:', error);
          this.notificationService.error('Erro ao cadastrar insumo');
          this.setLoading(false);
        }
      });
    } catch (error: any) {
      console.error('Erro de validação:', error);
      this.notificationService.error(error.message || 'Erro de validação');
      this.setLoading(false);
    }
  }

  async onSubmitEdit(): Promise<void> {
    if (!this.selectedItem) return;
    
    if (!this.isFormValid()) {
      return;
    }

    // Validação de comprimento desabilitada - limitadores aplicados diretamente nos campos HTML
    // if (!this.validateFieldLengths()) {
    //   return;
    // }

    // Não validamos nome duplicado durante edição pois o nome do produto no Escopo 3 não pode ser alterado
    // e no Escopo 1 a identificação do produto também permanece inalterada
    
    this.setLoading(true, 'Salvando alterações...');
    
    try {
      const insumoRequest = this.criarInsumoRequest();
      this.insumoRebanhoService.atualizar(this.selectedItem.id, insumoRequest).subscribe({
        next: (insumo) => {
          const index = this.insumos.findIndex(i => i.id === this.selectedItem!.id);
          if (index !== -1) {
            this.insumos[index] = insumo;
          }
          
          this.updateFilteredData();
          this.setLoading(false);
          this.showEditModal = false;
          this.resetForm();
          
          this.notificationService.success('Insumo atualizado com sucesso!');
        },
        error: (error) => {
          console.error('Erro ao atualizar insumo:', error);
          this.notificationService.error('Erro ao atualizar insumo');
          this.setLoading(false);
        }
      });
    } catch (error: any) {
      console.error('Erro de validação:', error);
      this.notificationService.error(error.message || 'Erro de validação');
      this.setLoading(false);
    }
  }



  // UI event handlers
  editarInsumo(id: number): void {
    const insumo = this.insumos.find(i => i.id === id);
    if (insumo) {
      this.openEditModal(insumo);
    }
  }





  onSearch(): void {
    this.updateFilteredData();
  }

  get paginatedData(): InsumoRebanhoResponse[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredInsumos.slice(start, end);
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

  resetForm(): void {
    this.novoInsumo = this.getInitialFormState();
    this.selectedItem = null;
    this.isEditMode = false;
    this.activeTab = 'escopo1';
  }

  // Form validation
  private isFormValid(): boolean {
    this.requiredFieldsErrors = [];
    
    const escopo1HasDataBeyondId = this.hasDataBeyondIdentification('escopo1');
    const escopo3HasDataBeyondId = this.hasDataBeyondIdentification('escopo3');
    
    const escopo1HasId = this.novoInsumo.escopo1.identificacaoProduto?.trim();
    const escopo3HasId = this.novoInsumo.escopo3.nomeProduto?.trim();
    
    if ((this.activeTab === 'escopo1' && escopo1HasId) || escopo1HasDataBeyondId) {
      if (!this.novoInsumo.escopo1.tipo?.trim()) {
        this.requiredFieldsErrors.push('Tipo do insumo (Escopo 1)');
      }
      if (!this.novoInsumo.escopo1.identificacaoProduto?.trim()) {
        this.requiredFieldsErrors.push('Identificação do produto (Escopo 1)');
      }
    }
    
    if ((this.activeTab === 'escopo3' && escopo3HasId) || escopo3HasDataBeyondId) {
      if (!this.novoInsumo.escopo3.grupoIngrediente) {
        this.requiredFieldsErrors.push('Grupo do ingrediente alimentar (Escopo 3)');
      }
      if (!this.novoInsumo.escopo3.nomeProduto?.trim()) {
        this.requiredFieldsErrors.push('Nome do produto (Escopo 3)');
      }
      if (!this.novoInsumo.escopo3.tipo?.trim()) {
        this.requiredFieldsErrors.push('Tipo do insumo (Escopo 3)');
      }
      if (this.novoInsumo.escopo3.fazParteDieta === FazParteDieta.SIM && 
          !this.novoInsumo.escopo3.fatoresEmissao) {
        this.requiredFieldsErrors.push('Fatores de emissão calculados (obrigatório quando "Faz parte da dieta" é "Sim")');
      }
    }
    
    if (!escopo1HasId && !escopo3HasId && !escopo1HasDataBeyondId && !escopo3HasDataBeyondId) {
      this.requiredFieldsErrors.push('É necessário preencher pelo menos um dos escopos (1 ou 3)');
    }
    
    return this.requiredFieldsErrors.length === 0;
  }

  private hasDataBeyondIdentification(escopo: 'escopo1' | 'escopo3'): boolean {
    if (escopo === 'escopo1') {
      return !!(this.novoInsumo.escopo1.tipo?.trim() ||
                this.novoInsumo.escopo1.fonteDataset?.trim() ||
                this.novoInsumo.escopo1.datasetProduto?.trim() ||
                this.novoInsumo.escopo1.uuidDataset?.trim() ||
                this.novoInsumo.escopo1.quantidadeProduto > 0 ||
                this.novoInsumo.escopo1.unidade?.trim() ||
                this.novoInsumo.escopo1.metodoAvaliacaoGwp?.trim() ||
                this.novoInsumo.escopo1.geeTotal > 0 ||
                this.novoInsumo.escopo1.co2Fossil > 0 ||
                this.novoInsumo.escopo1.usoTerra > 0 ||
                this.novoInsumo.escopo1.ch4Fossil > 0 ||
                this.novoInsumo.escopo1.ch4Biogenico > 0 ||
                this.novoInsumo.escopo1.n2o > 0 ||
                this.novoInsumo.escopo1.outrasSubstancias > 0 ||
                this.novoInsumo.escopo1.comentarios?.trim());
    } else {
      return !!(this.novoInsumo.escopo3.grupoIngrediente ||
                this.novoInsumo.escopo3.tipo?.trim() ||
                this.novoInsumo.escopo3.quantidadeProdutoReferencia > 0 ||
                this.novoInsumo.escopo3.unidadeProdutoReferencia ||
                this.novoInsumo.escopo3.geeTotal > 0 ||
                this.novoInsumo.escopo3.gwpFossil > 0 ||
                this.novoInsumo.escopo3.gwpBiogenico > 0 ||
                this.novoInsumo.escopo3.gwpTransformacao > 0 ||
                this.novoInsumo.escopo3.dioxidoCarbonoFossil > 0 ||
                this.novoInsumo.escopo3.dioxidoCarbonoMetano > 0 ||
                this.novoInsumo.escopo3.metanoFossil > 0 ||
                this.novoInsumo.escopo3.metanoBiogenico > 0 ||
                this.novoInsumo.escopo3.oxidoNitroso > 0 ||
                this.novoInsumo.escopo3.outrasSubstancias > 0 ||
                this.novoInsumo.escopo3.fazParteDieta ||
                this.novoInsumo.escopo3.ingrediente?.trim() ||
                this.novoInsumo.escopo3.notEu?.trim() ||
                this.novoInsumo.escopo3.energiaBruta > 0 ||
                this.novoInsumo.escopo3.msKg > 0 ||
                this.novoInsumo.escopo3.proteinaBruta > 0 ||
                this.novoInsumo.escopo3.fatoresEmissao ||
                this.novoInsumo.escopo3.comentarios?.trim());
    }
  }

  private async checkDuplicateName(nome: string): Promise<boolean> {
     try {
       const nomeNormalizado = nome.toUpperCase().trim();
       const duplicata = this.insumos.find(insumo => {
         const nomeExistente = (insumo.identificacaoProduto || insumo.nomeProduto || '')?.toUpperCase()?.trim();
         return nomeExistente === nomeNormalizado;
       });
       
       if (duplicata && (!this.isEditMode || duplicata.id !== this.selectedItem?.id)) {
         this.notificationService.error(`Já existe um insumo com o nome "${nome}". Por favor, escolha um nome diferente.`);
         return true;
       }
       
       return false;
     } catch (error) {
       console.error('Erro ao verificar duplicatas:', error);
       return false;
     }
   }

   private validateFieldLengths(): boolean {
    this.fieldLengthErrors = [];
    
    const maxLengths = {
      identificacaoProduto: 255,
      nomeProduto: 255,
      fonteDataset: 500,
      datasetProduto: 500,
      uuidDataset: 100,
      metodoAvaliacaoGwp: 255,
      comentarios: 1000,
      ingrediente: 255,
      notEu: 255
    };

    if (this.activeTab === 'escopo1' || this.novoInsumo.escopo1.identificacaoProduto?.trim()) {
      if (this.novoInsumo.escopo1.identificacaoProduto.length > maxLengths.identificacaoProduto) {
        this.fieldLengthErrors.push(`Identificação do Produto: máximo ${maxLengths.identificacaoProduto} caracteres (atual: ${this.novoInsumo.escopo1.identificacaoProduto.length})`);
      }
      if (this.novoInsumo.escopo1.fonteDataset.length > maxLengths.fonteDataset) {
        this.fieldLengthErrors.push(`Fonte do Dataset: máximo ${maxLengths.fonteDataset} caracteres (atual: ${this.novoInsumo.escopo1.fonteDataset.length})`);
      }
      if (this.novoInsumo.escopo1.datasetProduto.length > maxLengths.datasetProduto) {
        this.fieldLengthErrors.push(`Dataset do Produto: máximo ${maxLengths.datasetProduto} caracteres (atual: ${this.novoInsumo.escopo1.datasetProduto.length})`);
      }
      if (this.novoInsumo.escopo1.uuidDataset.length > maxLengths.uuidDataset) {
        this.fieldLengthErrors.push(`UUID do Dataset: máximo ${maxLengths.uuidDataset} caracteres (atual: ${this.novoInsumo.escopo1.uuidDataset.length})`);
      }
      if (this.novoInsumo.escopo1.metodoAvaliacaoGwp.length > maxLengths.metodoAvaliacaoGwp) {
        this.fieldLengthErrors.push(`Método de Avaliação GWP: máximo ${maxLengths.metodoAvaliacaoGwp} caracteres (atual: ${this.novoInsumo.escopo1.metodoAvaliacaoGwp.length})`);
      }
      if (this.novoInsumo.escopo1.comentarios.length > maxLengths.comentarios) {
        this.fieldLengthErrors.push(`Comentários (Escopo 1): máximo ${maxLengths.comentarios} caracteres (atual: ${this.novoInsumo.escopo1.comentarios.length})`);
      }
    }

    // Validar campos do Escopo 3
    if (this.activeTab === 'escopo3' || this.novoInsumo.escopo3.nomeProduto?.trim()) {
      if (this.novoInsumo.escopo3.nomeProduto.length > maxLengths.nomeProduto) {
        this.fieldLengthErrors.push(`Nome do Produto: máximo ${maxLengths.nomeProduto} caracteres (atual: ${this.novoInsumo.escopo3.nomeProduto.length})`);
      }
      if (this.novoInsumo.escopo3.ingrediente.length > maxLengths.ingrediente) {
        this.fieldLengthErrors.push(`Ingrediente: máximo ${maxLengths.ingrediente} caracteres (atual: ${this.novoInsumo.escopo3.ingrediente.length})`);
      }
      if (this.novoInsumo.escopo3.notEu.length > maxLengths.notEu) {
        this.fieldLengthErrors.push(`Not EU: máximo ${maxLengths.notEu} caracteres (atual: ${this.novoInsumo.escopo3.notEu.length})`);
      }
      if (this.novoInsumo.escopo3.comentarios.length > maxLengths.comentarios) {
        this.fieldLengthErrors.push(`Comentários (Escopo 3): máximo ${maxLengths.comentarios} caracteres (atual: ${this.novoInsumo.escopo3.comentarios.length})`);
      }
    }

    if (this.fieldLengthErrors.length > 0) {
      this.showFieldLengthModal = true;
      return false;
    }

    return true;
  }
  
  private getFieldDisplayName(field: string): string {
    const fieldNames: { [key: string]: string } = {
      'quantidade': 'Quantidade',
      'gwp100Fossil': 'GWP 100 Fóssil',
      'gwp100Biogenico': 'GWP 100 Biogênico',
      'gwp100Transformacao': 'GWP 100 Transformação',
      'co2Fossil': 'CO2 Fóssil',
      'co2Ch4Transformacao': 'CO2 CH4 Transformação',
      'ch4Fossil': 'CH4 Fóssil',
      'ch4Biogenico': 'CH4 Biogênico',
      'n2o': 'N2O',
      'outrasSubstancias': 'Outras Substâncias',
      'energiaBruta': 'Energia Bruta',
      'ms': 'Massa Seca (MS)',
      'proteinaBruta': 'Proteína Bruta'
    };
    
    return fieldNames[field] || field;
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      }
    });
  }

  toggleHighContrast(): void {
    this.accessibilityService.toggleHighContrast();
  }

  toggleVLibras(): void {
    this.isVLibrasActive = !this.isVLibrasActive;
    this.accessibilityService.toggleVLibras();
  }

  closeRequiredFieldsModal(): void {
    this.showRequiredFieldsModal = false;
    this.requiredFieldsErrors = [];
  }

  closeFieldLengthModal(): void {
    this.showFieldLengthModal = false;
    this.fieldLengthErrors = [];
  }

  closeDuplicateNameModal(): void {
    this.showDuplicateNameModal = false;
    this.duplicateNameInfo = {
    nome: '',
    tipo: ''
  };
  }

  salvarInsumo(): void {
    if (!this.isFormValid()) {
      this.showRequiredFieldsModal = true;
      return;
    }

    // Durante a edição, não validamos nome duplicado pois os campos de nome estão desabilitados
    if (this.isEditMode) {
      this.executarSalvamento();
      return;
    }

    const identificacao = this.activeTab === 'escopo1' 
      ? this.novoInsumo.escopo1.identificacaoProduto 
      : this.novoInsumo.escopo3.nomeProduto;
      
    if (identificacao && identificacao?.trim().length > 0) {
      this.verificarNomeDuplicadoAntesSalvar(identificacao);
    } else {
      this.executarSalvamento();
    }
  }

  private verificarNomeDuplicadoAntesSalvar(identificacao: string): void {
    this.isVerificandoNome = true;
    
    const user = this.authService.getCurrentUser();
    if (!user?.id) {
      this.executarSalvamento();
      return;
    }
    
    const usuarioId = parseInt(user.id, 10);
    if (isNaN(usuarioId)) {
      this.executarSalvamento();
      return;
    }
    
    this.insumoRebanhoService.verificarExistenciaProduto(identificacao, usuarioId).subscribe({
      next: (response) => {
        this.isVerificandoNome = false;
        
        if (this.isEditMode && this.selectedItem) {
          const nomeAtual = this.selectedItem.identificacaoProduto;
          if (nomeAtual === identificacao) {
            this.executarSalvamento();
            return;
          }
        }
        
        if (response.exists) {
          this.nomeJaExiste = true;
          this.duplicateNameInfo = {
            nome: identificacao,
            tipo: this.activeTab === 'escopo1' ? 'Identificação do produto' : 'Nome do produto'
          };
          this.showDuplicateNameModal = true;
        } else {
          this.nomeJaExiste = false;
          this.executarSalvamento();
        }
      },
      error: (error) => {
        console.error('Erro ao verificar nome duplicado:', error);
        this.isVerificandoNome = false;
        this.executarSalvamento();
      }
    });
  }

  private executarSalvamento(): void {
    this.isSaving = true;
    
    if (this.isEditMode && this.selectedItem) {
      this.atualizarInsumoExistente();
    } else {
      this.criarNovoInsumo();
    }
  }

  private criarNovoInsumo(): void {
    this.onSubmitCreate();
  }

  private atualizarInsumoExistente(): void {
    this.onSubmitEdit();
  }



  onIdentificacaoChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (!target) return;

    const identificacao = target.value;
    
    if (this.activeTab === 'escopo1') {
      this.novoInsumo.escopo1.identificacaoProduto = identificacao;
      this.novoInsumo.escopo3.nomeProduto = identificacao;
    }
    
    this.nomeJaExiste = false;
  }

  onNomeProdutoChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (!target) return;

    const nomeProduto = target.value;
    
    if (this.activeTab === 'escopo3') {
      this.novoInsumo.escopo3.nomeProduto = nomeProduto;
      this.novoInsumo.escopo1.identificacaoProduto = nomeProduto;
    }
    
    this.nomeJaExiste = false;
  }

  onTipoEscopo1Change(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (!target) return;

    const tipo = target.value as TipoInsumo;
    
    this.novoInsumo.escopo1.tipo = tipo;
    this.novoInsumo.escopo3.tipo = tipo;
  }

  onTipoEscopo3Change(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (!target) return;

    const tipo = target.value as TipoInsumo;
    
    this.novoInsumo.escopo3.tipo = tipo;
    this.novoInsumo.escopo1.tipo = tipo;
  }

  // Menu handlers
  onMenuToggle(isOpen: boolean): void {
    this.isMenuOpen = isOpen;
  }

  onMenuItemClick(item: MenuItem): void {
    if (item.route) {
      this.router.navigate([item.route]);
    }
    this.isMenuOpen = false;
  }

  // Métodos para converter enums para valores legíveis
  getEscopoLabel(escopo: string): string {
    const escopoLabels: { [key: string]: string } = {
      'ESCOPO1': 'Escopo 1',
      'ESCOPO2': 'Escopo 2', 
      'ESCOPO3_PRODUCAO': 'Escopo 3 - Produção',
      'ESCOPO_3_PRODUCAO': 'Escopo 3 - Produção',
      'ESCOPO3_TRANSPORTE': 'Escopo 3 - Transporte',
      'ESCOPO_3_TRANSPORTE': 'Escopo 3 - Transporte'
    };
    return escopoLabels[escopo] || escopo;
  }

  getTipoLabel(tipo: string): string {
    const tipoLabels: { [key: string]: string } = {
      'INGREDIENTES_ALIMENTARES': 'Ingredientes Alimentares',
      'ANIMAIS_COMPRADOS': 'Animais Comprados',
      'FERTILIZANTES': 'Fertilizantes',
      'COMBUSTIVEIS': 'Combustíveis',
      'ENERGIA': 'Energia'
    };
    return tipoLabels[tipo] || tipo;
  }
}