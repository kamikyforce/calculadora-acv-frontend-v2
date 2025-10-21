import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { AccessibilityService } from '../../core/services/accessibility.service';
import { InsumoProducaoAgricolaService } from '../../services/insumo-producao-agricola.service';
import { InsumoProducaoAgricola, InsumoProducaoAgricolaRequest } from '../../models/insumo-producao-agricola.model';
import { TipoProducaoAgricola, ClasseProducaoAgricola, UnidadeProduto, ModuloInsumo, EscopoEnum, FatoresEmissao } from '../../enums/producao-agricola.enum';
import { MenuItem, HamburgerMenuComponent } from '../../shared/components/hamburger-menu/hamburger-menu.component';
import { BrLoadingComponent } from '../../shared/components/br-loading/br-loading.component';

interface FormularioEscopo1 {
  // SETOR Classificação (2 campos)
  classe: ClasseProducaoAgricola;
  especificacao: string;
  
  // SETOR Teor de macronutrientes (3 campos)
  teorNitrogenio: number;  // Nitrogênio (N) %
  teorFosforo: number;     // Fósforo (P₂O₅) %
  teorPotassio: number;    // Potássio (K₂O) %
  
  // SETOR Fator de conversão (2 campos)
  fatorConversao: number;        // Valor
  fatorConversaoUnidade: UnidadeProduto; // Unidade
  

  
  // SETOR Fatores de emissão (11 campos - 5 fatores + 6 referências)
  feCo2Biogenico: number;           // FE CO₂ biogênico (kg CO₂ kg⁻¹)
  refFeCo2Biogenico: string;        // Referência FE CO₂ biogênico
  feCo2: number;                    // FE CO₂ (kg CO₂ kg⁻¹)
  refFeCo2: string;                 // Referência FE CO₂
  feCh4: number;                    // FE CH₄ (kg CH₄ kg⁻¹)
  refFeCh4: string;                 // Referência FE CH₄
  feN2oDireto: number;              // FE N₂O direto (kg N₂O kg⁻¹)
  refFeN2oDireto: string;           // Referência FE N₂O direto
  fracN2oVolatilizacao: number;     // FRAC N₂O volatilização (kg N₂O kg⁻¹)
  refFracN2oVolatilizacao: string;  // Referência FRAC N₂O volatilização
  fracN2oLixiviacao: number;        // FRAC N₂O lixiviação (kg N₂O kg⁻¹)
  refFracN2oLixiviacao: string;     // Referência FRAC N₂O lixiviação
  feN2oComposto: number;            // FE N₂O composto (kg N₂O kg⁻¹)
  refFeN2oComposto: string;         // Referência FE N₂O composto
  feCo: number;                     // FE CO
  refFeCo: string;                  // Referência FE CO
  feNox: number;                    // FE NOx
  refFeNox: string;                 // Referência FE NOx
}

interface FormularioEscopo3 {
  // SETOR Identificação e classificação (3 campos)
  grupoIngrediente: string;  // Grupo do ingrediente alimentar
  nomeProduto: string;       // Nome do produto
  tipoProduto: string;       // Tipo
  
  // SETOR Quantidade e unidade de referência (2 campos)
  quantidadeProdutoReferencia: number; // Quantidade do produto de referência
  unidadeProdutoReferencia: UnidadeProduto;    // Unidade do produto de referência
  
  // SETOR Quantidade e unidade (2 campos)
  quantidadeProduto: number; // Quantidade do produto
  unidadeProduto: UnidadeProduto; // Unidade do produto
  
  // SETOR Valores de emissões (GEE) (10 campos)
  gwp100Total: number;                        // GWP 100 - Total
  gwp100Fossil: number;                       // GWP 100 - Fóssil
  gwp100Biogenico: number;                    // GWP 100 - Biogênico
  gwp100Transformacao: number;                // GWP 100 - Transformação do uso do solo
  dioxidoCarbonoFossil: number;               // Dióxido de carbono - Fóssil
  dioxidoCarbonoMetanoTransformacao: number;  // Dióxido de carbono e metano - Transformação do uso do solo
  metanoFossil: number;                       // Metano - Fóssil
  metanoBiogenico: number;                    // Metano - Biogênico
  oxidoNitroso: number;                       // Óxido nitroso
  outrasSubstancias: number;           // Outras substâncias
  
  // SETOR Observações (1 campo)
  comentarios: string; // Comentários
}

@Component({
  selector: 'app-producao-agricola',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, HamburgerMenuComponent, BrLoadingComponent],
  templateUrl: './producao-agricola.component.html',
  styleUrls: ['./producao-agricola.component.scss']
})
export class ProducaoAgricolaComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Estados de carregamento
  isLoading = false;
  loadingMessage = 'Carregando dados...';
  
  // Estados dos modais
  showCreateModal = false;
  showEditModal = false;
  showDeleteModal = false;
  isEditMode = false;
  isVerificandoNome = false;
  
  // Modais de confirmação
  showCancelConfirmModal = false;
  showSaveConfirmModal = false;
  showRequiredFieldsModal = false;
  showFieldLengthModal = false;
  showDuplicateNameModal = false;
  
  // Mensagens dos modais
  fieldLengthMessage = '';
  duplicateNameMessage = '';
  requiredFieldsErrors: string[] = [];
  
  // Controle de abas
  activeTab: 'escopo1' | 'escopo3' = 'escopo1';
  
  // Dados
  insumos: InsumoProducaoAgricola[] = [];
  filteredData: InsumoProducaoAgricola[] = [];
  paginatedData: InsumoProducaoAgricola[] = [];
  
  // Formulário
  novoInsumo = {
    escopo1: this.getEmptyEscopo1Form(),
    escopo3: this.getEmptyEscopo3Form()
  };
  
  insumoParaExcluir: InsumoProducaoAgricola | null = null;
  insumoEditando: InsumoProducaoAgricola | null = null;
  
  // Listas de opções
  tiposProducaoAgricola = [
    { value: TipoProducaoAgricola.FERTILIZANTE, label: 'Fertilizantes' },
    { value: TipoProducaoAgricola.PESTICIDAS, label: 'Pesticidas' },
    { value: TipoProducaoAgricola.SEMENTE, label: 'Sementes' },
    { value: TipoProducaoAgricola.COMBUSTIVEL, label: 'Combustíveis' },
    { value: TipoProducaoAgricola.ENERGIA, label: 'Energia' },
    { value: TipoProducaoAgricola.MAQUINARIO, label: 'Maquinário' },
    { value: TipoProducaoAgricola.OUTRO, label: 'Outros' }
  ];
  
  classesProducaoAgricola = [
    { value: ClasseProducaoAgricola.NITROGENADOS, label: 'Nitrogenados' },
    { value: ClasseProducaoAgricola.FOSFATADOS, label: 'Fosfatados' },
    { value: ClasseProducaoAgricola.POTASSICOS, label: 'Potássicos' },
    { value: ClasseProducaoAgricola.CALCARIOS, label: 'Calcários' },
    { value: ClasseProducaoAgricola.ORGANICOS, label: 'Orgânicos' },
    { value: ClasseProducaoAgricola.MICRONUTRIENTES, label: 'Micronutrientes' },
    { value: ClasseProducaoAgricola.HERBICIDAS, label: 'Herbicidas' },
    { value: ClasseProducaoAgricola.INSETICIDAS, label: 'Inseticidas' },
    { value: ClasseProducaoAgricola.FUNGICIDAS, label: 'Fungicidas' },
    { value: ClasseProducaoAgricola.ACARICIDAS, label: 'Acaricidas' },
    { value: ClasseProducaoAgricola.CEREAIS, label: 'Cereais' },
    { value: ClasseProducaoAgricola.LEGUMINOSAS, label: 'Leguminosas' },
    { value: ClasseProducaoAgricola.OLEAGINOSAS, label: 'Oleaginosas' },
    { value: ClasseProducaoAgricola.FORRAGEIRAS, label: 'Forrageiras' },
    { value: ClasseProducaoAgricola.DIESEL, label: 'Diesel' },
    { value: ClasseProducaoAgricola.GASOLINA, label: 'Gasolina' },
    { value: ClasseProducaoAgricola.ETANOL, label: 'Etanol' },
    { value: ClasseProducaoAgricola.ELETRICA, label: 'Elétrica' },
    { value: ClasseProducaoAgricola.SOLAR, label: 'Solar' },
    { value: ClasseProducaoAgricola.EOLICA, label: 'Eólica' },
    { value: ClasseProducaoAgricola.OUTRO, label: 'Outro' }
  ];
  
  unidadesProduto = [
    { value: UnidadeProduto.KG, label: 'kg' },
    { value: UnidadeProduto.T, label: 'ton' },
    { value: UnidadeProduto.G, label: 'g' },
    { value: UnidadeProduto.L, label: 'L' },
    { value: UnidadeProduto.ML, label: 'mL' },
    { value: UnidadeProduto.HA, label: 'ha' },
    { value: UnidadeProduto.M2, label: 'm²' },
    { value: UnidadeProduto.KWH, label: 'kWh' },
    { value: UnidadeProduto.MJ, label: 'MJ' },
    { value: UnidadeProduto.UNIDADE, label: 'unidade' }
  ];
  

  
  // Enums para template
  TipoProducaoAgricola = TipoProducaoAgricola;
  ClasseProducaoAgricola = ClasseProducaoAgricola;
  
  // Busca e paginação
  searchTerm = '';
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;
  Math = Math; // Para uso no template
  
  // Menu e acessibilidade
  menuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', route: '/dashboard', icon: 'fas fa-tachometer-alt' },
    { id: 'rebanho', label: 'Rebanho', route: '/rebanho', icon: 'fas fa-cow' },
    { id: 'producao-agricola', label: 'Produção Agrícola', route: '/producao-agricola', icon: 'fas fa-seedling' },
    { id: 'relatorios', label: 'Relatórios', route: '/relatorios', icon: 'fas fa-chart-bar' }
  ];
  
  isMenuOpen = false;
  isHighContrast = false;
  isVLibrasActive = false;
  
  private readonly accessibilityService = inject(AccessibilityService);

  constructor(
    private insumoProducaoAgricolaService: InsumoProducaoAgricolaService,
    private router: Router,
    private authService: AuthService
  ) {}
  
  ngOnInit(): void {
    this.carregarInsumos();
    
    // Configurar acessibilidade
    this.accessibilityService.isHighContrast$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(isActive => {
      this.isHighContrast = isActive;
    });
    
    this.accessibilityService.isVLibrasActive$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(isActive => {
      this.isVLibrasActive = isActive;
    });
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  // Métodos de controle de estado
  setLoadingState(loading: boolean, message: string = 'Carregando dados...'): void {
    this.isLoading = loading;
    this.loadingMessage = message;
  }
  
  updateFilteredData(): void {
    if (!this.searchTerm.trim()) {
      this.filteredData = [...this.insumos];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredData = this.insumos.filter(insumo => 
        insumo.nomeProduto?.toLowerCase().includes(term) ||
        insumo.especificacao?.toLowerCase().includes(term) ||
        insumo.classe?.toLowerCase().includes(term) ||
        insumo.ultimaAtualizacao?.toLowerCase().includes(term)
      );
    }
    
    this.totalItems = this.filteredData.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    this.currentPage = 1;
    this.updatePaginatedData();
  }
  
  updatePaginatedData(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedData = this.filteredData.slice(startIndex, endIndex);
  }
  
  // Métodos de modal
  openCreateModal(): void {
    this.resetForm();
    this.isEditMode = false;
    this.showCreateModal = true;
    this.activeTab = 'escopo1';
  }
  
  closeCreateModal(): void {
    this.showCreateModal = false;
    this.resetForm();
  }
  
  openEditModal(insumo: InsumoProducaoAgricola): void {
    this.insumoEditando = insumo;
    this.isEditMode = true;
    this.populateFormForEdit(insumo);
    this.showEditModal = true;
    // Determinar a aba ativa ignorando identificação isolada do Escopo 1
    const escopo1TemDadosAlémIdent = this.hasDataBeyondIdentification('escopo1');
    const escopo3TemDadosAlémIdent = this.hasDataBeyondIdentification('escopo3');
    const escopo3TemIdent = !!this.novoInsumo.escopo3.nomeProduto?.trim();
    if (escopo1TemDadosAlémIdent) {
      this.activeTab = 'escopo1';
    } else if (escopo3TemIdent || escopo3TemDadosAlémIdent) {
      // Se somente identificação estiver preenchida (copiada para escopo1), continuar no Escopo 3
      this.activeTab = 'escopo3';
    } else {
      // Caso excepcional: nenhum dado relevante, manter Escopo 1
      this.activeTab = 'escopo1';
    }
  }
  
  closeEditModal(): void {
    this.showEditModal = false;
    this.isEditMode = false;
    this.insumoEditando = null;
    this.resetForm();
  }

  openDeleteModal(insumo: InsumoProducaoAgricola): void {
    this.insumoParaExcluir = insumo;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.insumoParaExcluir = null;
  }

  confirmDelete(): void {
    if (!this.insumoParaExcluir || !this.insumoParaExcluir.id) return;
    
    this.setLoadingState(true, 'Excluindo insumo...');
    
    this.insumoProducaoAgricolaService.excluir(this.insumoParaExcluir.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.setLoadingState(false);
          this.carregarInsumos();
          this.closeDeleteModal();
        },
        error: (error: any) => {
          console.error('Erro ao excluir insumo:', error);
          this.setLoadingState(false);
        }
      });
  }
  
  confirmCloseModal(): void {
    if (this.isEditMode) {
      this.closeEditModal();
    } else {
      this.closeCreateModal();
    }
  }
  
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
  
  // Métodos de CRUD
  carregarInsumos(): void {
    this.setLoadingState(true, 'Carregando insumos...');
    
    this.insumoProducaoAgricolaService.listarTodos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (insumos: InsumoProducaoAgricola[]) => {
          this.insumos = insumos;
          this.updateFilteredData();
          this.setLoadingState(false);
        },
        error: (error: any) => {
          console.error('Erro ao carregar insumos:', error);
          this.setLoadingState(false);
        }
      });
  }
  
  criarInsumo(): void {
    if (!this.isFormValid()) {
      this.showRequiredFieldsModal = true;
      return;
    }

    if (!this.validateFieldLengths()) {
      return;
    }

    const nomeInsumo = this.activeTab === 'escopo1' ? 
      this.novoInsumo.escopo1.especificacao : 
      this.novoInsumo.escopo3.nomeProduto;

    // Verificar duplicidade no backend
    this.verificarNomeDuplicadoAntesSalvar(nomeInsumo, () => {
      const request = this.createRequestFromForm();
      
      this.setLoadingState(true, 'Cadastrando insumo...');
      
      this.insumoProducaoAgricolaService.criar(request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.setLoadingState(false);
            this.closeCreateModal();
            this.carregarInsumos();
          },
          error: (error: any) => {
            console.error('Erro ao criar insumo:', error);
            this.setLoadingState(false);
            
            // Verificar se é erro de nome duplicado
            if ((error.status === 400 && error.error && error.error.codigo === 'ERRO_VALIDACAO' && 
                error.error.mensagem && error.error.mensagem.includes('Já existe um insumo com este nome')) ||
                (error.message && error.message === 'Dados inválidos')) {
              this.duplicateNameMessage = 'Já existe um insumo com este nome. Por favor, escolha um nome diferente.';
              this.showDuplicateNameModal = true;
            }
          }
        });
    });
  }
  
  excluirInsumo(id: number): void {
    const insumo = this.insumos.find(i => i.id === id);
    if (insumo) {
      this.openDeleteModal(insumo);
    }
  }
  
  editarInsumo(id: number): void {
    const insumo = this.insumos.find(i => i.id === id);
    if (insumo) {
      this.openEditModal(insumo);
    }
  }
  
  salvarEdicao(): void {
    if (!this.insumoEditando) return;
    
    if (!this.isFormValid()) {
      this.showRequiredFieldsModal = true;
      return;
    }

    if (!this.validateFieldLengths()) {
      return;
    }

    const nomeInsumo = this.activeTab === 'escopo1' ? 
      this.novoInsumo.escopo1.especificacao : 
      this.novoInsumo.escopo3.nomeProduto;

    // Verificar duplicidade no backend, excluindo o próprio item
    this.verificarNomeDuplicadoAntesSalvar(nomeInsumo, () => {
      const request = this.createRequestFromForm();
      
      this.setLoadingState(true, 'Salvando alterações...');
      
      this.insumoProducaoAgricolaService.atualizar(this.insumoEditando!.id!, request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.setLoadingState(false);
            this.closeEditModal();
            this.carregarInsumos();
          },
          error: (error: any) => {
              console.error('Erro ao atualizar insumo:', error);
              this.setLoadingState(false);
              
              // Verificar se é erro de nome duplicado
               if ((error.status === 400 && error.error && error.error.codigo === 'ERRO_VALIDACAO' && 
                   error.error.mensagem && error.error.mensagem.includes('Já existe um insumo com este nome')) ||
                   (error.message && error.message === 'Dados inválidos')) {
                 this.duplicateNameMessage = 'Já existe um insumo com este nome. Por favor, escolha um nome diferente.';
                 this.showDuplicateNameModal = true;
               }
            }
        });
    }, this.insumoEditando.id);
  }
  
  // Métodos de busca e paginação
  onSearch(): void {
    this.updateFilteredData();
  }
  
  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedData();
    }
  }
  
  changeItemsPerPage(itemsPerPage: number): void {
    this.itemsPerPage = itemsPerPage;
    this.updateFilteredData();
  }
  
  // Métodos de formulário
  resetForm(): void {
    this.novoInsumo = {
      escopo1: this.getEmptyEscopo1Form(),
      escopo3: this.getEmptyEscopo3Form()
    };
  }
  
  private getEmptyEscopo1Form(): FormularioEscopo1 {
    return {
      // SETOR Classificação
      classe: '' as ClasseProducaoAgricola,
      especificacao: '',
      
      // SETOR Teor de macronutrientes
      teorNitrogenio: 0,
      teorFosforo: 0,
      teorPotassio: 0,
      
      // SETOR Fator de conversão
      fatorConversao: 0,
      fatorConversaoUnidade: '' as UnidadeProduto,
      

      
      // SETOR Fatores de emissão
      feCo2Biogenico: 0,
      refFeCo2Biogenico: '',
      feCo2: 0,
      refFeCo2: '',
      feCh4: 0,
      refFeCh4: '',
      feN2oDireto: 0,
      refFeN2oDireto: '',
      fracN2oVolatilizacao: 0,
      refFracN2oVolatilizacao: '',
      fracN2oLixiviacao: 0,
      refFracN2oLixiviacao: '',
      feN2oComposto: 0,
      refFeN2oComposto: '',
      feCo: 0,
      refFeCo: '',
      feNox: 0,
      refFeNox: ''
    };
  }
  
  private getEmptyEscopo3Form(): FormularioEscopo3 {
    return {
      // SETOR Identificação e classificação
      grupoIngrediente: '',
      nomeProduto: '',
      tipoProduto: '',
      
      // SETOR Quantidade e unidade de referência
      quantidadeProdutoReferencia: 0,
      unidadeProdutoReferencia: '' as UnidadeProduto,
      
      // SETOR Quantidade e unidade
      quantidadeProduto: 0,
      unidadeProduto: '' as UnidadeProduto,
      
      // SETOR Valores de emissões (GEE)
      gwp100Total: 0,
      gwp100Fossil: 0,
      gwp100Biogenico: 0,
      gwp100Transformacao: 0,
      dioxidoCarbonoFossil: 0,
      dioxidoCarbonoMetanoTransformacao: 0,
      metanoFossil: 0,
      metanoBiogenico: 0,
      oxidoNitroso: 0,
      outrasSubstancias: 0,
      
      // SETOR Observações
      comentarios: ''
    };
  }
  
  private populateFormForEdit(insumo: InsumoProducaoAgricola): void {
    // Preencher Escopo 1 se houver dados disponíveis
    this.novoInsumo.escopo1 = {
      classe: (insumo.classe as ClasseProducaoAgricola) || '' as ClasseProducaoAgricola,
      especificacao: insumo.nomeProduto || '',
      // Teores de macronutrientes
      teorNitrogenio: (insumo as any).teorNitrogenio || 0,
      teorFosforo: (insumo as any).teorFosforo || 0,
      teorPotassio: (insumo as any).teorPotassio || 0,
      // Fator de conversão
      fatorConversao: (insumo as any).fatorConversao || 1,
      fatorConversaoUnidade: (insumo as any).fatorConversaoUnidade as UnidadeProduto || '' as UnidadeProduto,

      // Fatores de emissão
       feCo2Biogenico: (insumo as any).feCo2Biogenico || 0,
       feCo2: (insumo as any).feCo2 || 0,
       feCh4: (insumo as any).feCh4 || 0,
       feN2oDireto: (insumo as any).feN2oDireto || 0,
       fracN2oVolatilizacao: (insumo as any).fracN2oVolatilizacao || 0,
       fracN2oLixiviacao: (insumo as any).fracN2oLixiviacao || 0,
       feN2oComposto: (insumo as any).feN2oComposto || 0,
       feCo: (insumo as any).feCo || 0,
       feNox: (insumo as any).feNox || 0,
       // Referências para cada fator de emissão
       refFeCo2Biogenico: (insumo as any).refFeCo2Biogenico || '',
       refFeCo2: (insumo as any).refFeCo2 || '',
       refFeCh4: (insumo as any).refFeCh4 || '',
       refFeN2oDireto: (insumo as any).refFeN2oDireto || '',
       refFracN2oVolatilizacao: (insumo as any).refFracN2oVolatilizacao || '',
       refFracN2oLixiviacao: (insumo as any).refFracN2oLixiviacao || '',
       refFeN2oComposto: (insumo as any).refFeN2oComposto || '',
       refFeCo: (insumo as any).refFeCo || '',
       refFeNox: (insumo as any).refFeNox || ''
    };

    // Preencher Escopo 3 se houver dados disponíveis
    this.novoInsumo.escopo3 = {
       // Identificação e classificação
       grupoIngrediente: (insumo as any).grupoIngrediente || '',
       nomeProduto: insumo.nomeProduto || '',
       tipoProduto: (insumo as any).tipoProduto || '',
       // Quantidade e unidade de referência
       quantidadeProdutoReferencia: (insumo as any).qtdProdutoReferencia || 0,
       unidadeProdutoReferencia: (insumo as any).unidadeProdutoReferencia as UnidadeProduto || '' as UnidadeProduto,
       // Quantidade e unidade
       quantidadeProduto: (insumo as any).quantidadeProduto || 0,
       unidadeProduto: (insumo as any).unidadeProduto as UnidadeProduto || '' as UnidadeProduto,
       // Valores de emissões (GEE)
       gwp100Total: (insumo as any).gwp100Total || 0,
       gwp100Fossil: (insumo as any).gwp100Fossil || 0,
       gwp100Biogenico: (insumo as any).gwp100Biogenico || 0,
       gwp100Transformacao: (insumo as any).gwp100Transformacao || 0,
       dioxidoCarbonoFossil: (insumo as any).dioxidoCarbonoFossil || 0,
       dioxidoCarbonoMetanoTransformacao: (insumo as any).dioxidoCarbonoMetanoTransformacao || 0,
       metanoFossil: (insumo as any).metanoFossil || 0,
       metanoBiogenico: (insumo as any).metanoBiogenico || 0,
       oxidoNitroso: (insumo as any).oxidoNitroso || 0,
       outrasSubstancias: (insumo as any).outrasSubstancias || 0,
       // Observações
       comentarios: insumo.comentarios || ''
     };
  }
  
  private createRequestFromForm(): InsumoProducaoAgricolaRequest {
    const formEscopo1 = this.novoInsumo.escopo1;
    const formEscopo3 = this.novoInsumo.escopo3;
    
    return {
      // Campos de controle
      usuarioId: 1, // TODO: Obter do contexto do usuário logado
      nomeProduto: formEscopo3.nomeProduto || formEscopo1.especificacao,
      
      versao: this.isEditMode ? this.insumoEditando?.versao : undefined,
      
      // Escopo 1 - Classificação
      classe: formEscopo1.classe === 'OUTRO' ? formEscopo1.especificacao : formEscopo1.classe,
      especificacao: formEscopo1.especificacao,
      
      // Escopo 1 - Teor de macronutrientes
      teorNitrogenio: formEscopo1.teorNitrogenio,
      teorFosforo: formEscopo1.teorFosforo,
      teorPotassio: formEscopo1.teorPotassio,
      
      // Escopo 1 - Fator de conversão
      fatorConversao: formEscopo1.fatorConversao,
      unidadeFatorConversao: formEscopo1.fatorConversaoUnidade,
      

      
      // Escopo 1 - Fatores de emissão
      feCo2Biogenico: formEscopo1.feCo2Biogenico,
      refFeCo2Biogenico: formEscopo1.refFeCo2Biogenico,
      feCo2: formEscopo1.feCo2,
      refFeCo2: formEscopo1.refFeCo2,
      feCh4: formEscopo1.feCh4,
      refFeCh4: formEscopo1.refFeCh4,
      feN2oDireto: formEscopo1.feN2oDireto,
      refFeN2oDireto: formEscopo1.refFeN2oDireto,
      fracN2oVolatilizacao: formEscopo1.fracN2oVolatilizacao,
      refFracN2oVolatilizacao: formEscopo1.refFracN2oVolatilizacao,
      fracN2oLixiviacao: formEscopo1.fracN2oLixiviacao,
      refFracN2oLixiviacao: formEscopo1.refFracN2oLixiviacao,
      feN2oComposto: formEscopo1.feN2oComposto,
      refFeN2oComposto: formEscopo1.refFeN2oComposto,
      feCo: formEscopo1.feCo,
      refFeCo: formEscopo1.refFeCo,
      feNox: formEscopo1.feNox,
      refFeNox: formEscopo1.refFeNox,
      
      // Escopo 3 - Identificação e classificação
      grupoIngrediente: formEscopo3.grupoIngrediente,
      tipoProduto: formEscopo3.tipoProduto,
      
      // Escopo 3 - Quantidade e unidade de referência
      qtdProdutoReferencia: formEscopo3.quantidadeProdutoReferencia,
      unidadeProdutoReferencia: formEscopo3.unidadeProdutoReferencia,
      
      // Escopo 3 - Quantidade e unidade
      quantidadeProduto: formEscopo3.quantidadeProduto,
      unidadeProduto: formEscopo3.unidadeProduto,
      
      // Escopo 3 - Valores de emissões (GEE)
      gwp100Total: formEscopo3.gwp100Total,
      gwp100Fossil: formEscopo3.gwp100Fossil,
      gwp100Biogenico: formEscopo3.gwp100Biogenico,
      gwp100Transformacao: formEscopo3.gwp100Transformacao,
      dioxidoCarbonoFossil: formEscopo3.dioxidoCarbonoFossil,
      dioxidoCarbonoMetanoTransformacao: formEscopo3.dioxidoCarbonoMetanoTransformacao,
      metanoFossil: formEscopo3.metanoFossil,
      metanoBiogenico: formEscopo3.metanoBiogenico,
      oxidoNitroso: formEscopo3.oxidoNitroso,
      outrasSubstancias: formEscopo3.outrasSubstancias,
      
      // Observações
      comentarios: formEscopo3.comentarios
    };
  }
  
  // Métodos de validação
  isFormValid(): boolean {
    this.requiredFieldsErrors = [];
    
    const escopo1HasDataBeyondId = this.hasDataBeyondIdentification('escopo1');
    const escopo3HasDataBeyondId = this.hasDataBeyondIdentification('escopo3');
    
    const escopo1HasId = this.novoInsumo.escopo1.especificacao?.trim();
    const escopo3HasId = this.novoInsumo.escopo3.nomeProduto?.trim();
    
    // Escopo 1 só é cobrado se houver dados além da identificação do produto
    if (escopo1HasDataBeyondId) {
      if (!this.novoInsumo.escopo1.classe) {
        this.requiredFieldsErrors.push('Classe (Escopo 1)');
      }
      if (!this.novoInsumo.escopo1.especificacao?.trim()) {
        this.requiredFieldsErrors.push('Especificação (Escopo 1)');
      }
    }
    
    // Escopo 3 só é cobrado se houver dados além da identificação do produto
    if (escopo3HasDataBeyondId) {
      if (!this.novoInsumo.escopo3.grupoIngrediente?.trim()) {
        this.requiredFieldsErrors.push('Grupo do ingrediente (Escopo 3)');
      }
      if (!this.novoInsumo.escopo3.nomeProduto?.trim()) {
        this.requiredFieldsErrors.push('Nome do produto (Escopo 3)');
      }
      if (!this.novoInsumo.escopo3.tipoProduto) {
        this.requiredFieldsErrors.push('Tipo do produto (Escopo 3)');
      }
    }

    // Validação cruzada: referência (quantidade <-> unidade)
    const quantidadeRefPreenchida = (this.novoInsumo.escopo3.quantidadeProdutoReferencia || 0) > 0;
    const unidadeRefPreenchida = !!this.novoInsumo.escopo3.unidadeProdutoReferencia;
    if (quantidadeRefPreenchida && !unidadeRefPreenchida) {
      this.requiredFieldsErrors.push('Unidade do produto de referência (Escopo 3)');
    }
    if (unidadeRefPreenchida && !quantidadeRefPreenchida) {
      this.requiredFieldsErrors.push('Quantidade do produto de referência (Escopo 3)');
    }
    
    if (!escopo1HasId && !escopo3HasId && !escopo1HasDataBeyondId && !escopo3HasDataBeyondId) {
      this.requiredFieldsErrors.push('É necessário preencher pelo menos um dos escopos (1 ou 3)');
    }
    
    return this.requiredFieldsErrors.length === 0;
  }

  private hasDataBeyondIdentification(escopo: 'escopo1' | 'escopo3'): boolean {
    if (escopo === 'escopo1') {
      // Não considerar 'especificacao' (identificação) como gatilho
      return !!(this.novoInsumo.escopo1.teorNitrogenio > 0 ||
                this.novoInsumo.escopo1.teorFosforo > 0 ||
                this.novoInsumo.escopo1.teorPotassio > 0 ||
                // fatorConversao = 1 é padrão e não deve disparar obrigatoriedade
                (this.novoInsumo.escopo1.fatorConversao > 0 && this.novoInsumo.escopo1.fatorConversao !== 1) ||
                this.novoInsumo.escopo1.fatorConversaoUnidade ||
                this.novoInsumo.escopo1.feCo2Biogenico > 0 ||
                this.novoInsumo.escopo1.refFeCo2Biogenico?.trim() ||
                this.novoInsumo.escopo1.feCo2 > 0 ||
                this.novoInsumo.escopo1.refFeCo2?.trim() ||
                this.novoInsumo.escopo1.feCh4 > 0 ||
                this.novoInsumo.escopo1.refFeCh4?.trim() ||
                this.novoInsumo.escopo1.feN2oDireto > 0 ||
                this.novoInsumo.escopo1.refFeN2oDireto?.trim() ||
                this.novoInsumo.escopo1.fracN2oVolatilizacao > 0 ||
                this.novoInsumo.escopo1.refFracN2oVolatilizacao?.trim() ||
                this.novoInsumo.escopo1.fracN2oLixiviacao > 0 ||
                this.novoInsumo.escopo1.refFracN2oLixiviacao?.trim() ||
                this.novoInsumo.escopo1.feN2oComposto > 0 ||
                this.novoInsumo.escopo1.refFeN2oComposto?.trim() ||
                this.novoInsumo.escopo1.feCo > 0 ||
                this.novoInsumo.escopo1.refFeCo?.trim() ||
                this.novoInsumo.escopo1.feNox > 0 ||
                this.novoInsumo.escopo1.refFeNox?.trim());
    } else {
      return !!(this.novoInsumo.escopo3.grupoIngrediente?.trim() ||
                this.novoInsumo.escopo3.tipoProduto ||
                this.novoInsumo.escopo3.quantidadeProdutoReferencia > 0 ||
                this.novoInsumo.escopo3.unidadeProdutoReferencia ||
                this.novoInsumo.escopo3.quantidadeProduto > 0 ||
                this.novoInsumo.escopo3.unidadeProduto ||
                this.novoInsumo.escopo3.gwp100Total > 0 ||
                this.novoInsumo.escopo3.gwp100Fossil > 0 ||
                this.novoInsumo.escopo3.gwp100Biogenico > 0 ||
                this.novoInsumo.escopo3.gwp100Transformacao > 0 ||
                this.novoInsumo.escopo3.dioxidoCarbonoFossil > 0 ||
                this.novoInsumo.escopo3.dioxidoCarbonoMetanoTransformacao > 0 ||
                this.novoInsumo.escopo3.metanoFossil > 0 ||
                this.novoInsumo.escopo3.metanoBiogenico > 0 ||
                this.novoInsumo.escopo3.oxidoNitroso > 0 ||
                this.novoInsumo.escopo3.outrasSubstancias > 0 ||
                this.novoInsumo.escopo3.comentarios?.trim());
    }
  }
  
  // Métodos de confirmação
  confirmSubmitCreate(): void {
    if (!this.isFormValid()) {
      this.showRequiredFieldsModal = true;
      return;
    }
    this.showSaveConfirmModal = true;
  }
  
  confirmSubmitEdit(): void {
    if (!this.isFormValid()) {
      this.showRequiredFieldsModal = true;
      return;
    }
    this.showSaveConfirmModal = true;
  }

  // Verifica se há alterações não salvas
  hasUnsavedChanges(): boolean {
    // Verifica se há alterações em qualquer um dos escopos
    const escopo1Form = this.novoInsumo.escopo1;
    const escopo3Form = this.novoInsumo.escopo3;
    
    // Verifica campos do Escopo 1
    const hasEscopo1Changes = !!(escopo1Form.especificacao?.trim() || 
                                escopo1Form.classe || 
                                escopo1Form.teorNitrogenio !== 0 || 
                                escopo1Form.teorFosforo !== 0 || 
                                escopo1Form.teorPotassio !== 0 ||
                                escopo1Form.fatorConversao !== 0 ||
                                escopo1Form.fatorConversaoUnidade);
    
    // Verifica campos do Escopo 3
    const hasEscopo3Changes = !!(escopo3Form.grupoIngrediente?.trim() || 
                                escopo3Form.nomeProduto?.trim() || 
                                escopo3Form.tipoProduto ||
                                escopo3Form.quantidadeProdutoReferencia !== 0 || 
                                escopo3Form.unidadeProdutoReferencia ||
                                escopo3Form.quantidadeProduto !== 0 ||
                                escopo3Form.comentarios?.trim());
    
    return hasEscopo1Changes || hasEscopo3Changes;
  }

  // Métodos dos modais de confirmação
  confirmCancel(): void {
    this.showCancelConfirmModal = false;
    if (this.isEditMode) {
      this.showEditModal = false;
      this.isEditMode = false;
      this.insumoEditando = null;
    } else {
      this.showCreateModal = false;
    }
    this.resetForm();
  }

  cancelCancel(): void {
    this.showCancelConfirmModal = false;
  }

  confirmSave(): void {
    this.showSaveConfirmModal = false;
    if (this.isEditMode) {
      this.salvarEdicao();
    } else {
      this.criarInsumo();
    }
  }

  cancelSave(): void {
    this.showSaveConfirmModal = false;
  }

  closeRequiredFieldsModal(): void {
    this.showRequiredFieldsModal = false;
  }

  closeFieldLengthModal(): void {
    this.showFieldLengthModal = false;
  }

  closeDuplicateNameModal(): void {
    this.showDuplicateNameModal = false;
  }

  verificarNomeDuplicadoAntesSalvar(nome: string, callback: () => void, idExcluir?: number): void {
    if (!nome || nome.trim() === '') {
      callback();
      return;
    }

    this.isVerificandoNome = true;
    
    // Obter a classe do insumo atual
    let classe: string;
        if (this.insumoEditando) {
          classe = this.insumoEditando.classe === 'OUTRO' ? (this.insumoEditando.especificacao || '') : (this.insumoEditando.classe || '');
        } else {
          classe = this.novoInsumo.escopo1.classe === 'OUTRO' ? (this.novoInsumo.escopo1.especificacao || '') : (this.novoInsumo.escopo1.classe || '');
        }
    const user = this.authService.getCurrentUser();
    const usuarioId = user?.id ? Number(user.id) : 0;
    
    // Log para debug
    console.log('DEBUG FRONTEND - Nome:', nome, 'Classe:', classe, 'UsuarioId:', usuarioId, 'IdExcluir:', idExcluir);
    
    this.insumoProducaoAgricolaService.verificarNomeExistente(nome, usuarioId, classe, idExcluir)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (existe: boolean) => {
          this.isVerificandoNome = false;
          if (existe) {
            this.duplicateNameMessage = `Já existe um insumo com o nome "${nome}" e a mesma classe. Por favor, escolha um nome diferente ou altere a classe.`;
            this.showDuplicateNameModal = true;
          } else {
            callback();
          }
        },
        error: (error: any) => {
          //console.error('Erro ao verificar nome duplicado:', error);
          this.isVerificandoNome = false;
          // Em caso de erro na verificação, prosseguir com o salvamento
          callback();
        }
      });
  }

  // Validação de nomes duplicados
  checkDuplicateName(nome: string): boolean {
    if (!nome || nome.trim() === '') {
      return false;
    }
    
    const nomeNormalizado = this.normalizeString(nome.trim());
    
    return this.insumos.some(insumo => {
      if (this.isEditMode && this.insumoEditando && insumo.id === this.insumoEditando.id) {
        return false; // Ignora o próprio insumo sendo editado
      }
      return this.normalizeString(insumo.nomeProduto?.trim() || '') === nomeNormalizado;
    });
  }

  private normalizeString(str: string): string {
    return str.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
  }

  // Validação de comprimento de campos
  validateFieldLengths(): boolean {
    const currentForm = this.activeTab === 'escopo1' ? this.novoInsumo.escopo1 : this.novoInsumo.escopo3;
    
    if (this.activeTab === 'escopo1') {
      const form = currentForm as FormularioEscopo1;
      
      if (form.especificacao && form.especificacao.length > 255) {
        this.fieldLengthMessage = 'O campo "Especificação" não pode ter mais de 255 caracteres.';
        this.showFieldLengthModal = true;
        return false;
      }
    } else {
      const form = currentForm as FormularioEscopo3;
      
      if (form.grupoIngrediente && form.grupoIngrediente.length > 255) {
        this.fieldLengthMessage = 'O campo "Grupo do Ingrediente" não pode ter mais de 255 caracteres.';
        this.showFieldLengthModal = true;
        return false;
      }
      
      if (form.nomeProduto && form.nomeProduto.length > 255) {
        this.fieldLengthMessage = 'O campo "Nome do Produto" não pode ter mais de 255 caracteres.';
        this.showFieldLengthModal = true;
        return false;
      }
      
      if (form.comentarios && form.comentarios.length > 1000) {
        this.fieldLengthMessage = 'O campo "Comentários" não pode ter mais de 1000 caracteres.';
        this.showFieldLengthModal = true;
        return false;
      }
    }
    
    return true;
  }
  
  // Métodos de controle de abas
  setActiveTab(tab: 'escopo1' | 'escopo3'): void {
    this.activeTab = tab;
  }
  
  // Métodos de eventos específicos
  onClasseChange(escopo: 'escopo1' | 'escopo3'): void {
    // Método mantido para compatibilidade
  }
  
  // Métodos de utilitários para labels
  getTipoLabel(tipo: TipoProducaoAgricola): string {
    const tipoObj = this.tiposProducaoAgricola.find(t => t.value === tipo);
    return tipoObj ? tipoObj.label : tipo;
  }
  
  getClasseLabel(classe: ClasseProducaoAgricola): string {
    const classeObj = this.classesProducaoAgricola.find(c => c.value === classe);
    return classeObj ? classeObj.label : classe;
  }
  
  getEscopoLabel(escopo: number): string {
    return `Escopo ${escopo}`;
  }
  
  // Métodos de sincronização entre campos
  syncEspecificacaoToNomeProduto(event: any): void {
    const value = event.target.value;
    this.novoInsumo.escopo3.nomeProduto = value;
  }

  syncNomeProdutoToEspecificacao(event: any): void {
    const value = event.target.value;
    this.novoInsumo.escopo1.especificacao = value;
  }

  // Sincronização de unidade: referência -> unidade (bloqueada)
  onUnidadeProdutoReferenciaChange(value: UnidadeProduto): void {
    this.novoInsumo.escopo3.unidadeProduto = value;
  }

  // Métodos de acessibilidade e menu
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
    this.accessibilityService.toggleVLibras();
  }
  
  onMenuToggle(isOpen: boolean): void {
    this.isMenuOpen = isOpen;
  }
  
  onMenuItemClick(item: MenuItem): void {
    // Implementar navegação
    console.log('Menu item clicked:', item);
  }

  parseDate(dateString: string | undefined): Date | null {
    if (!dateString) return null;
    
    try {
      const [datePart, timePart] = dateString.split(' ');
      const [day, month, year] = datePart.split('/');
      const [hours, minutes, seconds] = timePart.split(':');
      
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours),
        parseInt(minutes),
        parseInt(seconds)
      );
    } catch (error) {
      console.error('Erro ao converter data:', dateString, error);
      return null;
    }
  }
}