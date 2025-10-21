import { Component, OnInit, OnDestroy, AfterViewInit, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { AccessibilityService } from '../../core/services/accessibility.service';
import { NotificationService } from '../../core/services/notification.service';

import { HamburgerMenuComponent, MenuItem } from '../../shared/components/hamburger-menu/hamburger-menu.component';
import { BrLoadingComponent } from '../../shared/components/br-loading/br-loading.component';
import { DataRegistrationForm, DataRegistrationModalComponent } from '../../shared/components/data-registration-modal/data-registration-modal.component';
import { CombustivelTableComponent } from '../../shared/components/combustivel-table/combustivel-table.component';
import { DecimalFormatDirective } from '../../directives/decimal-format.directive';

// Somente o service de “empresa”
import { EnergiaECombustivelService } from '../../core/services/energia-combustivel.service';
import { STANDARD_MENU_ITEMS } from '../../shared/constants/menu-items';

// ✅ Tipos do serviço de DADOS (com alias para o request)
import {
  EnergiaDadosService,
  EnergiaComFatorResponse,
  EnergiaECombustivelRequest as EnergiaDadosRequest
} from '../../core/services/energia-dados.service';
import { TipoDado } from '../../core/models/tipo-dado.enum';
import { NumberFormatPipe } from "../../shared/pipes/number-format.pipe";

/* ===================== Tratamento de erro (PT-BR) ===================== */
interface AppError { code: string; message: string; field?: string; }

function extractAppError(err: any): AppError {
  const payload = err?.error ?? err;
  const code = payload?.codigo || payload?.code || `HTTP_${err?.status || 0}`;
  const msg  = payload?.mensagem || payload?.message || defaultMessageForStatus(err?.status);
  const field = payload?.campo || payload?.field;
  return { code, message: msg, field };
}
function defaultMessageForStatus(status?: number): string {
  switch (status) {
    case 400: return 'Requisição inválida. Verifique os dados informados.';
    case 401: return 'Sessão expirada ou não autorizada.';
    case 403: return 'Acesso negado.';
    case 404: return 'Recurso não encontrado.';
    case 409: return 'Conflito com dados já existentes.';
    case 422: return 'Regras de negócio não atendidas.';
    case 500: return 'Erro interno ao salvar os dados. Tente novamente.';
    default:  return 'Não foi possível concluir a operação.';
  }
}

/* ===================== Validações leves (cliente) ===================== */
function isAnoValido(ano: any): boolean {
  const n = Number(ano);
  return Number.isInteger(n) && n >= 1900 && n <= 2100;
}
/** Aceita >0 e até 6 casas decimais */
function isAteSeisCasas(n: any): boolean {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return false;
  const dec = (v.toString().split('.')[1] || '').length;
  return dec <= 6;
}

/* ===================== Tipos locais ===================== */
enum TipoEnergiaLocal {
  RENOVAVEL = 'RENOVAVEL',
  NAO_RENOVAVEL = 'NAO_RENOVAVEL',
  HIBRIDA = 'HIBRIDA',
  BIOCOMBUSTIVEL = 'BIOCOMBUSTIVEL',
  TERMICA = 'TERMICA',
  ELETRICA = 'ELETRICA'
}

interface EmpresaEnergiaResponseMin {
  id: number;
  tipoEnergia: string;
  fonteEnergia: string;
  dataCriacao: string;
}

interface EnergiaECombustivel {
  id: number;
  cnpj: string;
  nome: string;
  dataCadastro: string;
  quantidadeInventarios: number;
  tipoEnergia: TipoEnergiaLocal;
  ativo: boolean;
  estado: string;
}

interface EnergiaForm {
  cnpj: string;
  nome: string;
  estado: string;
  tipoEnergia: TipoEnergiaLocal;
  ativo: boolean;
  ano: number;
  fator: number;
}

interface EnergiaData {
  id: number;
  tipoEmissao: string;
  fonteEmissao: string;
  ano: number;
  fatorMedioAnual: number;
  dadosMensais?: { mes: number; valor: number }[];
  versao?: number;
  observacoesAuditoria?: string;
  // 🔥 NOVOS CAMPOS
  mediaAnualCalculada?: number | null;
  mesesPreenchidos?: number | null;
  statusCalculo?: string;
}

interface DadoMensalForm {
  mes: string;
  ano: string;
  valor: number;
  data: string;
}

interface PaginationConfig {
  currentPage: number;
  itemsPerPage: number;
  totalPages: number;
}

@Component({
  selector: 'app-energia-e-combustiveis',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HamburgerMenuComponent,
    BrLoadingComponent,
    DataRegistrationModalComponent,
    CombustivelTableComponent,
    NumberFormatPipe,
    DecimalFormatDirective
],
  templateUrl: './energia-e-combustiveis.component.html',
  styleUrls: ['./energia-e-combustiveis.component.scss']
})
export class EnergiaECombustiveisComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly destroy$ = new Subject<void>();
  private readonly authService = inject(AuthService);
  private readonly accessibilityService = inject(AccessibilityService);
  private readonly notificationService = inject(NotificationService);

  // Propriedades para confirmação de cancelamento
  showCancelConfirmModal = false;
  showSaveConfirmModal = false;
  selectedItem: any = null;
  pendingAction: string = '';

  // Propriedades para validação de nome
  isValidatingName = false;
  nameValidationError = '';
  duplicateNameFound = false;
  private nameValidationTimeout: any;

  // Propriedades para validação de ano
  modalServerDuplicate = false;
  lastValidatedYear: number | null = null; // 🔥 NOVA PROPRIEDADE para evitar validações duplicadas

  // Propriedades para controle de notificações
  private lastNotificationMessage: string | null = null;
  private lastNotificationTime: number = 0;
  private readonly NOTIFICATION_DEBOUNCE_TIME = 2000; // 2 segundos

  @ViewChild(DataRegistrationModalComponent) dataRegistrationModal!: DataRegistrationModalComponent;

  private datepickerInstances: any[] = [];
  private submitting = false;

  loadingStates = {
    main: { isLoading: false, message: '' },
    energias: { isLoading: false, message: '' },
    combustiveis: { isLoading: false, message: '' }
  };

  modalStates = {
    createEnergia: false,
    editEnergia: false,
    addData: false,
    createCombustivel: false,
    editCombustivel: false,
    dataRegistration: false
  };

  editModes = {
    energia: false,
    combustivel: false
  };

  isHighContrast = false;
  isVLibrasActive = false;

  readonly Math = Math;
  readonly TipoEnergia = TipoEnergiaLocal;

  // helpers numéricos (6 casas)
  private to6(n: unknown): number {
    const v = Number(n ?? 0);
    return Number.isFinite(v) ? Number(v.toFixed(6)) : 0;
  }

  energiaForm: EnergiaForm = {
    cnpj: '',
    nome: '',
    estado: '',
    tipoEnergia: TipoEnergiaLocal.RENOVAVEL,
    ativo: true,
    ano: new Date().getFullYear(),
    fator: 0
  };

  dadoMensalForm: DadoMensalForm = {
    mes: '',
    ano: '',
    valor: 0,
    data: ''
  };

  selectedEnergia: EnergiaECombustivel | null = null;
  editingEnergia: EnergiaData | null = null;

  readonly estados = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
    'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
    'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  readonly meses = [
    { value: '01', label: 'Janeiro' },
    { value: '02', label: 'Fevereiro' },
    { value: '03', label: 'Março' },
    { value: '04', label: 'Abril' },
    { value: '05', label: 'Maio' },
    { value: '06', label: 'Junho' },
    { value: '07', label: 'Julho' },
    { value: '08', label: 'Agosto' },
    { value: '09', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' }
  ];

  readonly tiposEnergiaDetalhados = [
    { value: TipoEnergiaLocal.RENOVAVEL, label: 'Renovável' },
    { value: TipoEnergiaLocal.NAO_RENOVAVEL, label: 'Não Renovável' },
    { value: TipoEnergiaLocal.HIBRIDA, label: 'Híbrida' },
    { value: TipoEnergiaLocal.BIOCOMBUSTIVEL, label: 'Biocombustível' }
  ];

  readonly tiposCombustivel = [
    'Gasolina', 'Etanol', 'Diesel', 'GNV', 'Biodiesel',
    'Óleo Combustível', 'Gás Natural', 'Carvão Mineral', 'Lenha', 'Bagaço de Cana'
  ];

  readonly unidadesCombustivel = ['L', 'm³', 'kg', 't', 'kWh', 'MWh', 'GJ', 'TJ'];

  readonly menuItems: MenuItem[] = STANDARD_MENU_ITEMS.map(item => ({
    ...item,
    active: item.id === 'energia-combustiveis'
  }));

  energiasData: EnergiaData[] = [];
  energiasECombustiveis: EnergiaECombustivel[] = [];
  dadosMensais: any[] = [];
  existingYears: number[] = [];
  existingYearsDetailed: { anoReferencia: number; tipoDado: 'CONSOLIDADO_ANUAL' | 'MENSAL' }[] = [];

  filteredEnergiasData: EnergiaData[] = [];
  filteredEnergiasECombustiveis: EnergiaECombustivel[] = [];

  isMenuOpen = false;
  searchTerm = '';
  anoSelecionado = '';
  anos: string[] = [];

  pagination = {
    empresas: { currentPage: 1, itemsPerPage: 10, totalPages: 1 } as PaginationConfig,
    energias: { currentPage: 1, itemsPerPage: 10, totalPages: 1 } as PaginationConfig,
    combustiveis: { currentPage: 1, itemsPerPage: 10, totalPages: 1 } as PaginationConfig
  };

  constructor(
    private readonly router: Router,
    private readonly energiaECombustivelService: EnergiaECombustivelService,
    private readonly energiaDadosService: EnergiaDadosService
  ) {
    this.initializeYears();
  }

  ngOnInit(): void { this.carregarDados(); }
  ngAfterViewInit(): void { this.initializeDatepickers(); }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyDatepickers();
    
    if (this.nameValidationTimeout) {
      clearTimeout(this.nameValidationTimeout);
    }
  }

  // ======================================================
  // Carregamento/Mapeamento
  // ======================================================
  private carregarDados(): void {
    // ... existing code ...
    const user = this.authService.getCurrentUser();
    if (user?.id) {
      const usuarioId = parseInt(user.id, 10);
      if (!isNaN(usuarioId)) this.carregarEnergiasDados(usuarioId);
      else this.showNotificationSafe('error', 'Erro: ID do usuário inválido');
    } else {
      this.showNotificationSafe('error', 'Usuário não autenticado');
    }
    // ... existing code ...
  }

  private carregarEnergiasDados(usuarioId: number): void {
    this.setLoading('energias', true, 'Carregando dados de energia...');
    this.energiaDadosService.listarPorUsuarioComFatores(usuarioId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.energiasData = response.map(this.mapResponseToEnergiaData);
          this.energiasData = this.deduplicateByYear(this.energiasData);
          this.filteredEnergiasData = [...this.energiasData];
          this.updateExistingYears();
          this.updatePagination('energias');
          this.setLoading('energias', false);
        },
        error: (err) => {
          const e = extractAppError(err);
          this.setLoading('energias', false, 'Erro ao carregar dados');
          this.showNotificationSafe('error', e.message);
        }
      });
  }

  private deduplicateByYear(items: EnergiaData[]): EnergiaData[] {
    const map = new Map<number, EnergiaData>();
    for (const item of items) {
      const existing = map.get(item.ano);
      if (!existing || item.id > existing.id) map.set(item.ano, item);
    }
    return Array.from(map.values());
  }

  private mapResponseToEnergia = (response: EmpresaEnergiaResponseMin): EnergiaECombustivel => ({
    id: response.id,
    cnpj: '',
    nome: response.fonteEnergia || '',
    dataCadastro: response.dataCriacao || '',
    quantidadeInventarios: 0,
    tipoEnergia: (response.tipoEnergia as unknown as TipoEnergiaLocal),
    ativo: true,
    estado: ''
  });

  private parseDadosMensais(dados: any): { mes: number; valor: number }[] {
    if (!dados) return [];
    if (Array.isArray(dados)) return dados.map(d => typeof d === 'string' ? JSON.parse(d) : d);
    if (typeof dados === 'string') { try { return JSON.parse(dados); } catch { return []; } }
    return [];
  }

  private mapResponseToEnergiaData = (response: EnergiaComFatorResponse): EnergiaData => {
    // 🔥 PRIORIZAR A MÉDIA CALCULADA DO BACKEND
    let fator = response.fatorMedioAnual;
    
    // Se temos mediaAnualCalculada do backend, usar ela
    if (response.mediaAnualCalculada !== null && response.mediaAnualCalculada !== undefined) {
      fator = response.mediaAnualCalculada;
    } else if ((!fator || fator === 0) && Array.isArray(response.dadosMensais)) {
      // Fallback: calcular manualmente apenas se não temos do backend
      const mensal = this.calcularMediaMensal(response.dadosMensais);
      fator = mensal > 0 ? mensal : 0;
    }
    
    return {
      id: response.id,
      tipoEmissao: response.tipoEnergia,
      fonteEmissao: response.fonteEnergia,
      ano: Number(response.anoReferencia),
      fatorMedioAnual: this.to6(fator ?? 0),
      dadosMensais: this.parseDadosMensais(response.dadosMensais),
      versao: (response as any).versao ?? 1,
      observacoesAuditoria: (response as any).observacoesAuditoria || '',
      // 🔥 ADICIONAR OS NOVOS CAMPOS DO BACKEND
      mediaAnualCalculada: response.mediaAnualCalculada,
      mesesPreenchidos: response.mesesPreenchidos,
      statusCalculo: response.statusCalculo
    };
  };

  private calcularMediaMensal(dados: { mes: number; valor: number }[]): number {
    if (!Array.isArray(dados)) return 0;

    // 🔥 NOVA LÓGICA CORRIGIDA: Sempre dividir por 12 (todos os meses)
    const validos = dados.filter(d => (d?.valor ?? 0) > 0);
    if (validos.length === 0) return 0;

    // Criar array com todos os 12 meses (preenchendo zeros onde necessário)
    const todosMeses = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const dadoMes = dados.find(d => d.mes === mes);
      return Number(dadoMes?.valor) || 0;
    });

    const total = todosMeses.reduce((sum, valor) => sum + valor, 0);
    return this.to6(total / 12); // Sempre divide por 12
  }

  // ======================================================
  // Modais / UI
  // ======================================================
  openModal(type: keyof typeof this.modalStates, item?: any): void {
    this.modalStates[type] = true;

    if (type === 'editEnergia' && item) {
      this.selectedEnergia = item;
      this.editModes.energia = true;

      // preenche o form com valores do item (fallbacks)
      this.energiaForm = {
        cnpj: '',
        nome: item?.nome ?? '',
        estado: '',
        tipoEnergia: this.TipoEnergia.RENOVAVEL,
        ativo: true,
        ano: new Date().getFullYear(),
        fator: 0
      };
    } else {
      this.editModes.energia = false;
    }
  }

  closeModal(type: keyof typeof this.modalStates): void {
    if ((type === 'createEnergia' || type === 'editEnergia') && this.hasUnsavedChanges()) {
      this.confirmClose();
      return;
    }

    this.modalStates[type] = false;
    if (type === 'createEnergia' || type === 'editEnergia') {
      this.editModes.energia = false;
      this.selectedEnergia = null;
      this.resetForms();
      this.clearValidationState();
    }
  }

  openEnergiaEditModal(energia: EnergiaData): void {
    this.editingEnergia = { ...energia, dadosMensais: Array.isArray(energia.dadosMensais) ? energia.dadosMensais : [] };
    setTimeout(() => { this.modalStates.dataRegistration = true; }, 0);
  }

  closeCreateModal(): void {
    if (this.hasUnsavedChanges()) {
      this.confirmClose();
      return;
    }

    this.closeModal('createEnergia');
    this.closeModal('editEnergia');
  }

  // --- trackBy para a tabela de energias
  trackByEnergia(index: number, item: EnergiaData): number {
    return item?.id ?? index;
  }

  // ======================================================
  // Paginação / Filtros
  // ======================================================
  changePageEnergias(newPage: number): void { this.changePage('energias', newPage); }
  changeItemsPerPageEnergias(newItemsPerPage: number): void { this.changeItemsPerPage('energias', newItemsPerPage); }

  getPaginatedData(type: 'empresas' | 'energias' | 'combustiveis'): any[] {
    const config = this.pagination[type];
    const startIndex = (config.currentPage - 1) * config.itemsPerPage;
    const endIndex = startIndex + config.itemsPerPage;

    switch (type) {
      case 'empresas': return this.filteredEnergiasECombustiveis.slice(startIndex, endIndex);
      case 'energias': return this.filteredEnergiasData.slice(startIndex, endIndex);
      default: return [];
    }
  }

  getTotalItems(type: 'empresas' | 'energias' | 'combustiveis'): number {
    switch (type) {
      case 'empresas': return this.filteredEnergiasECombustiveis.length;
      case 'energias': return this.filteredEnergiasData.length;
      default: return 0;
    }
  }

  updatePagination(type: 'empresas' | 'energias' | 'combustiveis'): void {
    const config = this.pagination[type];
    const totalItems = this.getTotalItems(type);
    config.totalPages = Math.ceil(totalItems / config.itemsPerPage) || 1;
    if (config.currentPage > config.totalPages) config.currentPage = 1;
  }

  changePage(type: 'empresas' | 'energias' | 'combustiveis', newPage: number): void {
    const config = this.pagination[type];
    if (newPage >= 1 && newPage <= config.totalPages) config.currentPage = newPage;
  }

  changeItemsPerPage(type: 'empresas' | 'energias' | 'combustiveis', newItemsPerPage: number): void {
    this.pagination[type].itemsPerPage = newItemsPerPage;
    this.pagination[type].currentPage = 1;
    this.updatePagination(type);
  }

  onSearch(): void {
    const term = this.searchTerm.toLowerCase().trim();

    this.filteredEnergiasECombustiveis = this.energiasECombustiveis.filter(item =>
      item.nome.toLowerCase().includes(term) ||
      item.cnpj.includes(term) ||
      item.estado.toLowerCase().includes(term)
    );

    this.filteredEnergiasData = this.energiasData.filter(item =>
      (item.tipoEmissao || '').toLowerCase().includes(term) ||
      (item.fonteEmissao || '').toLowerCase().includes(term)
    );

    (Object.keys(this.pagination) as Array<'empresas' | 'energias' | 'combustiveis'>).forEach(key => {
      this.pagination[key].currentPage = 1;
      this.updatePagination(key);
    });
  }

  filtrarPorAno(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const ano = target.value;
    if (ano === '') { this.exibirTodosOsAnos(); return; }

    const user = this.authService.getCurrentUser();
    if (user?.id) {
      const usuarioId = parseInt(user.id, 10);
      if (!isNaN(usuarioId)) this.carregarEnergiasPorAno(usuarioId, parseInt(ano));
    }
  }

  private carregarEnergiasPorAno(usuarioId: number, ano: number): void {
    this.setLoading('energias', true, `Carregando dados de ${ano}...`);

    this.energiaDadosService.listarPorUsuarioEAno(usuarioId, ano)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.energiasData = response.map(this.mapResponseToEnergiaData);
          this.filteredEnergiasData = [...this.energiasData];
          this.updateExistingYears();
          this.updatePagination('energias');
          this.setLoading('energias', false);
        },
        error: (err) => {
          const e = extractAppError(err);
          this.setLoading('energias', false);
          this.showNotificationSafe('error', e.message);
        }
      });
  }

  exibirTodosOsAnos(): void {
    const user = this.authService.getCurrentUser();
    if (user?.id) {
      const usuarioId = parseInt(user.id, 10);
      if (!isNaN(usuarioId)) this.carregarEnergiasDados(usuarioId);
    }
  }

  // ======================================================
  // Forms básicos
  // ======================================================
  isFormValid(formType: 'energia' | 'combustivel' | 'dadoMensal'): boolean {
    switch (formType) {
      case 'energia': return !!(this.energiaForm.nome && this.energiaForm.cnpj && this.energiaForm.estado);
      case 'dadoMensal': return !!(this.dadoMensalForm.mes && this.dadoMensalForm.ano && this.dadoMensalForm.valor > 0);
      default: return false;
    }
  }

  resetForms(): void {
    this.energiaForm = {
      cnpj: '',
      nome: '',
      estado: '',
      tipoEnergia: TipoEnergiaLocal.RENOVAVEL,
      ativo: true,
      ano: new Date().getFullYear(),
      fator: 0
    };
    this.dadoMensalForm = { mes: '', ano: '', valor: 0, data: '' };
  }

  // ======================================================
  // Acessibilidade / Header
  // ======================================================
  toggleHighContrast(): void { this.isHighContrast = !this.isHighContrast; this.accessibilityService.toggleHighContrast(); }
  toggleVLibras(): void { this.isVLibrasActive = !this.isVLibrasActive; this.accessibilityService.toggleVLibras(); }
  onMenuToggle(isOpen: boolean): void { this.isMenuOpen = isOpen; }
  onMenuItemClick(menuItem: MenuItem): void { if (menuItem.route) this.router.navigate([menuItem.route]); }

  logout(): void {
    this.authService.logout()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => { },
        error: () => { this.router.navigate(['/login'], { replaceUrl: true }); }
      });
  }

  // ======================================================
  // Modal de cadastro/edição de DADOS
  // ======================================================
  openDataRegistrationModal(): void {
    this.updateExistingYears();
    this.modalServerDuplicate = false;
    this.editingEnergia = null; // criação
    this.modalStates.dataRegistration = true;
  }

  closeDataRegistrationModal(resetEditing = true): void {
    this.modalStates.dataRegistration = false;
    this.selectedEnergia = null;
    if (resetEditing) this.editingEnergia = null;
    this.modalServerDuplicate = false;
    this.dataRegistrationModal?.resetForm();
  }

  /**
   * Método inteligente para evitar spam de notificações
   */
  private showNotificationSafe(
    type: 'success' | 'warning' | 'error' | 'info',
    message: string,
    title?: string
  ): void {
    const now = Date.now();
    const isSameMessage = this.lastNotificationMessage === message;
    const isWithinDebounceTime = (now - this.lastNotificationTime) < this.NOTIFICATION_DEBOUNCE_TIME;

    // Se é a mesma mensagem e ainda está dentro do tempo de debounce, não mostra
    if (isSameMessage && isWithinDebounceTime) {
      return;
    }

    // Atualiza o controle
    this.lastNotificationMessage = message;
    this.lastNotificationTime = now;

    // Mostra a notificação
    switch (type) {
      case 'success':
        this.notificationService.success(message, title);
        break;
      case 'warning':
        this.notificationService.warning(message, title);
        break;
      case 'error':
        this.notificationService.error(message, title);
        break;
      case 'info':
        this.notificationService.info(message, title);
        break;
    }
  }

  onModalYearChanged(year: number): void {
    // 🔥 CORREÇÃO COMPLETA: Múltiplas verificações para evitar spam de notificações
    
    // 1. Se está editando, não valida
    if (this.editingEnergia || this.editModes.energia) {
      return;
    }

    // 2. Se o ano não é válido (menor que 1900 ou maior que 2100), não valida
    if (!year || year < 1900 || year > 2100) {
      return;
    }

    // 3. Se o ano não mudou desde a última validação, não valida novamente
    if (this.lastValidatedYear === year) {
      return;
    }

    const user = this.authService.getCurrentUser();
    const usuarioId = user?.id ? parseInt(user.id, 10) : NaN;
    if (!Number.isFinite(usuarioId)) return;

    // 4. Armazena o ano que está sendo validado para evitar validações duplicadas
    this.lastValidatedYear = year;

    this.energiaDadosService.listarPorUsuarioEAno(usuarioId, year)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp) => {
          const duplicado = Array.isArray(resp) && resp.some(r => r.anoReferencia === year);
          this.modalServerDuplicate = duplicado;
          if (duplicado) {
            this.showNotificationSafe('warning', 
              `⚠️ Já existem dados cadastrados para o ano ${year}. Você pode editar os dados existentes ou escolher outro ano.`, 
              'Ano já cadastrado'
            );
          } else {
            this.showNotificationSafe('success', 
              `✅ Ano ${year} disponível para cadastro!`, 
              'Ano disponível'
            );
          }
        },
        error: (err) => {
          const e = extractAppError(err);
          this.modalServerDuplicate = false;
          this.showNotificationSafe('warning', e.message, 'Aviso de verificação');
        }
      });
  }

  onDataRegistrationConfirm(data: DataRegistrationForm): void {
    // Guard clause: impede confirmação se há duplicação detectada
    if (this.modalServerDuplicate) {
      this.showNotificationSafe('warning',
        `⚠️ Não é possível confirmar: o ano ${data.anoReferencia} já está cadastrado para este tipo de dado. ` +
        'Altere o ano ou edite o registro existente.',
        'Ano já cadastrado'
      );
      return; // 👈 trava o envio
    }

    const user = this.authService.getCurrentUser();
    if (!user?.id) { 
      this.showNotificationSafe('error', 'Usuário não autenticado'); 
      return; 
    }

    const usuarioId = parseInt(user.id, 10);
    if (isNaN(usuarioId)) { 
      this.showNotificationSafe('error', 'ID do usuário inválido'); 
      return; 
    }

    if (this.editingEnergia) this.processarEdicao(data, usuarioId);
    else this.verificarDuplicacaoECriar(data, usuarioId);

    this.dataRegistrationModal?.resetForm();
  }

  private verificarDuplicacaoECriar(data: DataRegistrationForm, usuarioId: number): void {
    // validações leves previamente
    if (!isAnoValido(data.anoReferencia)) {
      this.showNotificationSafe('error', 'Ano inválido. Informe um ano entre 1900 e 2100.');
      return;
    }
    if (data.dataType === 'consolidated' && !isAteSeisCasas(data.valor)) {
      this.showNotificationSafe('error', 'O fator médio anual deve ser > 0 e ter no máximo 6 casas decimais.');
      return;
    }

    this.energiaDadosService.listarPorUsuarioEAno(usuarioId, data.anoReferencia)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (existingData) => {
          const tipoSolicitado = data.dataType === 'monthly' ? TipoDado.MENSAL : TipoDado.CONSOLIDADO_ANUAL;

          if (Array.isArray(existingData) && existingData.length > 0) {
            const mesmoTipo = existingData.filter(e => e.tipoDado === tipoSolicitado);
            const outroTipo = existingData.filter(e => e.tipoDado !== tipoSolicitado);

            if (mesmoTipo.length > 0) {
              const ultimaVersao = Math.max(...mesmoTipo.map(e => e.versao ?? 1));
              const novaVersao = ultimaVersao + 1;
              this.processarCadastro({ ...data, versao: novaVersao }, usuarioId);
            } else if (outroTipo.length > 0) {
              this.processarCadastro({ ...data, versao: (outroTipo[0].versao ?? 1) + 1 }, usuarioId);
            }
          } else {
            this.processarCadastro({ ...data, versao: 1 }, usuarioId);
          }
        },
        error: (err) => {
          const e = extractAppError(err);
          this.showNotificationSafe('warning', `${e.message} Prosseguindo com o cadastro.`, 'Aviso de verificação');
          this.processarCadastro({ ...data, versao: 1 }, usuarioId);
        }
      });
  }

  // ======================================================
  // CREATE
  // ======================================================
  private processarCadastro(data: DataRegistrationForm, usuarioId: number): void {
    if (this.submitting) return;

    // validações leves (cliente)
    if (!isAnoValido(data.anoReferencia)) {
      this.showNotificationSafe('error', 'Ano inválido. Informe um ano entre 1900 e 2100.');
      return;
    }
    if (data.dataType === 'consolidated' && !isAteSeisCasas(data.valor)) {
      this.showNotificationSafe('error', 'O fator médio anual deve ser > 0 e ter no máximo 6 casas decimais.');
      return;
    }
    if (data.dataType === 'monthly') {
      const normalizados = this.normalizeMonthly(data.dadosMensais);
      const preenchidos = normalizados.filter(m => m.valor > 0);
      if (preenchidos.length === 0) {
        this.showNotificationSafe('error', 'Informe ao menos um mês com valor > 0.');
        return;
      }
      if (preenchidos.length < 12) {
        this.showNotificationSafe('info', 'A média anual (tCO₂/MWh) só será calculada após preencher os 12 meses.');
      }
    }

    this.submitting = true;

    if (data.dataType === 'consolidated') {
      const valor = Number(data.valor);
      const request: EnergiaDadosRequest = {
        usuarioId,
        tipoEnergia: 'ELETRICA',
        fonteEnergia: 'REDE_ELETRICA',
        consumoAnual: 0,
        unidade: 'MWh',
        fatorEmissao: this.to6(valor),
        fatorMedioAnual: this.to6(valor),
        escopo: 'ESCOPO2',
        anoReferencia: data.anoReferencia,
        tipoDado: TipoDado.CONSOLIDADO_ANUAL,
        versao: data.versao || 1,
        observacoesAuditoria: 'Valor médio anual (fator) - versionado'
      };

      this.energiaDadosService.criar(request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (resp) => {
            this.upsertLocalEnergia(request, (resp as any)?.id);
            this.showNotificationSafe('success', 'Dados consolidados salvos com sucesso!');
            this.closeDataRegistrationModal();
            this.submitting = false;
          },
          error: (err) => {
            const e = extractAppError(err);
            this.showNotificationSafe('error', e.message);
            this.submitting = false;
          }
        });

    } else if (data.dataType === 'monthly') {
      const normalizados = this.normalizeMonthly(data.dadosMensais);
      const preenchidos = normalizados.filter(m => m.valor > 0);
      const totalAnual = this.to6(normalizados.reduce((sum, m) => sum + (m.valor || 0), 0));
      const mediaAnual = preenchidos.length > 0 ? this.to6(totalAnual / 12) : 0;

      const request: EnergiaDadosRequest = {
        usuarioId,
        tipoEnergia: 'ELETRICA',
        fonteEnergia: 'REDE_ELETRICA',
        consumoAnual: totalAnual,
        unidade: 'MWh',
        fatorEmissao: mediaAnual,
        fatorMedioAnual: mediaAnual,
        escopo: 'ESCOPO2',
        anoReferencia: data.anoReferencia,
        tipoDado: TipoDado.MENSAL,
        dadosMensais: normalizados,
        versao: data.versao || 1,
        observacoesAuditoria: 'Cadastro mensal - versionado'
      };

      this.energiaDadosService.criar(request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (resp) => {
            this.upsertLocalEnergia(request, (resp as any)?.id);
            const msg = mediaAnual > 0
              ? `Dados mensais salvos! Média: ${mediaAnual.toFixed(6)} tCO₂/MWh`
              : 'Dados mensais salvos! A média anual será calculada após 12 meses.';
            this.showNotificationSafe('success', msg);
            this.closeDataRegistrationModal();
            this.submitting = false;
          },
          error: (err) => {
            const e = extractAppError(err);
            this.showNotificationSafe('error', e.message);
            this.submitting = false;
          }
        });
    }
  }

  // ======================================================
  // UPDATE
  // ======================================================
  private processarEdicao(data: DataRegistrationForm, usuarioId: number): void {
    if (!this.editingEnergia || this.submitting) return;

    // 🔒 Travar ano na edição
    const anoOriginal = Number(this.editingEnergia.ano);
    if (Number(data.anoReferencia) !== anoOriginal) {
      this.showNotificationSafe('error', 'O ano não pode ser alterado durante a edição.');
      return;
    }

    // validações leves
    if (data.dataType === 'consolidated' && !isAteSeisCasas(data.valor)) {
      this.showNotificationSafe('error', 'O fator médio anual deve ser > 0 e ter no máximo 6 casas decimais.');
      return;
    }

    this.submitting = true;

    let consumoAnual = 0;
    let fator = 0;
    let dadosMensaisReq: { mes: number; valor: number }[] | undefined;

    if (data.dataType === 'monthly') {
      const normalizados = this.normalizeMonthly(data.dadosMensais);
      const preenchidos = normalizados.filter(m => m.valor > 0);
      consumoAnual = this.to6(normalizados.reduce((sum, m) => sum + (m.valor || 0), 0));
      fator = preenchidos.length > 0 ? this.to6(consumoAnual / 12) : 0;
      dadosMensaisReq = normalizados;
      this.editingEnergia.dadosMensais = normalizados;
    } else {
      const v = Number(data.valor);
      consumoAnual = 0;
      fator = this.to6(v);
    }

    const energiaRequest: EnergiaDadosRequest = {
      usuarioId,
      tipoEnergia: 'ELETRICA',
      fonteEnergia: 'REDE_ELETRICA',
      consumoAnual,
      unidade: 'MWh',
      fatorEmissao: fator,
      fatorMedioAnual: fator,
      escopo: 'ESCOPO2',
      anoReferencia: data.anoReferencia,
      tipoDado: data.dataType === 'monthly' ? TipoDado.MENSAL : TipoDado.CONSOLIDADO_ANUAL,
      dadosMensais: dadosMensaisReq,
      versao: data.versao || (this.editingEnergia as any).versao || 1,
      observacoesAuditoria:
        data.dataType === 'monthly'
          ? 'Edição de dados mensais - versionado'
          : 'Edição de dados consolidados - versionado'
    };

    // ADICIONAR LOGS DE DEBUG
    console.log('🔄 Iniciando atualização:', {
      id: this.editingEnergia.id,
      anoReferencia: data.anoReferencia,
      valorOriginal: this.editingEnergia.fatorMedioAnual,
      novoValor: fator,
      request: energiaRequest
    });

    this.setLoading('main', true, 'Atualizando dados...');

    this.energiaDadosService.atualizar(this.editingEnergia.id, energiaRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('✅ API Response:', response);

          // Verificar se a resposta contém os dados atualizados
          if (response && (response as any).fatorMedioAnual !== undefined) {
            console.log('📊 Valor retornado pela API:', (response as any).fatorMedioAnual);
          }

          this.upsertLocalEnergia(energiaRequest, this.editingEnergia!.id);

          // Verificar se os dados locais foram atualizados
          const updatedItem = this.energiasData.find(e => e.id === this.editingEnergia!.id);
          console.log('🔍 Dados locais após update:', updatedItem);

          // Forçar recarregamento dos dados do servidor para garantir sincronização
          this.recarregarDadosDoServidor(usuarioId);

          this.showNotificationSafe('success', 'Dados atualizados com sucesso!');
          this.closeDataRegistrationModal(true);
          this.setLoading('main', false);
          this.submitting = false;
        },
        error: (err) => {
          console.error('❌ Erro na API:', err);
          console.error('📋 Detalhes do erro:', {
            status: err?.status,
            message: err?.message,
            body: err?.error
          });

          const e = extractAppError(err);
          this.showNotificationSafe('error', `Erro ao atualizar: ${e.message}`);
          this.setLoading('main', false);
          this.submitting = false;
        }
      });
  }

  /** Atualiza/inclui localmente a linha do ano para refletir imediatamente o “Fator médio anual”. */
  private upsertLocalEnergia(req: EnergiaDadosRequest, idFromServer?: number): void {
    console.log('🔄 Atualizando dados locais:', { req, idFromServer });
    
    const item: EnergiaData = {
      id: idFromServer ?? this.findIdByAno(req.anoReferencia) ?? Date.now(),
      tipoEmissao: req.tipoEnergia,
      fonteEmissao: req.fonteEnergia,
      ano: req.anoReferencia,
      fatorMedioAnual: this.to6(req.fatorMedioAnual ?? req.fatorEmissao ?? 0),
      dadosMensais: req.dadosMensais,
      versao: req.versao,
      observacoesAuditoria: req.observacoesAuditoria
    };

    console.log('📊 Item a ser inserido/atualizado:', item);

    const idx = this.energiasData.findIndex(e => e.ano === item.ano);
    console.log('🔍 Índice encontrado:', idx);
    
    if (idx > -1) {
      console.log('📝 Atualizando item existente no índice:', idx);
      console.log('📊 Valor anterior:', this.energiasData[idx].fatorMedioAnual);
      this.energiasData[idx] = item;
      console.log('📊 Valor atualizado:', this.energiasData[idx].fatorMedioAnual);
    } else {
      console.log('➕ Adicionando novo item');
      this.energiasData.push(item);
    }

    this.filteredEnergiasData = this.deduplicateByYear([...this.energiasData]);
    this.updateExistingYears();
    this.updatePagination('energias');
    
    console.log('✅ Dados locais atualizados. Total de itens:', this.energiasData.length);
  }

  private findIdByAno(ano: number): number | undefined {
    const found = this.energiasData.find(e => e.ano === ano);
    return found?.id;
  }

  // ======================================================
  // Utilidades
  // ======================================================
  /** Normaliza dados mensais (mes 1-12 como number e valor number >= 0) */
  private normalizeMonthly(dados: Array<{ mes: any; valor: any }> | undefined): { mes: number; valor: number }[] {
    if (!Array.isArray(dados)) return [];
    return dados
      .map((d) => {
        const mesRaw = typeof d.mes === 'string' ? d.mes.trim() : d.mes;
        const mes =
          typeof mesRaw === 'string'
            ? Math.max(1, Math.min(12, parseInt(mesRaw, 10) || 0))
            : Math.max(1, Math.min(12, Number(mesRaw) || 0));

        const valor = Math.max(0, Number(d.valor) || 0);
        return { mes, valor };
      })
      .filter((d) => d.mes >= 1 && d.mes <= 12);
  }

  private updateExistingYears(): void {
    this.existingYears = Array.isArray(this.energiasData) ? this.energiasData.map(d => d.ano) : [];
    this.existingYearsDetailed = Array.isArray(this.energiasData)
      ? this.energiasData.map(d => ({
        anoReferencia: d.ano,
        tipoDado: (Array.isArray(d.dadosMensais) && d.dadosMensais.length > 0) ? 'MENSAL' : 'CONSOLIDADO_ANUAL'
      }))
      : [];
  }

  // --- Modal de "empresa" (criar/editar) -----------------------------

  /** Salva empresa: decide entre criar/atualizar */
  saveEnergia(): void {
    // Validar nome antes de salvar
    if (this.duplicateNameFound) {
      this.showNotificationSafe('error', 'Não é possível salvar: já existe uma energia com este nome.');
      return;
    }

    if (!this.energiaForm.nome.trim()) {
      this.showNotificationSafe('error', 'O nome da energia é obrigatório.');
      return;
    }

    if (this.energiaForm.nome.trim().length < 3) {
      this.showNotificationSafe('error', 'O nome deve ter pelo menos 3 caracteres.');
      return;
    }

    if (this.editModes.energia && this.selectedEnergia) {
      this.updateEnergia();
    } else {
      this.createEnergia();
    }
  }

  /** Criação de empresa (campos simples) */
  private createEnergia(): void {
    this.setLoading('main', true, 'Criando empresa...');

    this.energiaECombustivelService.criar(this.energiaForm as any)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const novo = this.mapResponseToEnergia(response as EmpresaEnergiaResponseMin);
          this.energiasECombustiveis.push(novo);
          this.filteredEnergiasECombustiveis = [...this.energiasECombustiveis];
          this.updatePagination('empresas');
          this.showNotificationSafe('success', 'Empresa criada com sucesso!');
          this.closeModal('createEnergia');
          this.setLoading('main', false);
        },
        error: (err) => {
          const e = extractAppError(err);
          this.showNotificationSafe('error', e.message);
          this.setLoading('main', false);
        }
      });
  }

  /** Atualização de empresa */
  private updateEnergia(): void {
    if (!this.selectedEnergia) return;

    this.setLoading('main', true, 'Atualizando empresa...');
    this.energiaECombustivelService.atualizar(this.selectedEnergia.id, this.energiaForm as any)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const idx = this.energiasECombustiveis.findIndex(e => e.id === this.selectedEnergia!.id);
          if (idx > -1) {
            this.energiasECombustiveis[idx] = this.mapResponseToEnergia(response as EmpresaEnergiaResponseMin);
            this.filteredEnergiasECombustiveis = [...this.energiasECombustiveis];
          }
          this.updatePagination('empresas');
          this.showNotificationSafe('success', 'Empresa atualizada com sucesso!');
          this.closeModal('editEnergia');
          this.setLoading('main', false);
        },
        error: (err) => {
          const e = extractAppError(err);
          this.showNotificationSafe('error', e.message);
          this.setLoading('main', false);
        }
      });
  }

  private setLoading(type: 'main' | 'energias' | 'combustiveis', loading: boolean, message: string = ''): void {
    this.loadingStates[type] = { isLoading: loading, message };
  }

  private recarregarDadosDoServidor(usuarioId: number): void {
    console.log('🔄 Recarregando dados do servidor...');

    this.energiaDadosService.listarPorUsuarioComFatores(usuarioId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (dados) => {
          console.log('📥 Dados recarregados do servidor:', dados);

          this.energiasData = dados.map(this.mapResponseToEnergiaData);
          this.filteredEnergiasData = this.deduplicateByYear([...this.energiasData]);
          this.updateExistingYears();
          this.updatePagination('energias');

          console.log('✅ Dados locais sincronizados com servidor');
        },
        error: (err) => {
          console.error('❌ Erro ao recarregar dados:', err);
        }
      });
  }

  private initializeYears(): void {
    const currentYear = new Date().getFullYear();
    this.anos = Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());
  }

  private initializeDatepickers(): void { }

  // Métodos de confirmação de cancelamento
  confirmClose(): void {
    if (this.hasUnsavedChanges()) {
      this.showCancelConfirmModal = true;
    } else {
      this.closeCreateModal();
    }
  }

  closeCancelConfirmModal(): void {
    this.showCancelConfirmModal = false;
  }

  confirmCancel(): void {
    this.showCancelConfirmModal = false;
    this.closeCreateModal();
    this.resetForms();
  }

  /**
   * Verifica se há alterações não salvas
   */
  private hasUnsavedChanges(): boolean {
    const form = this.energiaForm;
    
    // Se está editando, compara com os valores originais
    if (this.editModes.energia && this.selectedEnergia) {
      return (
        form.nome !== (this.selectedEnergia.nome || '') ||
        form.cnpj !== (this.selectedEnergia.cnpj || '') ||
        form.estado !== (this.selectedEnergia.estado || '') ||
        form.tipoEnergia !== this.selectedEnergia.tipoEnergia ||
        form.ativo !== this.selectedEnergia.ativo
        // 🔥 REMOVIDO: form.ano e form.fator pois não existem em EnergiaECombustivel
        // A interface EnergiaECombustivel representa empresas, não dados de energia
      );
    }
    
    // Se está criando, verifica se algum campo foi preenchido
    return !!(
      form.nome.trim() ||
      form.cnpj.trim() ||
      form.estado ||
      form.fator > 0
    );
  }

  // Validação de nome duplicado
  validateName(nome: string): void {
    if (!nome || nome.trim().length < 3) {
      this.nameValidationError = '';
      this.duplicateNameFound = false;
      return;
    }

    const normalizedName = nome.trim().toLowerCase();
    
    const localDuplicate = this.energiasECombustiveis.some(energia => 
      energia.nome.toLowerCase() === normalizedName && 
      (!this.selectedEnergia || energia.id !== this.selectedEnergia.id)
    );

    if (localDuplicate) {
      this.duplicateNameFound = true;
      this.nameValidationError = 'Já existe uma energia com este nome.';
      return;
    }

    this.isValidatingName = true;
    this.nameValidationError = '';
    this.duplicateNameFound = false;

    setTimeout(() => {
      this.isValidatingName = false;
    }, 500);
  }

  onNameChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const nome = target.value;
    this.energiaForm.nome = nome;
    
    clearTimeout(this.nameValidationTimeout);
    this.nameValidationTimeout = setTimeout(() => {
      this.validateName(nome);
    }, 300);
  }

  private clearValidationState(): void {
    this.isValidatingName = false;
    this.nameValidationError = '';
    this.duplicateNameFound = false;
    if (this.nameValidationTimeout) {
      clearTimeout(this.nameValidationTimeout);
    }
  }
  private destroyDatepickers(): void {
    this.datepickerInstances.forEach(instance => { if (instance && typeof instance.destroy === 'function') instance.destroy(); });
    this.datepickerInstances = [];
  }

  // --- GETTERS usados no template ---
  get isLoadingEnergias(): boolean { return this.loadingStates.energias.isLoading; }
  get loadingMessageEnergias(): string { return this.loadingStates.energias.message; }
  get paginatedEnergias(): EnergiaData[] { return this.getPaginatedData('energias'); }
  get currentPageEnergias(): number { return this.pagination.energias.currentPage; }
  set currentPageEnergias(page: number) { this.changePage('energias', page); }
  get itemsPerPageEnergias(): number { return this.pagination.energias.itemsPerPage; }
  set itemsPerPageEnergias(items: number) { this.changeItemsPerPage('energias', items); }
  get totalItemsEnergias(): number { return this.getTotalItems('energias'); }
  get totalPagesEnergias(): number { return this.pagination.energias.totalPages; }
  get showCreateModal(): boolean { return this.modalStates.createEnergia || this.modalStates.editEnergia; }
  get showDataRegistrationModal(): boolean { return this.modalStates.dataRegistration; }
  get isEditMode(): boolean { return this.editModes.energia; }

  get currentEnergia(): any {
    return this.energiaForm;
  }

  get hasInventories(): boolean {
    return Array.isArray(this.energiasECombustiveis) &&
      this.energiasECombustiveis.some(e => (e.quantidadeInventarios ?? 0) > 0);
  }
}
