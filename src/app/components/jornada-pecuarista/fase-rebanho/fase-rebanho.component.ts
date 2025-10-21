import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { LoteRebanhoService, LoteRebanhoResponse } from '../../../core/services/lote-rebanho.service';
import { CategoriaLoteService, CategoriaLoteRequest, CategoriaLoteResponse } from '../../../services/categoria-lote.service';
import { NutricaoAnimalLoteService, NutricaoAnimalLoteRequest, NutricaoAnimalLoteResponse, IngredienteDietaLoteItem, ConcentradoDietaLoteItem, AditivoDietaLoteItem } from '../../../services/nutricao-animal-lote.service';
import { ManejoDejetosLoteService, ManejoDejetosLoteRequest, ManejoDejetosLoteResponse } from '../../../services/manejo-dejetos-lote.service';
import { CategoriaCorteService, CategoriaCorte } from '../../../services/categorias-corte.service';
import { BancoIngredientesService, IngredienteResponse } from '../../../core/services/banco-ingredientes.service';

export interface LoteRebanho {
  id?: number;
  inventarioId: number;
  nome: string;
  ordem: number;
  observacoes?: string;
  dataCriacao?: Date | string;
  dataAtualizacao?: Date | string;
}

export interface CategoriaLote {
  id?: number;
  loteId: number;
  categoriaCorteId?: number;
  categoriaLeiteId?: number;
  quantidadeAnimais: number;
  pesoMedio: number;
  observacoes?: string;
  femeasPrenhasPercentual?: number;
  producaoLeiteAno?: number;
  teorGorduraLeite?: number;
  teorProteinaLeite?: number;
  dataCriacao?: Date | string;
  dataAtualizacao?: Date | string;
}

export interface NutricaoAnimalLote {
  id?: number;
  loteId: number;
  inserirDadosDieta: boolean;
  sistemaProducao?: 'PASTO' | 'SEMI_CONFINADO' | 'CONFINADO';
  tempoPastoHorasDia?: number;
  tempoPastoDiasAno?: number;
  observacoes?: string;
  dataCriacao?: Date | string;
  dataAtualizacao?: Date | string;
  ingredientes?: IngredienteDietaLoteItem[];
  concentrados?: ConcentradoDietaLoteItem[];
  aditivos?: AditivoDietaLoteItem[];
}

export interface ManejoDejetosLote {
  id?: number;
  loteId: number;
  categoriaAnimal: string;
  tipoManejo: string;
  percentualRebanho: number;
  dataCriacao?: Date | string;
  dataAtualizacao?: Date | string;
}

@Component({
  selector: 'app-fase-rebanho',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './fase-rebanho.component.html',
  styleUrls: ['./fase-rebanho.component.scss']
})
export class FaseRebanhoComponent implements OnInit, OnDestroy, OnChanges {
  @Input() inventarioId: number = 0;
  @Input() readonly: boolean = false;
  // Evitar default para LEITE: em edição, o inventário pode chegar assíncrono
  @Input() tipoRebanho: 'LEITE' | 'CORTE' | string = '';
  @Output() faseConcluida = new EventEmitter<void>();

  private readonly destroy$ = new Subject<void>();
  private readonly autoSave$ = new Subject<void>();

  // Controle de abas
  abaAtiva: 'informacoes' | 'nutricao' | 'manejo' = 'informacoes';

  // Nutrição Animal - campos iniciais
  inserirDadosDieta: 'Sim' | 'Não' | undefined = undefined;
  sistemaProducao: 'PASTO' | 'SEMI_CONFINADO' | 'CONFINADO' | undefined = undefined;

  // Loading
  isLoading = false;
  isSaving = false;
  // Acessibilidade/Header
  isHighContrast = false;
  isVLibrasActive = false;

  // Dados
  lotes: LoteRebanho[] = [];
  loteAtivo: LoteRebanho | null = null;
  categorias: CategoriaLoteResponse[] = [];
  nutricao: NutricaoAnimalLote[] = [];
  manejo: ManejoDejetosLote[] = [];

  // Ingredientes do banco de fatores
  ingredientesDisponiveis: string[] = [];
  ingredientesFiltrados: string[] = [];
  tiposIngredientes: string[] = [];
  isLoadingIngredientes = false;

  // Nutrição Animal - novo layout
  categoriasPorLoteId: Record<number, CategoriaLoteResponse[]> = {};
  // Versão deduplicada por categoria (evita repetição visual no Manejo)
  categoriasPorLoteIdUnicas: Record<number, CategoriaLoteResponse[]> = {};
  expandedNutriLotes: Record<number, boolean> = {};
  sectionsExpandedByLoteId: Record<number, { pastejo: boolean; ingredientes: boolean; concentrado: boolean; aditivo: boolean }> = {};
  pastejoByLoteId: Record<number, Array<{ horasPorDia?: number; diasPorAno?: number }>> = {};
  ingredientesByLoteId: Record<number, Array<{ ingrediente?: string; quantidadeKgCabDia?: number; ofertaDiasAno?: number; producao?: 'INTERNA' | 'EXTERNA' }>> = {};
  concentradoByLoteId: Record<number, Array<{ proteinaBrutaPercentual?: number; ureia?: string; subproduto?: string; quantidade?: number; oferta?: number }>> = {};
  aditivoByLoteId: Record<number, Array<{ tipo?: string; dose?: number; oferta?: number; percentualAdicional?: number }>> = {};

  // Formulários
  novoLote: Partial<LoteRebanho> = {};
  novaCategoria: Partial<CategoriaLote> = {};
  novaNutricao: Partial<NutricaoAnimalLote> = {};
  novoManejo: Partial<ManejoDejetosLote> = {};

  // Modais
  showLoteModal = false;
  showCategoriaModal = false;
  showNutricaoModal = false;
  showManejoModal = false;
  showDeleteConfirmModal = false;
  showClearAllConfirmModal = false;
  showVoltarInformacoesConfirmModal = false;
  showRemocaoCategoriaModal = false;
  // Modal de inconsistência de quantidades (animais na fazenda vs comprados + vendidos)
  showQuantidadeMismatchModal = false;
  quantidadeMismatchErros: Array<{ loteNome: string; categoriaLabel: string; mensagem: string }> = [];

  // Painel de novo lote (expansível)
  showNovoLotePanel = false;
  // Painéis de novo lote (múltiplos, inline)
  novoLotesPanels: Array<{
    novoLote: Partial<LoteRebanho>;
    expanded: boolean;
    categoriasRows: Array<{
      categoriaCorteId?: number;
      animaisFazenda?: number;
      pesoMedioVivo?: number;
      animaisComprados?: number;
      pesoMedioComprados?: number;
      animaisVendidos?: number;
      pesoMedioVendidos?: number;
      permanenciaMeses?: number;
      idadeDesmame?: number;
      femasPrenhasPercent?: number;
      producaoLeite?: number;
      teorGorduraLeite?: number;
      teorProteinaLeite?: number;
      observacoes?: string;
    }>;
  }> = [];
  // Estado de expansão por lote e linhas de formulário por lote (para tabela tabular)
  expandedLotes: Record<number, boolean> = {};
  loteFormRowsById: Record<number, Array<{
    categoriaCorteId?: number;
    animaisFazenda?: number;
    pesoMedioVivo?: number;
    animaisComprados?: number;
    pesoMedioComprados?: number;
    animaisVendidos?: number;
    pesoMedioVendidos?: number;
    permanenciaMeses?: number;
    idadeDesmame?: number;
    femasPrenhasPercent?: number;
    producaoLeite?: number;
    teorGorduraLeite?: number;
    teorProteinaLeite?: number;
    observacoes?: string;
  }>> = {};
  // Estado de expansão/recolhimento do conteúdo do lote ativo
  loteCollapsed = false;
  categoriasCorte: CategoriaCorte[] = [];
  categoriasCorteFiltradas: CategoriaCorte[] = [];
  categoriasFormRows: Array<{
    categoriaCorteId?: number;
    animaisFazenda?: number;
    pesoMedioVivo?: number;
    animaisComprados?: number;
    pesoMedioComprados?: number;
    animaisVendidos?: number;
    pesoMedioVendidos?: number;
    permanenciaMeses?: number;
    idadeDesmame?: number;
    femasPrenhasPercent?: number;
    producaoLeite?: number;
    teorGorduraLeite?: number;
    teorProteinaLeite?: number;
    observacoes?: string;
  }> = [];

  // Controle de edição
  editingLoteId: number | null = null;
  editingCategoriaId: number | null = null;
  editingNutricaoId: number | null = null;
  editingManejoId: number | null = null;
  itemToDelete: any = null;
  deleteType: 'lote' | 'categoria' | 'nutricao' | 'manejo' | null = null;

  // Contexto para remoção de categoria individual
  remocaoCategoriaContext: { loteId?: number; rowIndex: number; panelIndex?: number; isNovoLote?: boolean } | null = null;

  // Opções para selects
  readonly tiposAlimento = [
    { value: 'CONCENTRADO', label: 'Concentrado' },
    { value: 'VOLUMOSO', label: 'Volumoso' },
    { value: 'ADITIVO', label: 'Aditivo' }
  ];

  readonly unidadesConsumo = [
    { value: 'KG', label: 'Quilograma (kg)' },
    { value: 'G', label: 'Grama (g)' },
    { value: 'T', label: 'Tonelada (t)' }
  ];

  readonly categoriasAnimais = [
    { value: 'BEZERRO', label: 'Bezerro' },
    { value: 'NOVILHO', label: 'Novilho' },
    { value: 'BOI', label: 'Boi' },
    { value: 'VACA', label: 'Vaca' },
    { value: 'TOURO', label: 'Touro' }
  ];
  categoriasAnimaisOpcoes: { value: string; label: string }[] = [];
  private readonly categoriasAnimaisLeite: { value: string; label: string }[] = [
    { value: 'BEZERRO', label: 'Bezerro' },
    { value: 'NOVILHA', label: 'Novilha' },
    { value: 'VACA_LEITEIRA', label: 'Vaca leiteira' },
    { value: 'VACA_SECA', label: 'Vaca seca' },
    { value: 'TOURO', label: 'Touro' }
  ];
  private readonly categoriasAnimaisCorte: { value: string; label: string }[] = [
    { value: 'BEZERRO', label: 'Bezerro' },
    { value: 'NOVILHO', label: 'Novilho' },
    { value: 'NOVILHA', label: 'Novilha' },
    { value: 'BOI', label: 'Boi' },
    { value: 'VACA', label: 'Vaca' },
    { value: 'BOI_CONFINADO', label: 'Boi confinado' },
    { value: 'VACA_CONFINADA', label: 'Vaca confinada' },
    { value: 'TOURO', label: 'Touro' }
  ];

  readonly tiposManejo = [
    { value: 'PASTO', label: 'Pasto' },
    { value: 'CONFINAMENTO', label: 'Confinamento' },
    { value: 'SEMICONFINAMENTO', label: 'Semiconfinamento' },
    { value: 'COMPOSTAGEM', label: 'Compostagem' },
    { value: 'BIODIGESTOR', label: 'Biodigestor' }
  ];
  tiposManejoOpcoes: { value: string; label: string }[] = [];

  // Novo estado para renderização do layout de Manejo conforme Figma
  manejosPorLoteCategoria: Record<number, Record<string, ManejoDejetosLote[]>> = {};
  totalPercentualGeral = 0;
  // Alerta de remoção para único manejo
  showManejoSingleRemovalAlert = false;

  constructor(
    private notificationService: NotificationService,
    private loteRebanhoService: LoteRebanhoService,
    private categoriaLoteService: CategoriaLoteService,
    private nutricaoAnimalLoteService: NutricaoAnimalLoteService,
    private manejoDejetosLoteService: ManejoDejetosLoteService,
    private categoriaCorteService: CategoriaCorteService,
    private bancoIngredientesService: BancoIngredientesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.carregarDados();
    this.configurarAutoSave();
    this.carregarCategoriasCorte();
    this.carregarTiposManejo();
    this.carregarIngredientes();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tipoRebanho']) {
      console.log('DEBUG - ngOnChanges tipoRebanho:', {
        previousValue: changes['tipoRebanho'].previousValue,
        currentValue: changes['tipoRebanho'].currentValue,
        firstChange: changes['tipoRebanho'].firstChange
      });
      this.atualizarOpcoesPorTipo();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Adicionar novo painel de lote (mantém anteriores)
  toggleNovoLotePanel(): void {
    const ordem = this.lotes.length + this.novoLotesPanels.length + 1;
    this.novoLotesPanels.push({
      novoLote: { inventarioId: this.inventarioId, nome: '', ordem },
      expanded: true,
      categoriasRows: [{}]
    });
  }

  // Expandir/Recolher conteúdo do lote ativo
  toggleLoteCollapse(): void {
    this.loteCollapsed = !this.loteCollapsed;
  }

  // Expandir/Recolher painel inline de novo lote
  toggleNovoLoteEditor(index: number): void {
    const panel = this.novoLotesPanels[index];
    if (!panel) return;
    panel.expanded = !panel.expanded;
  }

  private async carregarCategoriasCorte(): Promise<void> {
    try {
      const categorias = await firstValueFrom(this.categoriaCorteService.listar());
      this.categoriasCorte = categorias || [];
      this.atualizarOpcoesPorTipo();
    } catch (error) {
      console.warn('Falha ao carregar categorias de corte:', error);
      this.categoriasCorte = [];
    }
  }

  adicionarCategoriaLinha(panelIndex?: number): void {
    if (panelIndex === undefined) {
      this.categoriasFormRows.push({});
      return;
    }
    const panel = this.novoLotesPanels[panelIndex];
    if (panel) {
      panel.categoriasRows.push({});
    }
  }

  removerCategoriaLinha(index: number): void {
    this.categoriasFormRows.splice(index, 1);
  }

  private getCategoriaCorteLabelById(id?: number): string {
    if (!id) return '';
    const c = this.categoriasCorte.find(x => x.id === id);
    return c ? c.categoria : '';
  }

  categoriaExigeCamposAdicionais(row: { categoriaCorteId?: number }): boolean {
    if (!row.categoriaCorteId) return false;
    
    const label = this.getCategoriaCorteLabelById(row.categoriaCorteId).toLowerCase();
    
    // Verifica se é uma das categorias que exigem campos adicionais
    if (label.includes('novilha') || label.includes('vaca leiteira') || label.includes('vaca seca')) {
      return true;
    }
    
    // Para o tipo LEITE, também verifica se é uma categoria "Vaca" que será mapeada
    if (this.tipoRebanho === 'LEITE' && label.includes('vaca')) {
      return true;
    }
    
    return false;
  }

  shouldShowMilkColumnsForRowGroup(rows: Array<{ categoriaCorteId?: number }> | undefined | null): boolean {
    if (this.tipoRebanho !== 'LEITE') return false;
    if (!rows || rows.length === 0) return false;
    return rows.some(r => this.categoriaExigeCamposAdicionais(r));
  }

  async salvarNovoLoteComCategorias(): Promise<void> {
    if (!this.novoLote.nome || !this.validarNomeLote(this.novoLote.nome)) {
      return;
    }

    try {
      this.isSaving = true;

      const observacoesPayload = {
        categorias: this.categoriasFormRows
      };

      const request = {
        inventarioId: this.inventarioId,
        nome: this.novoLote.nome.trim(),
        ordem: this.lotes.length + 1,
        observacoes: JSON.stringify(observacoesPayload)
      };

      console.debug('[salvarNovoLoteComCategorias] Criando lote:', request);
      const response = await firstValueFrom(this.loteRebanhoService.criar(request));
      
      if (response) {
        console.debug('[salvarNovoLoteComCategorias] Lote criado com ID:', response.id);
        
        const novoLote: LoteRebanho = {
          id: response.id,
          inventarioId: response.inventarioId,
          nome: response.nome,
          ordem: response.ordem,
          observacoes: response.observacoes,
          dataCriacao: response.dataCriacao,
          dataAtualizacao: response.dataAtualizacao
        };
        
        this.lotes.push(novoLote);
        this.selecionarLote(novoLote);
        
        // Transferir dados das categorias para a estrutura correta antes de persistir
        if (this.categoriasFormRows.length > 0 && novoLote.id !== undefined) {
          console.debug('[salvarNovoLoteComCategorias] Transferindo categorias para loteFormRowsById[' + novoLote.id + ']:', this.categoriasFormRows.length, 'categorias');
          this.loteFormRowsById[novoLote.id] = [...this.categoriasFormRows];
          
          // Aguardar um pequeno delay para garantir que o lote foi completamente persistido
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Persistir categorias preenchidas no formulário clássico
          console.debug('[salvarNovoLoteComCategorias] Iniciando persistência das categorias para lote ID:', novoLote.id);
          await this.persistirCategoriasParaLote(novoLote.id!, this.categoriasFormRows || []);
        }
        
        this.notificationService.success('Lote criado com sucesso!');
      } else {
        throw new Error('Resposta inválida do servidor - ID do lote não retornado');
      }

      this.showNovoLotePanel = false;
      this.novoLote = {};
      this.categoriasFormRows = [];
    } catch (error) {
      console.error('Erro ao salvar novo lote com categorias:', error);
      this.notificationService.error('Erro ao salvar novo lote.');
    } finally {
      this.isSaving = false;
    }
  }

  async voltar(): Promise<void> {
    try {
      if (this.abaAtiva === 'informacoes') {
        // Na aba Informações, abrir confirmação antes de sair para Cálculos Registrados
        await this.salvarLotesPendentes(false);
        this.abrirConfirmVoltarInformacoes();
        return;
      }

      if (this.abaAtiva === 'nutricao') {
        // Nutrição: salvar e voltar para Informações
        await this.salvarNutricaoAoAvancar(false);
        await this.selecionarAba('informacoes', { showToast: false });
        return;
      }

      if (this.abaAtiva === 'manejo') {
        // Manejo: salvar rascunho e voltar para Nutrição
        await this.salvarRascunho();
        await this.selecionarAba('nutricao', { showToast: false });
        return;
      }
    } catch (e) {
      console.warn('Erro no fluxo de voltar:', e);
    }
  }

  abrirConfirmVoltarInformacoes(): void {
    this.showVoltarInformacoesConfirmModal = true;
  }

  fecharConfirmVoltarInformacoes(): void {
    this.showVoltarInformacoesConfirmModal = false;
  }

  confirmarVoltarInformacoes(): void {
    this.showVoltarInformacoesConfirmModal = false;
    this.router.navigate(['/calculos-registrados']);
  }

  // Verifica se os três campos necessários estão presentes na linha
  private camposIgualdadePresentes(row: { animaisFazenda?: number; animaisComprados?: number; animaisVendidos?: number }): boolean {
    const temCompraOuVenda = (row.animaisComprados !== undefined && row.animaisComprados !== null && row.animaisComprados !== 0) ||
                             (row.animaisVendidos !== undefined && row.animaisVendidos !== null && row.animaisVendidos !== 0);
    
    if (!temCompraOuVenda) {
      return false;
    }
    
    return (
      row.animaisFazenda !== undefined && row.animaisFazenda !== null &&
      row.animaisComprados !== undefined && row.animaisComprados !== null &&
      row.animaisVendidos !== undefined && row.animaisVendidos !== null
    );
  }

  // Valida a regra: animais na fazenda = animais comprados - animais vendidos
  // Percorre painéis inline (novos lotes) e linhas dos lotes existentes
  private validarIgualdadeAnimaisParaInformacoesGerais(): boolean {
    const erros: Array<{ loteNome: string; categoriaLabel: string; mensagem: string }> = [];

    // Validação para painéis de novo lote (inline)
    (this.novoLotesPanels || []).forEach((panel, idx) => {
      const loteNome = (panel.novoLote?.nome || '').trim() || `Novo lote ${idx + 1}`;
      (panel.categoriasRows || []).forEach((row) => {
        const fazenda = Number(row.animaisFazenda || 0);
        const comprados = Number(row.animaisComprados || 0);
        const vendidos = Number(row.animaisVendidos || 0);
        
        // Nova validação: animais vendidos não pode ser maior que fazenda + comprados
        if (vendidos > fazenda + comprados) {
          const categoriaLabel = this.getCategoriaCorteLabel(row.categoriaCorteId);
          erros.push({
            loteNome,
            categoriaLabel,
            mensagem: `Animais vendidos (${vendidos}) não pode ser maior que a soma de animais da fazenda (${fazenda}) + animais comprados (${comprados}) = ${fazenda + comprados}`
          });
        }
      });
    });

    // Validação para lotes existentes (cards)
    Object.keys(this.loteFormRowsById || {}).forEach((loteIdStr) => {
      const loteId = Number(loteIdStr);
      const loteNome = (this.lotes.find(l => l.id === loteId)?.nome || `Lote ${loteId}`);
      (this.loteFormRowsById[loteId] || []).forEach((row) => {
        const fazenda = Number(row.animaisFazenda || 0);
        const comprados = Number(row.animaisComprados || 0);
        const vendidos = Number(row.animaisVendidos || 0);
        
        // Nova validação: animais vendidos não pode ser maior que fazenda + comprados
        if (vendidos > fazenda + comprados) {
          const categoriaLabel = this.getCategoriaCorteLabel(row.categoriaCorteId);
          erros.push({
            loteNome,
            categoriaLabel,
            mensagem: `Animais vendidos (${vendidos}) não pode ser maior que a soma de animais da fazenda (${fazenda}) + animais comprados (${comprados}) = ${fazenda + comprados}`
          });
        }
      });
    });

    this.quantidadeMismatchErros = erros;
    return erros.length === 0;
  }

  abrirQuantidadeMismatchModal(): void {
    this.showQuantidadeMismatchModal = true;
  }

  fecharQuantidadeMismatchModal(): void {
    this.showQuantidadeMismatchModal = false;
  }

  async continuar(): Promise<void> {
    if (this.abaAtiva === 'informacoes') {
      // Bloquear avanço caso não atenda à regra mínima (nome >= 3 e ao menos uma categoria)
      if (!this.canIrParaNutricao()) {
        this.notificationService.error('Corrija o nome do lote (mín. 3 caracteres) e preencha ao menos uma categoria para avançar.');
        return;
      }
      // Validação adicional: animais na fazenda = animais comprados - animais vendidos
      if (!this.validarIgualdadeAnimaisParaInformacoesGerais()) {
        this.abrirQuantidadeMismatchModal();
        return;
      }
      // Persistir alterações (inclui cards de lotes existentes) e navegar sem revalidar
      // O botão Continuar já é habilitado/desabilitado por canIrParaNutricao() no template
      try {
        console.debug('[Continuar] Aba atual = informacoes. Chamando salvarLotesPendentes...');
        await this.salvarLotesPendentes(true);
        console.debug('[Continuar] salvarLotesPendentes concluído. Navegando para nutricao.');
      } catch (e) {
        console.warn('[Continuar] Erro em salvarLotesPendentes, navegando mesmo assim.', e);
      }
      await this.selecionarAba('nutricao', { showToast: false });
    } else if (this.abaAtiva === 'nutricao') {
      // Bloquear avanço se não houver pelo menos um lote completo na Nutrição
      if (!this.canIrParaManejo()) {
        this.notificationService.error('Preencha ao menos um lote completo na Nutrição Manual para avançar.');
        return;
      }
      // Persistir dados de nutrição antes de avançar para manejo
      try {
        console.debug('[Continuar] Aba atual = nutricao. Chamando salvarNutricaoAoAvancar...');
        await this.salvarNutricaoAoAvancar(true);
        console.debug('[Continuar] salvarNutricaoAoAvancar concluído. Navegando para manejo.');
      } catch (e) {
        console.warn('[Continuar] Erro em salvarNutricaoAoAvancar, navegando mesmo assim.', e);
      }
      await this.selecionarAba('manejo', { showToast: false });
    } else {
      this.concluirFase();
    }
  }

  private configurarAutoSave(): void {
    this.autoSave$
      .pipe(
        debounceTime(2000), // Aguarda 2 segundos após a última alteração
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.salvarRascunho();
      });
  }

  private async carregarDados(): Promise<void> {
    if (!this.inventarioId) return;

    try {
      this.isLoading = true;
      
      // Carregar lotes do inventário
      const lotes = await firstValueFrom(this.loteRebanhoService.listarPorInventario(this.inventarioId));
      if (lotes) {
        this.lotes = lotes.map(lote => ({
          id: lote.id,
          inventarioId: lote.inventarioId,
          nome: lote.nome,
          ordem: lote.ordem,
          observacoes: lote.observacoes,
          dataCriacao: lote.dataCriacao,
          dataAtualizacao: lote.dataAtualizacao
        }));

        // Inicializar estado de Nutrição para todos os lotes
        await this.inicializarNutricaoParaLotes();

        // Carregar e organizar manejos por lote/categoria para o novo layout
        await this.inicializarManejoParaLotes();

        // Selecionar primeiro lote se existir (mantém comportamento atual de outras abas)
        if (this.lotes.length > 0) {
          this.selecionarLote(this.lotes[0]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      this.notificationService.error('Erro ao carregar dados da fase rebanho.');
    } finally {
      this.isLoading = false;
    }
  }

  private async inicializarNutricaoParaLotes(): Promise<void> {
    try {
      const promCategorias = this.lotes.map(l => l.id ? firstValueFrom(this.categoriaLoteService.listarPorLote(l.id)).catch(() => []) : Promise.resolve([]));
      const resultados = await Promise.all(promCategorias);
      this.categoriasPorLoteId = {};
      this.expandedNutriLotes = {};
      this.sectionsExpandedByLoteId = {};
      this.pastejoByLoteId = {};
      this.ingredientesByLoteId = {};
      this.concentradoByLoteId = {};
      this.aditivoByLoteId = {};

      resultados.forEach((cats, idx) => {
        const loteId = this.lotes[idx].id!;
        const categoriasArr = (cats || []) as CategoriaLoteResponse[];
        this.categoriasPorLoteId[loteId] = categoriasArr;
        // Autoexpand por padrão para facilitar visualização imediata dos cards
        this.expandedNutriLotes[loteId] = true;
        this.sectionsExpandedByLoteId[loteId] = { pastejo: false, ingredientes: false, concentrado: false, aditivo: false };
        const defaultProd: 'INTERNA' | 'EXTERNA' = 'INTERNA';
        this.pastejoByLoteId[loteId] = categoriasArr.map(() => ({ horasPorDia: undefined, diasPorAno: undefined }));
        this.ingredientesByLoteId[loteId] = categoriasArr.map(() => ({ ingrediente: '', quantidadeKgCabDia: undefined, ofertaDiasAno: undefined, producao: defaultProd }));
        this.concentradoByLoteId[loteId] = categoriasArr.map(() => ({ proteinaBrutaPercentual: undefined, ureia: '', subproduto: '', quantidade: undefined, oferta: undefined }));
        this.aditivoByLoteId[loteId] = categoriasArr.map(() => ({ tipo: '', dose: undefined, oferta: undefined, percentualAdicional: undefined }));
      });

      // Recarregar dados já persistidos para cada lote
      for (const lote of this.lotes) {
        if (!lote.id) continue;
        try {
          const registros = await firstValueFrom(this.nutricaoAnimalLoteService.listarPorLote(lote.id));
          if (registros && registros.length > 0) {
            const n = registros[0];
            // Aplicar valores globais apenas se já foram salvos anteriormente
            // NÃO inicializar automaticamente para forçar seleção do usuário
            if (this.inserirDadosDieta === undefined && n.inserirDadosDieta !== undefined) {
              // Só aplicar se há dados salvos no backend
              this.inserirDadosDieta = n.inserirDadosDieta ? 'Sim' : 'Não';
            }
            if (this.sistemaProducao === undefined && n.sistemaProducao) {
              this.sistemaProducao = n.sistemaProducao;
            }
            // Aplicar valores de pastejo às linhas do lote
            const linhas = this.pastejoByLoteId[lote.id] || [];
            for (let i = 0; i < linhas.length; i++) {
              linhas[i] = {
                horasPorDia: n.tempoPastoHorasDia,
                diasPorAno: n.tempoPastoDiasAno
              };
            }
            this.pastejoByLoteId[lote.id] = linhas;

            // Mapear Ingredientes, Concentrados e Aditivos para os estados por categoria
            const cats = this.categoriasPorLoteId[lote.id] || [];
            const ing = n.ingredientes || [];
            const conc = n.concentrados || [];
            const adit = n.aditivos || [];
            // Garantir arrays existentes
            this.ingredientesByLoteId[lote.id] = this.ingredientesByLoteId[lote.id] || cats.map(() => ({ ingrediente: '', quantidadeKgCabDia: undefined, ofertaDiasAno: undefined, producao: 'INTERNA' }));
            this.concentradoByLoteId[lote.id] = this.concentradoByLoteId[lote.id] || cats.map(() => ({ proteinaBrutaPercentual: undefined, ureia: '', subproduto: '', quantidade: undefined, oferta: undefined }));
          this.aditivoByLoteId[lote.id] = this.aditivoByLoteId[lote.id] || cats.map(() => ({ tipo: '', dose: undefined, oferta: undefined, percentualAdicional: undefined }));
            for (let i = 0; i < cats.length; i++) {
              const ingItem = ing[i];
              const concItem = conc[i];
              const aditItem = adit[i];
              if (ingItem) {
                this.ingredientesByLoteId[lote.id][i] = {
                  ingrediente: (ingItem as any).nomeIngrediente || '',
                  quantidadeKgCabDia: ingItem.quantidadeKgCabDia,
                  ofertaDiasAno: ingItem.ofertaDiasAno,
                  producao: ingItem.producao as ('INTERNA' | 'EXTERNA')
                };
              }
              if (concItem) {
                this.concentradoByLoteId[lote.id][i] = {
                  proteinaBrutaPercentual: (concItem as any).proteinaBrutaPercentual || 0,
                  ureia: (concItem as any).ureia || '',
                  subproduto: (concItem as any).subproduto || '',
                  quantidade: concItem.quantidade,
                  oferta: concItem.oferta
                };
              }
              if (aditItem) {
                this.aditivoByLoteId[lote.id][i] = {
                  tipo: (aditItem as any).tipo || '',
                  dose: (aditItem as any).dose || undefined,
                  oferta: aditItem.oferta,
                  percentualAdicional: (aditItem as any).percentualAdicional || 0
                };
              }
            }
          }
        } catch (err) {
          // Ignora falhas de carregamento por lote individual
          console.warn('Falha ao carregar nutrição do lote', lote.id, err);
        }
      }
    } catch (error) {
      console.warn('Falha ao inicializar dados de Nutrição para lotes:', error);
    }
  }

  // Persiste os dados da aba Nutrição antes de avançar
  private async salvarNutricaoAoAvancar(showToast: boolean = true): Promise<void> {
    try {
      this.isSaving = true;
      const inserir = this.inserirDadosDieta === 'Sim';
      const sistema = this.sistemaProducao;

      for (const lote of this.lotes) {
        if (!lote.id) continue;

        // Se "Inserir dados da dieta = Não", não incluir dados dos lotes (pastejo, ingredientes, concentrado, aditivo)
        const pastejoLinhas = inserir ? (this.pastejoByLoteId[lote.id] || []) : [];
        const horas = pastejoLinhas.map(l => l.horasPorDia).filter(v => v !== undefined) as number[];
        const dias = pastejoLinhas.map(l => l.diasPorAno).filter(v => v !== undefined) as number[];
        const mediaHoras = horas.length ? Number((horas.reduce((a,b)=>a+(b||0),0) / horas.length).toFixed(2)) : undefined;
        const mediaDias = dias.length ? Number((dias.reduce((a,b)=>a+(b||0),0) / dias.length).toFixed(2)) : undefined;

        const payload: NutricaoAnimalLoteRequest = {
          loteId: lote.id,
          inserirDadosDieta: inserir,
          sistemaProducao: inserir ? sistema : undefined, // Só salvar sistema de produção se inserir dados = Sim
          tempoPastoHorasDia: mediaHoras,
          tempoPastoDiasAno: mediaDias,
          ingredientes: inserir ? (this.ingredientesByLoteId[lote.id] || [])
            .filter(it => (it?.ingrediente?.trim()) || it?.quantidadeKgCabDia != null || it?.ofertaDiasAno != null)
            .map(it => ({
              nomeIngrediente: (it.ingrediente || '').trim(),
              quantidadeKgCabDia: it.quantidadeKgCabDia || 0,
              ofertaDiasAno: it.ofertaDiasAno || 0,
              producao: it.producao || 'INTERNA'
            })) : [], // Array vazio se inserir dados = Não
          concentrados: inserir ? (this.concentradoByLoteId[lote.id] || [])
            .filter(it => (it?.proteinaBrutaPercentual != null) || (it?.ureia?.trim()) || (it?.subproduto?.trim()) || it?.quantidade != null || it?.oferta != null)
            .map(it => ({
              nomeConcentrado: `Proteína Bruta: ${it.proteinaBrutaPercentual || 0}% - Ureia: ${it.ureia || ''} - Subproduto: ${it.subproduto || ''}`,
              proteinaBrutaPercentual: it.proteinaBrutaPercentual || 0,
              ureia: it.ureia || '',
              subproduto: it.subproduto || '',
              quantidade: it.quantidade || 0,
              oferta: it.oferta || 0
            })) : [], // Array vazio se inserir dados = Não
          aditivos: inserir ? (this.aditivoByLoteId[lote.id] || [])
            .filter(it => (it?.tipo?.trim()) || (it?.dose != null) || it?.percentualAdicional != null || it?.oferta != null)
            .map(it => ({
              nomeAditivo: `${it.tipo || ''} - Dose: ${it.dose || ''}`,
              tipo: it.tipo || '',
              dose: it.dose || 0,
              oferta: it.oferta || 0,
              percentualAdicional: it.percentualAdicional || 0
            })) : [] // Array vazio se inserir dados = Não
        };

        // Verificar se já existe registro para o lote
        let existente: NutricaoAnimalLoteResponse | null = null;
        try {
          const registros = await firstValueFrom(this.nutricaoAnimalLoteService.listarPorLote(lote.id));
          existente = registros && registros.length ? registros[0] : null;
        } catch {}

        if (existente) {
          await firstValueFrom(this.nutricaoAnimalLoteService.atualizar(existente.id, payload));
        } else {
          await firstValueFrom(this.nutricaoAnimalLoteService.criar(payload));
        }
      }
      if (showToast) { this.notificationService.success('Dados de nutrição salvos com sucesso'); }
    } catch (error) {
      console.error('Erro ao salvar dados de nutrição ao avançar:', error);
      if (showToast) { this.notificationService.error('Não foi possível salvar dados de nutrição'); }
    } finally {
      this.isSaving = false;
    }
  }

  // Inicialização incremental de Nutrição para um lote específico
  private async inicializarNutricaoParaLote(loteId: number): Promise<void> {
    try {
      const cats = await firstValueFrom(this.categoriaLoteService.listarPorLote(loteId)).catch(() => []);
      const categoriasArr = (cats || []) as CategoriaLoteResponse[];
      this.categoriasPorLoteId[loteId] = categoriasArr;
      const defaultProd: 'INTERNA' | 'EXTERNA' = 'INTERNA';
      this.pastejoByLoteId[loteId] = categoriasArr.map(() => ({ horasPorDia: undefined, diasPorAno: undefined }));
      this.ingredientesByLoteId[loteId] = categoriasArr.map(() => ({ ingrediente: '', quantidadeKgCabDia: undefined, ofertaDiasAno: undefined, producao: defaultProd }));
      this.concentradoByLoteId[loteId] = categoriasArr.map(() => ({ proteinaBrutaPercentual: undefined, ureia: '', subproduto: '', quantidade: undefined, oferta: undefined }));
        this.aditivoByLoteId[loteId] = categoriasArr.map(() => ({ tipo: '', dose: undefined, oferta: undefined, percentualAdicional: undefined }));
      this.sectionsExpandedByLoteId[loteId] = this.sectionsExpandedByLoteId[loteId] || { pastejo: false, ingredientes: false, concentrado: false, aditivo: false };
      // Autoexpand para tornar o componente visível
      this.expandedNutriLotes[loteId] = true;

      // Carregar e mapear dados já persistidos para este lote
      const registros = await firstValueFrom(this.nutricaoAnimalLoteService.listarPorLote(loteId)).catch(() => []);
      if (registros && registros.length > 0) {
        const n = registros[0];
        // Aplicar valores de topo e pastejo apenas se já foram salvos anteriormente
        // NÃO inicializar automaticamente para forçar seleção do usuário
        if (this.inserirDadosDieta === undefined && n.inserirDadosDieta !== undefined) {
          // Só aplicar se há dados salvos no backend
          this.inserirDadosDieta = n.inserirDadosDieta ? 'Sim' : 'Não';
        }
        if (this.sistemaProducao === undefined && n.sistemaProducao) {
          this.sistemaProducao = n.sistemaProducao;
        }
        const linhas = this.pastejoByLoteId[loteId] || [];
        for (let i = 0; i < linhas.length; i++) {
          linhas[i] = { horasPorDia: n.tempoPastoHorasDia, diasPorAno: n.tempoPastoDiasAno };
        }
        this.pastejoByLoteId[loteId] = linhas;

        // Mapear itens por índice de categoria
        const ing = n.ingredientes || [];
        const conc = n.concentrados || [];
        const adit = n.aditivos || [];
        for (let i = 0; i < categoriasArr.length; i++) {
          const ingItem = ing[i];
          const concItem = conc[i];
          const aditItem = adit[i];
          if (ingItem) {
            this.ingredientesByLoteId[loteId][i] = {
              ingrediente: (ingItem as any).nomeIngrediente || '',
              quantidadeKgCabDia: ingItem.quantidadeKgCabDia,
              ofertaDiasAno: ingItem.ofertaDiasAno,
              producao: ingItem.producao as ('INTERNA' | 'EXTERNA')
            };
          }
          if (concItem) {
            this.concentradoByLoteId[loteId][i] = {
              proteinaBrutaPercentual: (concItem as any).proteinaBrutaPercentual || 0,
              ureia: (concItem as any).ureia || '',
              subproduto: (concItem as any).subproduto || '',
              quantidade: concItem.quantidade,
              oferta: concItem.oferta
            };
          }
          if (aditItem) {
            this.aditivoByLoteId[loteId][i] = {
              tipo: (aditItem as any).tipo || '',
              dose: (aditItem as any).dose || '',
              oferta: aditItem.oferta,
              percentualAdicional: (aditItem as any).percentualAdicional || 0
            };
          }
        }
      }
    } catch (error) {
      console.warn(`Falha ao inicializar dados de Nutrição para lote ${loteId}:`, error);
    }
  }

  private async carregarDadosLote(loteId: number): Promise<void> {
    try {
      this.isLoading = true;

      // Carregar dados relacionados ao lote
      const [categorias, nutricao, manejo] = await Promise.all([
        firstValueFrom(this.categoriaLoteService.listarPorLote(loteId)),
        firstValueFrom(this.nutricaoAnimalLoteService.listarPorLote(loteId)),
        firstValueFrom(this.manejoDejetosLoteService.listarPorLote(loteId))
      ]);

      this.categorias = categorias || [];
      this.nutricao = nutricao || [];
      this.manejo = manejo || [];

      // Sincronizar dados carregados com a estrutura de edição dos cards (Informações Gerais)
      const rows = (this.categorias || []).map(c => ({
        categoriaCorteId: c.categoriaCorteId,
        animaisFazenda: c.quantidadeAnimais,
        pesoMedioVivo: Number((c as any).pesoMedio),
        observacoes: c.observacoes,
        animaisComprados: c.animaisComprados,
        pesoMedioComprados: Number((c as any).pesoMedioComprados),
        animaisVendidos: c.animaisVendidos,
        pesoMedioVendidos: Number((c as any).pesoMedioVendidos),
        permanenciaMeses: Number((c as any).permanenciaMeses),
        idadeDesmame: Number((c as any).idadeDesmame),
        femasPrenhasPercent: c.femeasPrenhasPercentual,
        producaoLeite: c.producaoLeiteAno,
        teorGorduraLeite: c.teorGorduraLeite,
        teorProteinaLeite: c.teorProteinaLeite
      }));
      if (rows.length > 0) {
        this.loteFormRowsById[loteId] = rows;
      } else {
        this.loteFormRowsById[loteId] = this.loteFormRowsById[loteId] || [{}];
      }

    } catch (error) {
      console.error('Erro ao carregar dados do lote:', error);
      this.notificationService.error('Erro ao carregar dados do lote');
      
      // Inicializar com arrays vazios em caso de erro
      this.categorias = [];
      this.nutricao = [];
      this.manejo = [];
    } finally {
      this.isLoading = false;
    }
  }

  // Controle de abas
  async selecionarAba(aba: 'informacoes' | 'nutricao' | 'manejo', opts?: { showToast?: boolean }): Promise<void> {
    const showToast = opts?.showToast ?? true;
    // Aplicar regra de bloqueio apenas ao avançar para abas subsequentes
    const ordem: Record<'informacoes' | 'nutricao' | 'manejo', number> = { informacoes: 0, nutricao: 1, manejo: 2 };
    const indoParaFrente = ordem[aba] > ordem[this.abaAtiva];

    // Autosave do conteúdo da aba atual antes de trocar
    try {
      if (this.abaAtiva === 'informacoes') {
        console.debug('[selecionarAba] Autosave de Informações Gerais antes de trocar de aba');
        await this.salvarLotesPendentes(false);
        if (showToast) {
          this.notificationService.success('Modificações salvas com sucesso');
        }
      } else if (this.abaAtiva === 'nutricao') {
        console.debug('[selecionarAba] Autosave de Nutrição antes de trocar de aba');
        await this.salvarNutricaoAoAvancar(showToast);
      } else {
        console.debug('[selecionarAba] Autosave genérico (rascunho) antes de trocar de aba');
        await this.salvarRascunho();
        if (showToast) {
          this.notificationService.success('Modificações salvas com sucesso');
        }
      }
    } catch (e) {
      console.warn('[selecionarAba] Falha no autosave antes da troca de aba', e);
      if (showToast) {
        this.notificationService.error('Erro ao salvar alterações');
      }
    }

    // Validação adicional ao avançar a partir de Informações
    if (indoParaFrente && this.abaAtiva === 'informacoes') {
      if (!this.validarIgualdadeAnimaisParaInformacoesGerais()) {
        this.abrirQuantidadeMismatchModal();
        return;
      }
    }

    if (indoParaFrente) {
      if (aba === 'manejo' && !this.canIrParaManejo()) {
        this.notificationService.error('Preencha ao menos um lote completo na Nutrição Manual para acessar o Manejo de Dejetos.');
        return;
      }
    }

    this.abaAtiva = aba;

    // Ao voltar para Informações, garantir que as opções de categorias sejam recalculadas
    // e recarregar os dados dos lotes para sincronizar com o banco de dados
    if (aba === 'informacoes') {
      this.atualizarOpcoesPorTipo();
      // Recarregar dados dos lotes existentes para garantir sincronização
      for (const lote of this.lotes) {
        if (lote.id) {
          await this.carregarDadosLote(lote.id);
        }
      }
    }

    // Ao entrar na aba de Nutrição, garantir sincronização e visualização dos cards por lote
    if (aba === 'nutricao') {
      await this.prepareNutriTab();
    }
    // Ao entrar na aba de Manejo, preparar imediatamente os dados sem precisar de refresh
    if (aba === 'manejo') {
      await this.prepareManejoTab();
    }
  }

  // Preparar aba de Nutrição: sincroniza e autoexpande os lotes
  private async prepareNutriTab(): Promise<void> {
    // Antes de preparar visualização, assegurar persistência de lotes criados via painel inline
    await this.salvarLotesPendentes(false);
    if (!this.lotes || this.lotes.length === 0) return;
    for (const l of this.lotes) {
      const id = l.id!;
      if (!this.categoriasPorLoteId[id]) {
        await this.inicializarNutricaoParaLote(id);
      } else {
        // Garantir estruturas e expansão
        this.sectionsExpandedByLoteId[id] = this.sectionsExpandedByLoteId[id] || { pastejo: false, ingredientes: false, concentrado: false, aditivo: false };
        this.expandedNutriLotes[id] = true;
      }
    }
  }

  // Preparar aba de Manejo: garante categorias carregadas e inicializa placeholders/itens
  private async prepareManejoTab(): Promise<void> {
    // Persistir lotes pendentes antes de preparar visualização
    await this.salvarLotesPendentes(false);
    if (!this.lotes || this.lotes.length === 0) return;
    // Garantir que categorias por lote estejam disponíveis
    for (const l of this.lotes) {
      const id = l.id!;
      if (!this.categoriasPorLoteId[id]) {
        await this.carregarDadosLote(id);
      }
    }
    // Inicializar estrutura de manejo por lote/categoria
    await this.inicializarManejoParaLotes();
  }

  // Persistir lotes criados via painel inline antes de navegação ou visualização
  private async salvarLotesPendentes(showToast: boolean = false): Promise<void> {
    console.debug('[salvarLotesPendentes] Iniciando verificação e persistência de lotes/categorias pendentes');
    // 1) Persistir lotes criados via painel inline, se houver
    if (Array.isArray(this.novoLotesPanels) && this.novoLotesPanels.length > 0) {
      console.debug('[salvarLotesPendentes] Painéis inline detectados:', this.novoLotesPanels.length);
      const pendentes = this.novoLotesPanels.filter(p => !!p?.novoLote?.nome?.trim());
      for (const p of pendentes) {
        const nome = (p.novoLote.nome || '').trim();
        if (!nome || !this.validarNomeLote(nome)) continue;
        try {
          const request = {
            inventarioId: this.inventarioId,
            nome,
            ordem: p.novoLote.ordem || this.lotes.length + 1,
            observacoes: p.novoLote.observacoes?.trim()
          };
          const response = await firstValueFrom(this.loteRebanhoService.criar(request));
          if (response) {
            const novoLote: LoteRebanho = {
              id: response.id,
              inventarioId: response.inventarioId,
              nome: response.nome,
              ordem: response.ordem,
              observacoes: response.observacoes,
              dataCriacao: response.dataCriacao,
              dataAtualizacao: response.dataAtualizacao
            };
            this.lotes.push(novoLote);
            this.selecionarLote(novoLote);
            // Persistir categorias do editor inline vinculadas ao novo lote
            console.debug('[salvarLotesPendentes] Persistindo categorias do painel inline para lote', novoLote.id);
            await this.persistirCategoriasParaLote(novoLote.id!, p.categoriasRows || []);
            // Atualizar estados e dados após persistir categorias
            await this.inicializarNutricaoParaLote(novoLote.id!);
          }
        } catch (e) {
          console.warn('Falha ao salvar lote pendente:', e);
          this.notificationService.error('Não foi possível salvar o lote pendente');
        }
      }
      // Limpar painéis após tentativa de persistência
      this.novoLotesPanels = [];
    }

    // 2) Sempre persistir alterações em categorias dos cards de lotes existentes
    try {
      const loteIds = Object.keys(this.loteFormRowsById).map(id => Number(id)).filter(id => !!id);
      console.debug('[salvarLotesPendentes] IDs de lotes com rows em edição:', loteIds);
      for (const loteId of loteIds) {
        const rows = this.loteFormRowsById[loteId] || [];
        console.debug(`[salvarLotesPendentes] Lote ${loteId} possui ${rows.length} linha(s) para persistir`);
        if (rows.length > 0) {
          await this.persistirCategoriasParaLote(loteId, rows);
        }
      }
      // Feedback visual opcional para evitar duplicidade
      if (showToast) {
        this.notificationService.success('Modificações salvas com sucesso');
      }
    } catch (e) {
      console.warn('Falha ao persistir categorias dos lotes existentes:', e);
      this.notificationService.error('Não foi possível salvar as informações gerais');
    }
  }

  // Salvar um painel inline específico (botão "Salvar lote" no editor inline)
  async salvarNovoLotePanel(index: number): Promise<void> {
    const p = this.novoLotesPanels[index];
    if (!p) return;
    const nome = (p.novoLote.nome || '').trim();
    if (!nome) {
      this.notificationService.error('Nome do lote é obrigatório.');
      return;
    }
    if (!this.validarNomeLote(nome)) {
      return;
    }
    try {
      this.isSaving = true;
      const request = {
        inventarioId: this.inventarioId,
        nome,
        ordem: p.novoLote.ordem || this.lotes.length + 1,
        observacoes: p.novoLote.observacoes?.trim()
      };
      const response = await firstValueFrom(this.loteRebanhoService.criar(request));
      if (response) {
        const novoLote: LoteRebanho = {
          id: response.id,
          inventarioId: response.inventarioId,
          nome: response.nome,
          ordem: response.ordem,
          observacoes: response.observacoes,
          dataCriacao: response.dataCriacao,
          dataAtualizacao: response.dataAtualizacao
        };
        this.lotes.push(novoLote);
        this.selecionarLote(novoLote);
        // Persistir categorias do painel inline (se houver)
        await this.persistirCategoriasParaLote(novoLote.id!, p.categoriasRows || []);
        await this.inicializarNutricaoParaLote(novoLote.id!);
        this.notificationService.success('Lote criado com sucesso!');
        // Remover painel salvo
        this.novoLotesPanels.splice(index, 1);
      }
    } catch (error) {
      console.error('Erro ao salvar lote (inline):', error);
      this.notificationService.error('Erro ao salvar lote. Tente novamente.');
    } finally {
      this.isSaving = false;
    }
  }

  // Controle de lotes
  selecionarLote(lote: LoteRebanho): void {
    this.loteAtivo = lote;
    if (lote.id) {
      this.carregarDadosLote(lote.id);
    }
  }

  // Inicialização e organização de Manejo (novo layout)
  private async inicializarManejoParaLotes(): Promise<void> {
    this.manejosPorLoteCategoria = {};
    for (const l of this.lotes) {
      const loteId = l.id!;
      try {
        const lista = await firstValueFrom(this.manejoDejetosLoteService.listarPorLote(loteId)).catch(() => []);
        const porCategoria: Record<string, ManejoDejetosLote[]> = {};
        const cats = this.categoriasPorLoteId[loteId] || [];
        // Deduplicar por categoriaCorteId para evitar repetição de Lote/Categoria na tabela de Manejo
        const catsUnique = Array.isArray(cats)
          ? cats.filter((c, idx, arr) => c?.categoriaCorteId != null && arr.findIndex(x => x.categoriaCorteId === c.categoriaCorteId) === idx)
          : [];
        this.categoriasPorLoteIdUnicas[loteId] = catsUnique;
        // Garantir ao menos uma linha por categoria
        for (const cat of catsUnique) {
          const categoriaNome = this.getCategoriaCorteLabel(cat.categoriaCorteId);
          const existentes = (lista || []).filter(m => m.categoriaAnimal === categoriaNome);
          // Se não houver itens persistidos, criar placeholder local para exibir os campos
          porCategoria[categoriaNome] = existentes.length > 0 ? existentes : [{
            loteId,
            categoriaAnimal: categoriaNome,
            tipoManejo: '' as any,
            percentualRebanho: 0
          } as ManejoDejetosLote];
        }
        this.manejosPorLoteCategoria[loteId] = porCategoria;
      } catch (e) {
        console.warn('Falha ao inicializar manejo para lote', loteId, e);
        this.manejosPorLoteCategoria[loteId] = {};
      }
    }
    this.recalcularTotalPercentual();
  }

  private recalcularTotalPercentual(): void {
    // Não calcula mais um total geral, mas sim valida cada lote individualmente
    this.totalPercentualGeral = 0; // Resetar para não interferir na validação
  }

  // Novo método para calcular percentual por lote individualmente
  private calcularPercentualPorLote(loteId: number): number {
    let totalLote = 0;
    const mapa = this.manejosPorLoteCategoria[loteId] || {};
    for (const cat of Object.keys(mapa)) {
      for (const m of mapa[cat] || []) {
        totalLote += Number(m.percentualRebanho || 0);
      }
    }
    return totalLote;
  }

  // Método para validar se todos os lotes têm percentual = 100%
  private validarPercentuaisIndividuais(): boolean {
    // Verificar se há lotes mas não há dados de manejo
    if (this.lotes && this.lotes.length > 0) {
      const loteIds = this.lotes.map(l => l.id!);
      
      for (const loteId of loteIds) {
        const mapa = this.manejosPorLoteCategoria[loteId] || {};
        const categorias = Object.keys(mapa);
        
        // Se não há categorias de manejo para este lote, é inválido
        if (categorias.length === 0) {
          return false;
        }
        
        let totalLote = 0;
        let temDadosPreenchidos = false;
        
        for (const cat of categorias) {
          const manejos = mapa[cat] || [];
          
          // Se não há manejos para esta categoria, é inválido
          if (manejos.length === 0) {
            return false;
          }
          
          for (const m of manejos) {
            const percentual = Number(m.percentualRebanho || 0);
            totalLote += percentual;
            
            // Se há percentual preenchido, marca como tendo dados
            if (percentual > 0) {
              temDadosPreenchidos = true;
            }
          }
        }
        
        // Se não tem dados preenchidos ou o total não é 100%, é inválido
        if (!temDadosPreenchidos || totalLote !== 100) {
          return false;
        }
      }
    }
    
    return true;
  }

  // Método para validar se todos os tipos de manejo estão selecionados
  private validarTiposManejoObrigatorios(): boolean {
    for (const loteIdStr of Object.keys(this.manejosPorLoteCategoria)) {
      const mapa = this.manejosPorLoteCategoria[Number(loteIdStr)] || {};
      for (const cat of Object.keys(mapa)) {
        for (const m of mapa[cat] || []) {
          if (!m.tipoManejo || m.tipoManejo.trim() === '') {
            return false;
          }
        }
      }
    }
    return true;
  }

  adicionarTipoManejo(loteId: number, categoriaNome: string): void {
    if (!this.manejosPorLoteCategoria[loteId]) this.manejosPorLoteCategoria[loteId] = {};
    if (!this.manejosPorLoteCategoria[loteId][categoriaNome]) this.manejosPorLoteCategoria[loteId][categoriaNome] = [];
    const novo: ManejoDejetosLoteRequest = {
      loteId,
      categoriaAnimal: categoriaNome,
      tipoManejo: (this.tiposManejoOpcoes[0]?.value || this.tiposManejo[0].value),
      percentualRebanho: 0
    };
    this.manejoDejetosLoteService.criar(novo).subscribe({
      next: (created) => {
        this.manejosPorLoteCategoria[loteId][categoriaNome].push(created);
        this.recalcularTotalPercentual();
      },
      error: (err) => {
        console.error('Erro ao adicionar tipo de manejo:', err);
        this.notificationService.error('Erro ao adicionar tipo de manejo.');
      }
    });
  }

  removerTipoManejo(loteId: number, categoriaNome: string, item: ManejoDejetosLote): void {
    const arr = this.manejosPorLoteCategoria[loteId]?.[categoriaNome] || [];
    // Bloqueia remoção se houver apenas um item e exibe alerta
    if (arr.length <= 1) {
      this.showManejoSingleRemovalAlert = true;
      return;
    }
    const id = item.id;
    if (!id) {
      // Remoção local de item não persistido
      const idx = arr.indexOf(item);
      if (idx >= 0) arr.splice(idx, 1);
      this.recalcularTotalPercentual();
      return;
    }
    this.manejoDejetosLoteService.deletar(id).subscribe({
      next: () => {
        this.manejosPorLoteCategoria[loteId][categoriaNome] = arr.filter(m => m.id !== id);
        this.notificationService.success('Tipo de manejo removido.');
        this.recalcularTotalPercentual();
      },
      error: (err) => {
        console.error('Erro ao remover tipo de manejo:', err);
        this.notificationService.error('Erro ao remover tipo de manejo.');
      }
    });
  }

  fecharAlertaManejoUnico(): void {
    this.showManejoSingleRemovalAlert = false;
  }

  atualizarTipoManejo(loteId: number, categoriaNome: string, item: ManejoDejetosLote, campo: 'tipoManejo' | 'percentualRebanho', valor: any): void {
    // Validação em tempo real para percentual
    if (campo === 'percentualRebanho') {
      const novoPercentual = Number(valor);
      
      // Calcular o total atual do lote sem este item
      let totalAtualSemItem = 0;
      const mapa = this.manejosPorLoteCategoria[loteId] || {};
      for (const cat of Object.keys(mapa)) {
        for (const m of mapa[cat] || []) {
          if (m !== item) {
            totalAtualSemItem += Number(m.percentualRebanho || 0);
          }
        }
      }
      
      // Verificar se o novo valor não fará o total ultrapassar 100%
      const totalComNovoValor = totalAtualSemItem + novoPercentual;
      if (totalComNovoValor > 100) {
        this.notificationService.error(`O percentual não pode ultrapassar 100% para este lote. Total seria: ${totalComNovoValor}%`);
        return;
      }
    }
    
    const payload: ManejoDejetosLoteRequest = {
      loteId,
      categoriaAnimal: categoriaNome,
      tipoManejo: campo === 'tipoManejo' ? valor : item.tipoManejo,
      percentualRebanho: campo === 'percentualRebanho' ? Number(valor) : Number(item.percentualRebanho || 0)
    };
    if (item.id) {
      this.manejoDejetosLoteService.atualizar(item.id, payload).subscribe({
        next: (upd) => {
          Object.assign(item, upd);
          this.recalcularTotalPercentual();
        },
        error: (err) => {
          console.error('Erro ao atualizar tipo de manejo:', err);
          this.notificationService.error('Erro ao atualizar tipo de manejo.');
        }
      });
    } else {
      this.manejoDejetosLoteService.criar(payload).subscribe({
        next: (created) => {
          Object.assign(item, created);
          this.recalcularTotalPercentual();
        },
        error: (err) => {
          console.error('Erro ao salvar tipo de manejo:', err);
          this.notificationService.error('Erro ao salvar tipo de manejo.');
        }
      });
    }
  }

  // Método para verificar se pode continuar na aba de manejo
  canContinuarManejo(): boolean {
    return this.validarTiposManejoObrigatorios() && this.validarPercentuaisIndividuais();
  }

  validarPercentualGeral(): boolean {
    this.recalcularTotalPercentual();
    // Validar se todos os tipos de manejo estão selecionados
    if (!this.validarTiposManejoObrigatorios()) {
      this.notificationService.error('Todos os tipos de manejo devem ser selecionados.');
      return false;
    }
    
    // Validar se todos os lotes têm percentual = 100%
    if (!this.validarPercentuaisIndividuais()) {
      this.notificationService.error('Cada lote deve ter exatamente 100% de percentual do rebanho distribuído.');
      return false;
    }
    
    return true;
  }

  // Nutrição Animal - helpers
  toggleNutriLote(loteId: number): void {
    this.expandedNutriLotes[loteId] = !this.expandedNutriLotes[loteId];
  }

  toggleSection(loteId: number, section: 'pastejo' | 'ingredientes' | 'concentrado' | 'aditivo'): void {
    const state = this.sectionsExpandedByLoteId[loteId] || { pastejo: false, ingredientes: false, concentrado: false, aditivo: false };
    state[section] = !state[section];
    this.sectionsExpandedByLoteId[loteId] = state;
  }

  getCategoriaCorteLabel(id?: number): string {
    if (!id) return '';
    const cat = this.categoriasCorte.find(c => c.id === id);
    return cat ? cat.categoria : '';
  }

  // Cards de lote: expandir/recolher
  toggleLoteCard(loteId: number): void {
    const current = !!this.expandedLotes[loteId];
    this.expandedLotes[loteId] = !current;
    if (!current) {
      // Ao expandir pela primeira vez, preparar linhas padrão se necessário
      if (!this.loteFormRowsById[loteId]) {
        this.loteFormRowsById[loteId] = [{}];
      }
      // Opcional: carregar dados existentes do lote
      this.carregarDadosLote(loteId);
    }
  }

  adicionarCategoriaLinhaCard(loteId: number): void {
    if (!this.loteFormRowsById[loteId]) {
      this.loteFormRowsById[loteId] = [{}];
    } else {
      this.loteFormRowsById[loteId].push({});
    }
  }

  // Persistência de categorias vinculadas a um lote (Informações Gerais)
  private async persistirCategoriasParaLote(
    loteId: number,
    rows: Array<{ categoriaCorteId?: number; animaisFazenda?: number; pesoMedioVivo?: number; observacoes?: string; animaisComprados?: number; pesoMedioComprados?: number; animaisVendidos?: number; pesoMedioVendidos?: number; permanenciaMeses?: number; idadeDesmame?: number; femasPrenhasPercent?: number; producaoLeite?: number; teorGorduraLeite?: number; teorProteinaLeite?: number }>
  ): Promise<void> {
    if (!loteId || !Array.isArray(rows) || rows.length === 0) return;
    console.debug(`[persistirCategoriasParaLote] Lote ${loteId}. Total de rows recebidas:`, rows.length);

    // Obter categorias existentes do lote para realizar upsert (atualizar/criar)
    let existentes: CategoriaLoteResponse[] = [];
    try {
      // Sempre buscar do backend para garantir dados atualizados
      existentes = await firstValueFrom(this.categoriaLoteService.listarPorLote(loteId));
      // Atualizar cache local
      this.categoriasPorLoteId[loteId] = existentes;
    } catch {
      existentes = [];
    }
    
    console.debug(`[persistirCategoriasParaLote] Lote ${loteId}. Categorias existentes encontradas:`, existentes.length);

    const validRows = rows.filter(r =>
      (r.categoriaCorteId != null) || (r.animaisFazenda != null) || (r.pesoMedioVivo != null) ||
      (r.animaisComprados != null) || (r.pesoMedioComprados != null) || (r.animaisVendidos != null) ||
      (r.pesoMedioVendidos != null) || (r.permanenciaMeses != null) || (r.idadeDesmame != null) ||
      (r.femasPrenhasPercent != null) || (r.producaoLeite != null) || (r.teorGorduraLeite != null) || (r.teorProteinaLeite != null)
    );
    console.debug(`[persistirCategoriasParaLote] Lote ${loteId}. Rows válidas para upsert:`, validRows.length);

    // CORREÇÃO: Mapear por índice para evitar duplicação ao editar tipo de categoria
    // Usar sempre o índice da linha para mapear com a categoria existente correspondente
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      const payload: CategoriaLoteRequest = {
        loteId,
        quantidadeAnimais: r.animaisFazenda ?? 0,
        pesoMedio: r.pesoMedioVivo ?? 0,
        categoriaCorteId: r.categoriaCorteId,
        categoriaLeiteId: undefined,
        observacoes: r.observacoes,
        animaisComprados: r.animaisComprados ?? 0,
        pesoMedioComprados: r.pesoMedioComprados ?? 0,
        animaisVendidos: r.animaisVendidos ?? 0,
        pesoMedioVendidos: r.pesoMedioVendidos ?? 0,
        permanenciaMeses: r.permanenciaMeses ?? 0,
        idadeDesmame: r.idadeDesmame ?? 0,
        femeasPrenhasPercentual: r.femasPrenhasPercent,
        producaoLeiteAno: r.producaoLeite,
        teorGorduraLeite: r.teorGorduraLeite,
        teorProteinaLeite: r.teorProteinaLeite
      };

      // CORREÇÃO: Usar sempre o índice para mapear com categoria existente
      // Isso evita duplicação quando o tipo de categoria é alterado
      const existente = existentes[i];

      try {
        if (existente && existente.id != null) {
          console.debug(`[persistirCategoriasParaLote] Atualizando categoria existente id=${existente.id} para lote ${loteId}`, payload);
          await firstValueFrom(this.categoriaLoteService.atualizar(existente.id!, payload));
        } else {
          console.debug(`[persistirCategoriasParaLote] Criando nova categoria para lote ${loteId}`, payload);
          await firstValueFrom(this.categoriaLoteService.criar(payload));
        }
      } catch (err) {
        console.warn('Falha ao persistir categoria do lote', { loteId, payload, err });
      }
    }
    
    // Recarregar categorias após persistir para manter sincronização
    try {
      const categoriasAtualizadas = await firstValueFrom(this.categoriaLoteService.listarPorLote(loteId));
      
      // Armazenar categorias anteriores antes da atualização para comparação
      const categoriasAnteriores = this.categoriasPorLoteId[loteId] || [];
      
      this.categoriasPorLoteId[loteId] = categoriasAtualizadas;
      
      // Se este é o lote ativo, atualizar também a lista principal
      if (this.loteAtivo && this.loteAtivo.id === loteId) {
        this.categorias = categoriasAtualizadas;
      }

      // SINCRONIZAÇÃO: Atualizar loteFormRowsById com os dados atualizados
      this.loteFormRowsById[loteId] = categoriasAtualizadas.map(categoria => ({
        categoriaCorteId: categoria.categoriaCorteId,
        animaisFazenda: categoria.quantidadeAnimais,
        pesoMedioVivo: categoria.pesoMedio,
        observacoes: categoria.observacoes,
        animaisComprados: categoria.animaisComprados,
        pesoMedioComprados: categoria.pesoMedioComprados,
        animaisVendidos: categoria.animaisVendidos,
        pesoMedioVendidos: categoria.pesoMedioVendidos,
        permanenciaMeses: categoria.permanenciaMeses,
        idadeDesmame: categoria.idadeDesmame,
        femasPrenhasPercent: categoria.femeasPrenhasPercentual,
        producaoLeite: categoria.producaoLeiteAno,
        teorGorduraLeite: categoria.teorGorduraLeite,
        teorProteinaLeite: categoria.teorProteinaLeite
      }));

      // SINCRONIZAÇÃO: Atualizar estruturas da aba de nutrição manual
      // Passar as categorias anteriores para preservar dados durante mudanças
      this.sincronizarCategoriasParaNutricaoComHistorico(loteId, categoriasAtualizadas, categoriasAnteriores);
      
    } catch (err) {
      console.warn('Falha ao recarregar categorias após persistir', { loteId, err });
    }
  }

  /**
   * Sincroniza categorias para nutrição preservando dados existentes durante mudanças
   */
  private sincronizarCategoriasParaNutricaoComHistorico(loteId: number, categoriasAtuais: CategoriaLote[], categoriasAnteriores: CategoriaLote[]): void {
    console.log('Sincronizando categorias com histórico', { loteId, categoriasAtuais, categoriasAnteriores });
    
    // Criar mapeamento das categorias anteriores por ID para preservar dados
    const mapeamentoAnterior = new Map<number, CategoriaLote>();
    categoriasAnteriores.forEach(cat => {
      if (cat.id) {
        mapeamentoAnterior.set(cat.id, cat);
      }
    });

    // Criar mapeamento dos dados de nutrição existentes por categoria ID
    const dadosNutricaoExistentes = {
      pastejo: new Map<number, any>(),
      ingredientes: new Map<number, any>(),
      concentrado: new Map<number, any>(),
      aditivo: new Map<number, any>()
    };

    // Preservar dados existentes baseados no ID da categoria
    if (this.pastejoByLoteId[loteId]) {
      this.pastejoByLoteId[loteId].forEach((pastejo: any, index: number) => {
        const categoriaAnterior = categoriasAnteriores[index];
        if (categoriaAnterior?.id) {
          dadosNutricaoExistentes.pastejo.set(categoriaAnterior.id, pastejo);
        }
      });
    }

    if (this.ingredientesByLoteId[loteId]) {
      this.ingredientesByLoteId[loteId].forEach((ingrediente: any, index: number) => {
        const categoriaAnterior = categoriasAnteriores[index];
        if (categoriaAnterior?.id) {
          dadosNutricaoExistentes.ingredientes.set(categoriaAnterior.id, ingrediente);
        }
      });
    }

    if (this.concentradoByLoteId[loteId]) {
      this.concentradoByLoteId[loteId].forEach((concentrado: any, index: number) => {
        const categoriaAnterior = categoriasAnteriores[index];
        if (categoriaAnterior?.id) {
          dadosNutricaoExistentes.concentrado.set(categoriaAnterior.id, concentrado);
        }
      });
    }

    if (this.aditivoByLoteId[loteId]) {
      this.aditivoByLoteId[loteId].forEach((aditivo: any, index: number) => {
        const categoriaAnterior = categoriasAnteriores[index];
        if (categoriaAnterior?.id) {
          dadosNutricaoExistentes.aditivo.set(categoriaAnterior.id, aditivo);
        }
      });
    }

    // Ajustar arrays para o novo número de categorias, preservando dados por ID
    const numCategorias = categoriasAtuais.length;

    // Pastejo
    this.pastejoByLoteId[loteId] = Array.from({ length: numCategorias }, (_, index) => {
      const categoriaAtual = categoriasAtuais[index];
      if (categoriaAtual?.id && dadosNutricaoExistentes.pastejo.has(categoriaAtual.id)) {
        return dadosNutricaoExistentes.pastejo.get(categoriaAtual.id);
      }
      return this.pastejoByLoteId[loteId]?.[index] || { horasPorDia: undefined, diasPorAno: undefined };
    });

    // Ingredientes
    this.ingredientesByLoteId[loteId] = Array.from({ length: numCategorias }, (_, index) => {
      const categoriaAtual = categoriasAtuais[index];
      if (categoriaAtual?.id && dadosNutricaoExistentes.ingredientes.has(categoriaAtual.id)) {
        return dadosNutricaoExistentes.ingredientes.get(categoriaAtual.id);
      }
      return this.ingredientesByLoteId[loteId]?.[index] || { ingrediente: '', quantidadeKgCabDia: undefined, ofertaDiasAno: undefined, producao: 'INTERNA' };
    });

    // Concentrado
    this.concentradoByLoteId[loteId] = Array.from({ length: numCategorias }, (_, index) => {
      const categoriaAtual = categoriasAtuais[index];
      if (categoriaAtual?.id && dadosNutricaoExistentes.concentrado.has(categoriaAtual.id)) {
        return dadosNutricaoExistentes.concentrado.get(categoriaAtual.id);
      }
      return this.concentradoByLoteId[loteId]?.[index] || { proteinaBrutaPercentual: undefined, ureia: '', subproduto: '', quantidade: undefined, oferta: undefined };
    });

    // Aditivo
    this.aditivoByLoteId[loteId] = Array.from({ length: numCategorias }, (_, index) => {
      const categoriaAtual = categoriasAtuais[index];
      if (categoriaAtual?.id && dadosNutricaoExistentes.aditivo.has(categoriaAtual.id)) {
        return dadosNutricaoExistentes.aditivo.get(categoriaAtual.id);
      }
      return this.aditivoByLoteId[loteId]?.[index] || { tipo: '', dose: undefined, oferta: undefined, percentualAdicional: undefined };
    });

    console.log('Sincronização com histórico concluída', {
      loteId,
      numCategorias,
      dadosPreservados: {
        pastejo: dadosNutricaoExistentes.pastejo.size,
        ingredientes: dadosNutricaoExistentes.ingredientes.size,
        concentrado: dadosNutricaoExistentes.concentrado.size,
        aditivo: dadosNutricaoExistentes.aditivo.size
      }
    });
  }

  /**
   * Sincroniza as categorias alteradas na aba "Informações Gerais" com a aba "Nutrição Manual"
   * Atualiza as estruturas de dados para pastejo, ingredientes, concentrado e aditivo
   * Mapeia por ID da categoria para preservar dados existentes durante edições
   */
  private sincronizarCategoriasParaNutricao(loteId: number, categorias: CategoriaLoteResponse[]): void {
    console.debug(`[sincronizarCategoriasParaNutricao] Sincronizando ${categorias.length} categorias para lote ${loteId}`);
    
    const defaultProd: 'INTERNA' | 'EXTERNA' = 'INTERNA';
    
    // Preservar dados existentes se houver
    const pastejoExistente = this.pastejoByLoteId[loteId] || [];
    const ingredientesExistente = this.ingredientesByLoteId[loteId] || [];
    const concentradoExistente = this.concentradoByLoteId[loteId] || [];
    const aditivoExistente = this.aditivoByLoteId[loteId] || [];
    
    // Obter categorias anteriores para mapear por ID
    const categoriasAnteriores = this.categoriasPorLoteId[loteId] || [];
    
    // Criar mapeamento de ID da categoria para índice anterior (para preservar dados)
    const mapeamentoIdParaIndice = new Map<number, number>();
    categoriasAnteriores.forEach((cat, index) => {
      if (cat.categoriaCorteId != null) {
        mapeamentoIdParaIndice.set(cat.categoriaCorteId, index);
      }
    });
    
    // Ajustar arrays mapeando por ID da categoria ao invés de índice
    this.pastejoByLoteId[loteId] = categorias.map((categoria, novoIndex) => {
      if (categoria.categoriaCorteId != null) {
        const indiceAnterior = mapeamentoIdParaIndice.get(categoria.categoriaCorteId);
        if (indiceAnterior !== undefined && pastejoExistente[indiceAnterior]) {
          // Preservar dados existentes da categoria com mesmo ID
          return pastejoExistente[indiceAnterior];
        }
      }
      // Para categorias novas ou sem dados anteriores, usar valores padrão
      return { horasPorDia: undefined, diasPorAno: undefined };
    });
    
    this.ingredientesByLoteId[loteId] = categorias.map((categoria, novoIndex) => {
      if (categoria.categoriaCorteId != null) {
        const indiceAnterior = mapeamentoIdParaIndice.get(categoria.categoriaCorteId);
        if (indiceAnterior !== undefined && ingredientesExistente[indiceAnterior]) {
          // Preservar dados existentes da categoria com mesmo ID
          return ingredientesExistente[indiceAnterior];
        }
      }
      // Para categorias novas ou sem dados anteriores, usar valores padrão
      return { 
        ingrediente: '', 
        quantidadeKgCabDia: undefined, 
        ofertaDiasAno: undefined, 
        producao: defaultProd 
      };
    });
    
    this.concentradoByLoteId[loteId] = categorias.map((categoria, novoIndex) => {
      if (categoria.categoriaCorteId != null) {
        const indiceAnterior = mapeamentoIdParaIndice.get(categoria.categoriaCorteId);
        if (indiceAnterior !== undefined && concentradoExistente[indiceAnterior]) {
          // Preservar dados existentes da categoria com mesmo ID
          return concentradoExistente[indiceAnterior];
        }
      }
      // Para categorias novas ou sem dados anteriores, usar valores padrão
      return { 
        proteinaBrutaPercentual: undefined, 
        ureia: undefined, 
        subproduto: undefined, 
        quantidade: undefined, 
        oferta: undefined 
      };
    });
    
    this.aditivoByLoteId[loteId] = categorias.map((categoria, novoIndex) => {
      if (categoria.categoriaCorteId != null) {
        const indiceAnterior = mapeamentoIdParaIndice.get(categoria.categoriaCorteId);
        if (indiceAnterior !== undefined && aditivoExistente[indiceAnterior]) {
          // Preservar dados existentes da categoria com mesmo ID
          return aditivoExistente[indiceAnterior];
        }
      }
      // Para categorias novas ou sem dados anteriores, usar valores padrão
      return { 
        tipo: undefined, 
        dose: undefined, 
        oferta: undefined, 
        percentualAdicional: undefined 
      };
    });
    
    console.debug(`[sincronizarCategoriasParaNutricao] Sincronização concluída para lote ${loteId}:`, {
      pastejo: this.pastejoByLoteId[loteId].length,
      ingredientes: this.ingredientesByLoteId[loteId].length,
      concentrado: this.concentradoByLoteId[loteId].length,
      aditivo: this.aditivoByLoteId[loteId].length,
      mapeamentoPreservado: mapeamentoIdParaIndice.size
    });
  }

  // Lotes
  abrirModalLote(lote?: LoteRebanho): void {
    if (lote) {
      this.editingLoteId = lote.id || null;
      this.novoLote = { ...lote };
    } else {
      this.editingLoteId = null;
      this.novoLote = {
        inventarioId: this.inventarioId,
        nome: '',
        ordem: this.lotes.length + 1
      };
    }
    this.showLoteModal = true;
  }

  fecharModalLote(): void {
    this.showLoteModal = false;
    this.editingLoteId = null;
    this.novoLote = {};
  }

  async salvarLote(): Promise<void> {
    if (!this.novoLote.nome?.trim()) {
      this.notificationService.error('Nome do lote é obrigatório.');
      return;
    }

    // Validar nome do lote
    if (!this.validarNomeLote(this.novoLote.nome.trim())) {
      return;
    }

    try {
      this.isSaving = true;

      const request = {
        inventarioId: this.inventarioId,
        nome: this.novoLote.nome.trim(),
        ordem: this.novoLote.ordem || this.lotes.length + 1,
        observacoes: this.novoLote.observacoes?.trim()
      };

      if (this.editingLoteId) {
        // Atualizar lote existente
        const response = await firstValueFrom(this.loteRebanhoService.atualizar(this.editingLoteId, request));
        if (response) {
          const index = this.lotes.findIndex(l => l.id === this.editingLoteId);
          if (index !== -1) {
            this.lotes[index] = {
              id: response.id,
              inventarioId: response.inventarioId,
              nome: response.nome,
              ordem: response.ordem,
              observacoes: response.observacoes,
              dataCriacao: response.dataCriacao,
              dataAtualizacao: response.dataAtualizacao
            };
          }
          this.notificationService.success('Lote atualizado com sucesso!');
        }
      } else {
        // Criar novo lote
        const response = await firstValueFrom(this.loteRebanhoService.criar(request));
        if (response) {
          const novoLote: LoteRebanho = {
            id: response.id,
            inventarioId: response.inventarioId,
            nome: response.nome,
            ordem: response.ordem,
            observacoes: response.observacoes,
            dataCriacao: response.dataCriacao,
            dataAtualizacao: response.dataAtualizacao
          };
          this.lotes.push(novoLote);
          this.selecionarLote(novoLote);
          // Inicializar estados da aba Nutrição para o novo lote e garantir visibilidade
          await this.inicializarNutricaoParaLote(novoLote.id!);
          this.notificationService.success('Lote criado com sucesso!');
        }
      }

      this.fecharModalLote();
    } catch (error) {
      console.error('Erro ao salvar lote:', error);
      this.notificationService.error('Erro ao salvar lote. Tente novamente.');
    } finally {
      this.isSaving = false;
    }
  }

  confirmarExclusaoLote(lote: LoteRebanho): void {
    this.itemToDelete = lote;
    this.deleteType = 'lote';
    this.showDeleteConfirmModal = true;
  }

  // Header actions
  toggleHighContrast(): void {
    this.isHighContrast = !this.isHighContrast;
    document.body.classList.toggle('high-contrast', this.isHighContrast);
  }

  toggleVLibras(): void {
    this.isVLibrasActive = !this.isVLibrasActive;
    // Placeholder para integração futura do VLibras
  }

  logout(): void {
    // Redirecionar para rota de logout ou página inicial
    window.location.href = '/';
  }

  // Atualização inline do nome do lote na aba Informações Gerais
  async atualizarNomeLote(): Promise<void> {
    if (this.readonly || !this.loteAtivo?.id) return;

    const nome = (this.loteAtivo.nome || '').trim();
    if (!nome) {
      this.notificationService.error('Nome do lote é obrigatório.');
      return;
    }

    if (!this.validarNomeLote(nome)) {
      return;
    }

    try {
      this.isSaving = true;
      const response = await firstValueFrom(this.loteRebanhoService.atualizar(this.loteAtivo.id!, {
        inventarioId: this.inventarioId,
        nome,
        ordem: this.loteAtivo.ordem,
        observacoes: this.loteAtivo.observacoes
      }));

      if (response) {
        const index = this.lotes.findIndex(l => l.id === this.loteAtivo!.id);
        if (index !== -1) {
          this.lotes[index] = {
            id: response.id,
            inventarioId: response.inventarioId,
            nome: response.nome,
            ordem: response.ordem,
            observacoes: response.observacoes,
            dataCriacao: response.dataCriacao,
            dataAtualizacao: response.dataAtualizacao
          };
          this.loteAtivo = { ...this.lotes[index] };
        }
        this.notificationService.success('Nome do lote atualizado.');
      }
    } catch (error) {
      console.error('Erro ao atualizar nome do lote:', error);
      this.notificationService.error('Erro ao atualizar nome do lote.');
    } finally {
      this.isSaving = false;
    }
  }

  // Limpar campos da aba Informações Gerais (categorias)
  limparInformacoesGerais(): void {
    if (this.readonly) return;
    this.categorias = [];
    this.notificationService.info('Informações gerais do lote foram limpas.');
    this.triggerAutoSave();
  }

  // Apagar todos os lotes criados
  async limparTodosLotes(): Promise<void> {
    // fechar confirmação caso esteja aberta
    this.showClearAllConfirmModal = false;
    if (this.readonly) return;
    const hasPersisted = Array.isArray(this.lotes) && this.lotes.length > 0;
    const hasLocalState = (Array.isArray(this.novoLotesPanels) && this.novoLotesPanels.length > 0)
      || !!this.loteAtivo
      || (Array.isArray(this.categorias) && this.categorias.length > 0)
      || (Array.isArray(this.nutricao) && this.nutricao.length > 0)
      || (Array.isArray(this.manejo) && this.manejo.length > 0)
      || (this.expandedLotes && Object.keys(this.expandedLotes).length > 0)
      || (this.expandedNutriLotes && Object.keys(this.expandedNutriLotes).length > 0)
      || (this.sectionsExpandedByLoteId && Object.keys(this.sectionsExpandedByLoteId).length > 0);

    if (!hasPersisted && !hasLocalState) {
      this.notificationService.info('Não há lotes para apagar.');
      return;
    }

    try {
      this.isSaving = true;
      if (hasPersisted) {
        await firstValueFrom(this.loteRebanhoService.deletarTodosPorInventario(this.inventarioId));
      }

      // Resetar estados locais
      this.lotes = [];
      this.loteAtivo = null;
      this.categorias = [];
      this.nutricao = [];
      this.manejo = [];
      this.expandedLotes = {};
      this.novoLotesPanels = [];
      // limpar estados relacionados à Nutrição Animal (layout novo)
      this.categoriasPorLoteId = {};
      this.expandedNutriLotes = {};
      this.sectionsExpandedByLoteId = {};
      this.pastejoByLoteId = {};
      this.ingredientesByLoteId = {};
      this.concentradoByLoteId = {};
      this.aditivoByLoteId = {};
      // limpar estados de topo da aba Nutrição
      this.inserirDadosDieta = undefined as any;
      this.sistemaProducao = undefined as any;
      // limpar estados relacionados ao Manejo de Dejetos
      this.manejosPorLoteCategoria = {} as any;
      this.totalPercentualGeral = 0 as any;

      // Recarregar dados do servidor para refletir estado consistente
      await this.carregarDados();
      this.abaAtiva = 'informacoes';

      this.notificationService.success('Todos os lotes foram apagados.');
    } catch (error: any) {
      console.error('Erro ao apagar todos os lotes:', error);
      const msg = (error?.error?.message || error?.message || 'Erro ao apagar todos os lotes.');
      this.notificationService.error(msg);
    } finally {
      this.isSaving = false;
    }
  }

  // Abrir confirmação de limpeza total de lotes
  abrirConfirmLimparTodos(): void {
    if (this.readonly) return;
    this.showClearAllConfirmModal = true;
  }

  // Fechar confirmação de limpeza
  fecharConfirmLimparTodos(): void {
    this.showClearAllConfirmModal = false;
  }

  // Categorias
  abrirModalCategoria(categoria?: CategoriaLote): void {
    if (!this.loteAtivo?.id) {
      this.notificationService.error('Selecione um lote primeiro');
      return;
    }

    if (categoria) {
      this.editingCategoriaId = categoria.id || null;
      this.novaCategoria = { ...categoria };
    } else {
      this.editingCategoriaId = null;
      this.novaCategoria = {
        loteId: this.loteAtivo.id,
        quantidadeAnimais: 0,
        pesoMedio: 0,
        observacoes: ''
      };
    }
    this.showCategoriaModal = true;
  }

  fecharModalCategoria(): void {
    this.showCategoriaModal = false;
    this.editingCategoriaId = null;
    this.novaCategoria = {};
  }

  async salvarCategoria(): Promise<void> {
    if (!this.validarFormularioCategoria()) {
      return;
    }

    if (!this.loteAtivo?.id) {
      this.notificationService.error('Selecione um lote primeiro');
      return;
    }

    try {
      this.isSaving = true;

      if (this.editingCategoriaId) {
        // Atualizar categoria existente
        const categoriaAtualizada = await firstValueFrom(this.categoriaLoteService.atualizar(this.editingCategoriaId, {
          loteId: this.loteAtivo!.id!,
          quantidadeAnimais: this.novaCategoria.quantidadeAnimais!,
          pesoMedio: this.novaCategoria.pesoMedio!,
          observacoes: this.novaCategoria.observacoes?.trim() || ''
        }));

        if (categoriaAtualizada) {
          const index = this.categorias.findIndex(c => c.id === this.editingCategoriaId);
          if (index !== -1) {
            this.categorias[index] = categoriaAtualizada;
          }
          this.notificationService.success('Categoria atualizada com sucesso');
        }
      } else {
        // Criar nova categoria
        const novaCategoria = await firstValueFrom(this.categoriaLoteService.criar({
          loteId: this.loteAtivo.id,
          quantidadeAnimais: this.novaCategoria.quantidadeAnimais!,
          pesoMedio: this.novaCategoria.pesoMedio!,
          observacoes: this.novaCategoria.observacoes?.trim() || ''
        }));

        if (novaCategoria) {
          this.categorias.push(novaCategoria);
          this.notificationService.success('Categoria criada com sucesso');
        }
      }

      this.fecharModalCategoria();
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
      this.notificationService.error('Erro ao salvar categoria');
    } finally {
      this.isSaving = false;
    }
  }

  // Nutrição
  abrirModalNutricao(nutricao?: NutricaoAnimalLote): void {
    if (!this.loteAtivo?.id) {
      this.notificationService.error('Selecione um lote primeiro');
      return;
    }

    if (nutricao) {
      this.editingNutricaoId = nutricao.id || null;
      this.novaNutricao = { ...nutricao };
    } else {
      this.editingNutricaoId = null;
      this.novaNutricao = {
        loteId: this.loteAtivo.id,
        inserirDadosDieta: true,
        sistemaProducao: 'PASTO',
        tempoPastoHorasDia: undefined,
        tempoPastoDiasAno: undefined,
        observacoes: ''
      };
    }
    this.showNutricaoModal = true;
  }

  fecharModalNutricao(): void {
    this.showNutricaoModal = false;
    this.editingNutricaoId = null;
    this.novaNutricao = {};
  }

  async salvarNutricao(): Promise<void> {
    if (!this.validarFormularioNutricao()) {
      return;
    }

    if (!this.loteAtivo?.id) {
      this.notificationService.error('Selecione um lote primeiro');
      return;
    }

    try {
      this.isSaving = true;

      const payload: NutricaoAnimalLoteRequest = {
        loteId: this.loteAtivo.id,
        inserirDadosDieta: !!this.novaNutricao.inserirDadosDieta,
        sistemaProducao: this.novaNutricao.sistemaProducao,
        tempoPastoHorasDia: this.novaNutricao.tempoPastoHorasDia,
        tempoPastoDiasAno: this.novaNutricao.tempoPastoDiasAno,
        ingredientes: (this.ingredientesByLoteId[this.loteAtivo.id!] || [])
          .filter(it => (it?.ingrediente?.trim()) || it?.quantidadeKgCabDia != null || it?.ofertaDiasAno != null)
          .map(it => ({
            nomeIngrediente: (it.ingrediente || '').trim(),
            percentual: 0, // Campo adicionado para evitar null
            quantidadeKgCabDia: it.quantidadeKgCabDia || 0,
            ofertaDiasAno: it.ofertaDiasAno || 0,
            producao: it.producao || 'INTERNA'
          })),
        concentrados: (this.concentradoByLoteId[this.loteAtivo.id!] || [])
          .filter(it => (it?.proteinaBrutaPercentual != null) || (it?.ureia?.trim()) || (it?.subproduto?.trim()) || it?.quantidade != null || it?.oferta != null)
          .map(it => ({
            nomeConcentrado: `Proteína Bruta: ${it.proteinaBrutaPercentual || 0}% - Ureia: ${it.ureia || 'N/A'} - Subproduto: ${it.subproduto || 'N/A'}`,
            percentual: 0, // Campo adicionado para evitar null
            proteinaBrutaPercentual: it.proteinaBrutaPercentual || 0,
            ureia: it.ureia || '',
            subproduto: it.subproduto || '',
            quantidade: it.quantidade || 0,
            oferta: it.oferta || 0,
            quantidadeKgCabDia: 0, // Campo adicionado para evitar null
            ofertaDiasAno: 0, // Campo adicionado para evitar null
            producao: 'INTERNA' // Campo adicionado para evitar null
          })),
        aditivos: (this.aditivoByLoteId[this.loteAtivo.id!] || [])
          .filter(it => (it?.tipo?.trim()) || (it?.dose != null) || it?.percentualAdicional != null || it?.oferta != null)
          .map(it => ({
            nomeAditivo: `${it.tipo || ''} - Dose: ${it.dose || 0}`,
            percentual: 0, // Campo adicionado para evitar null
            tipo: it.tipo || '',
            dose: it.dose || 0,
            oferta: it.oferta || 0,
            percentualAdicional: it.percentualAdicional || 0,
            quantidadeKgCabDia: 0, // Campo adicionado para evitar null
            ofertaDiasAno: 0, // Campo adicionado para evitar null
            producao: 'INTERNA' // Campo adicionado para evitar null
          }))
      };

      if (this.editingNutricaoId) {
        const nutricaoAtualizada = await firstValueFrom(this.nutricaoAnimalLoteService.atualizar(this.editingNutricaoId, payload));
        if (nutricaoAtualizada) {
          const index = this.nutricao.findIndex(n => n.id === this.editingNutricaoId);
          if (index !== -1) this.nutricao[index] = nutricaoAtualizada;
          this.notificationService.success('Nutrição atualizada com sucesso');
        }
      } else {
        const criada = await firstValueFrom(this.nutricaoAnimalLoteService.criar(payload));
        if (criada) {
          this.nutricao.push(criada);
          this.notificationService.success('Nutrição criada com sucesso');
        }
      }

      this.fecharModalNutricao();
    } catch (error) {
      console.error('Erro ao salvar nutrição:', error);
      this.notificationService.error('Erro ao salvar nutrição');
    } finally {
      this.isSaving = false;
    }
  }

  // Manejo
  abrirModalManejo(manejo?: ManejoDejetosLote): void {
    if (!this.loteAtivo?.id) {
      this.notificationService.error('Selecione um lote primeiro');
      return;
    }

    if (manejo) {
      this.editingManejoId = manejo.id || null;
      this.novoManejo = { ...manejo };
    } else {
      this.editingManejoId = null;
      this.novoManejo = {
        loteId: this.loteAtivo.id,
        categoriaAnimal: '',
        tipoManejo: '',
        percentualRebanho: 0
      };
    }
    this.showManejoModal = true;
  }

  fecharModalManejo(): void {
    this.showManejoModal = false;
    this.editingManejoId = null;
    this.novoManejo = {};
  }

  async salvarManejo(): Promise<void> {
    if (!this.validarFormularioManejo()) {
      return;
    }

    if (!this.loteAtivo?.id) {
      this.notificationService.error('Selecione um lote primeiro');
      return;
    }

    try {
      this.isSaving = true;

      if (this.editingManejoId) {
        // Atualizar manejo existente
        const manejoAtualizado = await firstValueFrom(this.manejoDejetosLoteService.atualizar(this.editingManejoId, {
          loteId: this.loteAtivo!.id!,
          categoriaAnimal: this.novoManejo.categoriaAnimal!,
          tipoManejo: this.novoManejo.tipoManejo!,
          percentualRebanho: this.novoManejo.percentualRebanho!
        }));

        if (manejoAtualizado) {
          const index = this.manejo.findIndex(m => m.id === this.editingManejoId);
          if (index !== -1) {
            this.manejo[index] = manejoAtualizado;
          }
          this.notificationService.success('Manejo atualizado com sucesso');
        }
      } else {
        // Criar novo manejo
        const novoManejo = await firstValueFrom(this.manejoDejetosLoteService.criar({
          loteId: this.loteAtivo.id,
          categoriaAnimal: this.novoManejo.categoriaAnimal!,
          tipoManejo: this.novoManejo.tipoManejo!,
          percentualRebanho: this.novoManejo.percentualRebanho!
        }));

        if (novoManejo) {
          this.manejo.push(novoManejo);
          this.notificationService.success('Manejo criado com sucesso');
        }
      }

      this.fecharModalManejo();
    } catch (error) {
      console.error('Erro ao salvar manejo:', error);
      this.notificationService.error('Erro ao salvar manejo');
    } finally {
      this.isSaving = false;
    }
  }

  // Modal de confirmação de exclusão
  fecharModalConfirmacao(): void {
    this.showDeleteConfirmModal = false;
    this.itemToDelete = null;
    this.deleteType = null;
  }

  async confirmarExclusao(): Promise<void> {
    if (!this.itemToDelete || !this.deleteType) return;

    try {
      this.isSaving = true;

      switch (this.deleteType) {
        case 'lote':
          await firstValueFrom(this.loteRebanhoService.deletar(this.itemToDelete.id));
          this.lotes = this.lotes.filter(l => l.id !== this.itemToDelete.id);
          if (this.loteAtivo?.id === this.itemToDelete.id) {
            this.loteAtivo = this.lotes.length > 0 ? this.lotes[0] : null;
            if (this.loteAtivo?.id) {
              this.carregarDadosLote(this.loteAtivo.id);
            }
          }
          this.notificationService.success('Lote excluído com sucesso');
          break;

        case 'categoria':
          await firstValueFrom(this.categoriaLoteService.deletar(this.itemToDelete.id));
          this.categorias = this.categorias.filter(c => c.id !== this.itemToDelete.id);
          this.notificationService.success('Categoria excluída com sucesso');
          break;

        case 'nutricao':
          await firstValueFrom(this.nutricaoAnimalLoteService.deletar(this.itemToDelete.id));
          this.nutricao = this.nutricao.filter(n => n.id !== this.itemToDelete.id);
          this.notificationService.success('Nutrição excluída com sucesso');
          break;

        case 'manejo':
          await firstValueFrom(this.manejoDejetosLoteService.deletar(this.itemToDelete.id));
          this.manejo = this.manejo.filter(m => m.id !== this.itemToDelete.id);
          this.notificationService.success('Manejo excluído com sucesso');
          break;
      }

      this.fecharModalConfirmacao();
    } catch (error) {
      console.error('Erro ao excluir item:', error);
      this.notificationService.error('Erro ao excluir item');
    } finally {
      this.isSaving = false;
    }
  }

  // Sistema de salvamento automático
  private triggerAutoSave(): void {
    this.autoSave$.next();
  }

  private async salvarRascunho(): Promise<void> {
    if (!this.loteAtivo) return;

    try {
      this.isSaving = true;
      
      // Simular delay para mostrar indicador de salvamento
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Log dos dados locais para debug
      console.log('Salvando rascunho:', {
        loteAtivo: this.loteAtivo,
        categorias: this.categorias,
        nutricao: this.nutricao,
        manejo: this.manejo
      });

      // TODO: Implementar salvamento real de categorias, nutrição e manejo
      // quando os serviços estiverem disponíveis
      
    } catch (error) {
      console.error('Erro ao salvar rascunho:', error);
    } finally {
      this.isSaving = false;
    }
  }

  // Conclusão da fase
  async concluirFase(): Promise<void> {
    if (!this.loteAtivo) {
      this.notificationService.error('Selecione um lote para concluir a fase');
      return;
    }

    if (this.lotes.length === 0) {
      this.notificationService.error('Adicione pelo menos um lote para concluir a fase');
      return;
    }

    // Validação de categorias considerando todas as fontes de estado (persistidas e em edição)
    const hasCategoriaPersistida = Object.values(this.categoriasPorLoteId || {}).some(arr => Array.isArray(arr) && arr.length > 0);
    const hasCategoriaAtual = Array.isArray(this.categorias) && this.categorias.length > 0;
    const hasCategoriaEmEdicao = Object.values(this.loteFormRowsById || {}).some((rows: any[]) =>
      Array.isArray(rows) && rows.some(r =>
        r?.categoriaCorteId != null ||
        r?.animaisFazenda != null ||
        r?.pesoMedioVivo != null ||
        r?.animaisComprados != null ||
        r?.pesoMedioComprados != null ||
        r?.animaisVendidos != null ||
        r?.pesoMedioVendidos != null ||
        r?.permanenciaMeses != null ||
        r?.idadeDesmame != null
      )
    );
    const hasCategoriaNosPainelsNovos = Array.isArray(this.novoLotesPanels) && this.novoLotesPanels.some(p =>
      Array.isArray(p?.categoriasRows) && p.categoriasRows.some(r =>
        r?.categoriaCorteId != null ||
        r?.animaisFazenda != null ||
        r?.pesoMedioVivo != null ||
        r?.animaisComprados != null ||
        r?.pesoMedioComprados != null ||
        r?.animaisVendidos != null ||
        r?.pesoMedioVendidos != null ||
        r?.permanenciaMeses != null ||
        r?.idadeDesmame != null
      )
    );

    const hasCategoria = hasCategoriaPersistida || hasCategoriaAtual || hasCategoriaEmEdicao || hasCategoriaNosPainelsNovos;
    if (!hasCategoria) {
      this.notificationService.error('Adicione pelo menos uma categoria para concluir a fase');
      return;
    }

    try {
      this.isSaving = true;
      
      // Salvar dados finais
      await this.salvarRascunho();
      
      this.notificationService.success('Fase de rebanho concluída com sucesso');
      this.faseConcluida.emit();
    } catch (error) {
      console.error('Erro ao concluir fase:', error);
      this.notificationService.error('Erro ao concluir fase');
    } finally {
      this.isSaving = false;
    }
  }

  // Métodos de validação para lotes
  validarNomeLote(nome: string): boolean {
    if (!nome || nome.trim().length === 0) {
      this.notificationService.error('Nome do lote é obrigatório');
      return false;
    }
    
    if (nome.trim().length < 3) {
      this.notificationService.error('Nome do lote deve ter pelo menos 3 caracteres');
      return false;
    }
    
    if (nome.trim().length > 100) {
      this.notificationService.error('Nome do lote deve ter no máximo 100 caracteres');
      return false;
    }
    
    return true;
  }

  validarQuantidadeAnimais(quantidade: number): boolean {
    if (!quantidade || quantidade <= 0) {
      this.notificationService.error('Quantidade de animais deve ser maior que zero');
      return false;
    }
    
    if (quantidade > 100000) {
      this.notificationService.error('Quantidade de animais não pode exceder 100.000');
      return false;
    }
    
    if (!Number.isInteger(quantidade)) {
      this.notificationService.error('Quantidade de animais deve ser um número inteiro');
      return false;
    }
    
    return true;
  }

  validarPesoMedio(peso: number): boolean {
    if (!peso || peso <= 0) {
      this.notificationService.error('Peso médio deve ser maior que zero');
      return false;
    }
    
    if (peso > 2000) {
      this.notificationService.error('Peso médio não pode exceder 2000 kg');
      return false;
    }
    
    if (peso < 10) {
      this.notificationService.error('Peso médio deve ser pelo menos 10 kg');
      return false;
    }
    
    return true;
  }

  validarIdadeMedia(idade: number): boolean {
    if (!idade || idade <= 0) {
      this.notificationService.error('Idade média deve ser maior que zero');
      return false;
    }
    
    if (idade > 30) {
      this.notificationService.error('Idade média não pode exceder 30 anos');
      return false;
    }
    
    return true;
  }

  validarFormularioLote(): boolean {
    if (!this.novoLote.nome) {
      this.notificationService.error('Nome do lote é obrigatório');
      return false;
    }
    
    return this.validarNomeLote(this.novoLote.nome);
  }

  adicionarLote(): void {
    const nome = prompt('Digite o nome do novo lote:');
    if (!nome) return;

    if (!this.validarNomeLote(nome)) {
      return;
    }

    const novoLote: Partial<LoteRebanho> = {
      inventarioId: this.inventarioId,
      nome: nome.trim(),
      ordem: this.lotes.length + 1,
      observacoes: ''
    };

    this.loteRebanhoService.criar({
      inventarioId: novoLote.inventarioId!,
      nome: novoLote.nome!,
      ordem: novoLote.ordem!,
      observacoes: novoLote.observacoes || ''
    }).subscribe({
      next: (lote) => {
        this.lotes.push({
          id: lote.id,
          inventarioId: lote.inventarioId,
          nome: lote.nome,
          ordem: lote.ordem,
          observacoes: lote.observacoes,
          dataCriacao: lote.dataCriacao,
          dataAtualizacao: lote.dataAtualizacao
        });
        this.notificationService.success('Lote adicionado com sucesso');
        
        // Selecionar o novo lote
        if (lote.id) {
          this.selecionarLote(this.lotes[this.lotes.length - 1]);
        }
      },
      error: (error) => {
        console.error('Erro ao adicionar lote:', error);
        this.notificationService.error('Erro ao adicionar lote');
      }
    });
  }

  adicionarCategoria(): void {
    if (!this.validarFormularioCategoria()) {
      return;
    }

    if (!this.loteAtivo?.id) {
      this.notificationService.error('Selecione um lote primeiro');
      return;
    }

    const novaCategoria: CategoriaLoteRequest = {
      loteId: this.loteAtivo.id,
      quantidadeAnimais: this.novaCategoria.quantidadeAnimais!,
      pesoMedio: this.novaCategoria.pesoMedio!,
      observacoes: this.novaCategoria.observacoes?.trim() || ''
    };

    this.isSaving = true;
    this.categoriaLoteService.criar(novaCategoria).subscribe({
      next: (categoria) => {
        this.categorias.push(categoria);
        this.novaCategoria = {};
        this.notificationService.success('Categoria adicionada com sucesso');
        this.isSaving = false;
      },
      error: (error) => {
        console.error('Erro ao adicionar categoria:', error);
        this.notificationService.error('Erro ao adicionar categoria');
        this.isSaving = false;
      }
    });
  }

  adicionarNutricao(): void {
    if (!this.validarFormularioNutricao()) {
      return;
    }

    if (!this.loteAtivo?.id) {
      this.notificationService.error('Selecione um lote primeiro');
      return;
    }

    const novaNutricao: NutricaoAnimalLoteRequest = {
      loteId: this.loteAtivo.id,
      inserirDadosDieta: !!this.novaNutricao.inserirDadosDieta,
      sistemaProducao: this.novaNutricao.sistemaProducao,
      tempoPastoHorasDia: this.novaNutricao.tempoPastoHorasDia,
      tempoPastoDiasAno: this.novaNutricao.tempoPastoDiasAno
    };

    this.isSaving = true;
    this.nutricaoAnimalLoteService.criar(novaNutricao).subscribe({
      next: (nutricao) => {
        this.nutricao.push(nutricao);
        this.novaNutricao = {};
        this.notificationService.success('Dados de nutrição adicionados com sucesso');
        this.isSaving = false;
      },
      error: (error) => {
        console.error('Erro ao adicionar nutrição:', error);
        this.notificationService.error('Erro ao adicionar nutrição');
        this.isSaving = false;
      }
    });
  }

  adicionarManejo(): void {
    if (!this.validarFormularioManejo()) {
      return;
    }

    if (!this.loteAtivo?.id) {
      this.notificationService.error('Selecione um lote primeiro');
      return;
    }

    const novoManejo: ManejoDejetosLoteRequest = {
      loteId: this.loteAtivo.id,
      categoriaAnimal: this.novoManejo.categoriaAnimal!,
      tipoManejo: this.novoManejo.tipoManejo!,
      percentualRebanho: this.novoManejo.percentualRebanho!
    };

    this.isSaving = true;
    this.manejoDejetosLoteService.criar(novoManejo).subscribe({
      next: (manejo) => {
        this.manejo.push(manejo);
        this.novoManejo = {};
        this.notificationService.success('Manejo adicionado com sucesso');
        this.isSaving = false;
      },
      error: (error) => {
        console.error('Erro ao adicionar manejo:', error);
        this.notificationService.error('Erro ao adicionar manejo');
        this.isSaving = false;
      }
    });
  }

  validarFormularioCategoria(): boolean {
    if (!this.novaCategoria.quantidadeAnimais || this.novaCategoria.quantidadeAnimais <= 0) {
      this.notificationService.error('Quantidade de animais é obrigatória e deve ser maior que zero');
      return false;
    }

    if (!this.novaCategoria.pesoMedio || this.novaCategoria.pesoMedio <= 0) {
      this.notificationService.error('Peso médio é obrigatório e deve ser maior que zero');
      return false;
    }

    if (!this.validarQuantidadeAnimais(this.novaCategoria.quantidadeAnimais)) {
      return false;
    }

    if (!this.validarPesoMedio(this.novaCategoria.pesoMedio)) {
      return false;
    }

    return true;
  }

  // Validações de navegação entre abas
  canIrParaNutricao(): boolean {
    console.debug('[canIrParaNutricao] Iniciando validação');
    
    // 1) Considerar painéis inline (não persistidos) diretamente do front
    if (Array.isArray(this.novoLotesPanels) && this.novoLotesPanels.length > 0) {
      for (const p of this.novoLotesPanels) {
        const nomeOk = ((p?.novoLote?.nome || '').trim().length >= 3);
        const rows = p?.categoriasRows || [];
        console.debug(`[canIrParaNutricao] Panel - Nome: "${p?.novoLote?.nome}", nomeOk: ${nomeOk}, rows: ${rows.length}`);
        
        const isRowCompleteInline = (r: any) => {
          // Campos obrigatórios: categoria, animais fazenda, peso médio vivo, permanência
          const camposObrigatorios = (
            r?.categoriaCorteId != null &&
            r?.animaisFazenda != null &&
            r?.pesoMedioVivo != null &&
            r?.permanenciaMeses != null
          );
          
          // Campos opcionais: validar apenas se animais comprados/vendidos > 0
        const camposOpcionais = (
          r?.animaisComprados != null &&
          ((r?.animaisComprados || 0) === 0 || r?.pesoMedioComprados != null) &&
          r?.animaisVendidos != null &&
          ((r?.animaisVendidos || 0) === 0 || r?.pesoMedioVendidos != null)
        );
          
          // Para bezerros, idade desmame é obrigatória
          const idadeDesmamaOk = this.isCategoriaBezerroById(r?.categoriaCorteId) ? r?.idadeDesmame != null : true;
          
          const complete = camposObrigatorios && camposOpcionais && idadeDesmamaOk;
          
          console.debug(`[canIrParaNutricao] Panel row validation:`, {
            categoriaCorteId: r?.categoriaCorteId,
            animaisFazenda: r?.animaisFazenda,
            pesoMedioVivo: r?.pesoMedioVivo,
            animaisComprados: r?.animaisComprados,
            pesoMedioComprados: r?.pesoMedioComprados,
            animaisVendidos: r?.animaisVendidos,
            pesoMedioVendidos: r?.pesoMedioVendidos,
            permanenciaMeses: r?.permanenciaMeses,
            idadeDesmame: r?.idadeDesmame,
            isBezerro: this.isCategoriaBezerroById(r?.categoriaCorteId),
            camposObrigatorios,
            camposOpcionais,
            idadeDesmamaOk,
            complete
          });
          return complete;
        };
        
        if (nomeOk && rows.length > 0 && rows.some(isRowCompleteInline)) {
          console.debug('[canIrParaNutricao] Panel válido encontrado, retornando true');
          return true;
        }
      }
    }

    // 2) Considerar lotes já existentes com dados preenchidos no front
    if (!Array.isArray(this.lotes) || this.lotes.length === 0) {
      console.debug('[canIrParaNutricao] Nenhum lote existente, retornando false');
      return false;
    }
    
    for (const lote of this.lotes) {
      if (!lote?.id || !lote.nome || lote.nome.trim().length < 3) {
        console.debug(`[canIrParaNutricao] Lote ${lote?.id} inválido - nome: "${lote?.nome}"`);
        continue;
      }
      
      const categorias = this.categoriasPorLoteId[lote.id] || [];
      if (!categorias.length) {
        console.debug(`[canIrParaNutricao] Lote ${lote.id} sem categorias`);
        continue;
      }
      
      // Tentar validar pelos rows do formulário se disponíveis; caso contrário, usar categorias carregadas
      const rows = this.loteFormRowsById[lote.id] || [];
      console.debug(`[canIrParaNutricao] Lote ${lote.id} - rows: ${rows.length}, categorias: ${categorias.length}`);
      
      const isRowComplete = (r: any) => {
        // Campos obrigatórios: categoria, animais fazenda, peso médio vivo, permanência
        const camposObrigatorios = (
          r?.categoriaCorteId != null &&
          r?.animaisFazenda != null &&
          r?.pesoMedioVivo != null &&
          r?.permanenciaMeses != null
        );
        
        // Campos opcionais: validar apenas se animais comprados/vendidos > 0
        const camposOpcionais = (
          r?.animaisComprados != null &&
          ((r?.animaisComprados || 0) === 0 || r?.pesoMedioComprados != null) &&
          r?.animaisVendidos != null &&
          ((r?.animaisVendidos || 0) === 0 || r?.pesoMedioVendidos != null)
        );
        
        // Para bezerros, idade desmame é obrigatória
        const idadeDesmamaOk = this.isCategoriaBezerroById(r?.categoriaCorteId) ? r?.idadeDesmame != null : true;
        
        const complete = camposObrigatorios && camposOpcionais && idadeDesmamaOk;
        
        console.debug(`[canIrParaNutricao] Lote ${lote.id} row validation:`, {
          categoriaCorteId: r?.categoriaCorteId,
          animaisFazenda: r?.animaisFazenda,
          pesoMedioVivo: r?.pesoMedioVivo,
          animaisComprados: r?.animaisComprados,
          pesoMedioComprados: r?.pesoMedioComprados,
          animaisVendidos: r?.animaisVendidos,
          pesoMedioVendidos: r?.pesoMedioVendidos,
          permanenciaMeses: r?.permanenciaMeses,
          idadeDesmame: r?.idadeDesmame,
          isBezerro: this.isCategoriaBezerroById(r?.categoriaCorteId),
          camposObrigatorios,
          camposOpcionais,
          idadeDesmamaOk,
          complete
        });
        return complete;
      };
      
      let completo = false;
      if (rows.length) {
        completo = rows.some(isRowComplete);
        console.debug(`[canIrParaNutricao] Lote ${lote.id} validação por rows: ${completo}`);
      } else {
        completo = categorias.some((c: any) => {
          // Campos obrigatórios: categoria, quantidade animais, peso médio, permanência
          const camposObrigatorios = (
            c?.categoriaCorteId != null &&
            c?.quantidadeAnimais != null &&
            (c as any)?.pesoMedio != null &&
            (c as any)?.permanenciaMeses != null
          );
          
          // Campos opcionais: validar apenas se animais comprados/vendidos > 0
          const camposOpcionais = (
            (c as any)?.animaisComprados != null &&
            (((c as any)?.animaisComprados || 0) === 0 || (c as any)?.pesoMedioComprados != null) &&
            (c as any)?.animaisVendidos != null &&
            (((c as any)?.animaisVendidos || 0) === 0 || (c as any)?.pesoMedioVendidos != null)
          );
          
          // Para bezerros, idade desmame é obrigatória
          const idadeDesmamaOk = this.isCategoriaBezerroById(c?.categoriaCorteId) ? (c as any)?.idadeDesmame != null : true;
          
          const complete = camposObrigatorios && camposOpcionais && idadeDesmamaOk;
          
          console.debug(`[canIrParaNutricao] Lote ${lote.id} categoria validation:`, {
            categoriaCorteId: c?.categoriaCorteId,
            quantidadeAnimais: c?.quantidadeAnimais,
            pesoMedio: (c as any)?.pesoMedio,
            animaisComprados: (c as any)?.animaisComprados,
            pesoMedioComprados: (c as any)?.pesoMedioComprados,
            animaisVendidos: (c as any)?.animaisVendidos,
            pesoMedioVendidos: (c as any)?.pesoMedioVendidos,
            permanenciaMeses: (c as any)?.permanenciaMeses,
            idadeDesmame: (c as any)?.idadeDesmame,
            isBezerro: this.isCategoriaBezerroById(c?.categoriaCorteId),
            camposObrigatorios,
            camposOpcionais,
            idadeDesmamaOk,
            complete
          });
          return complete;
        });
        console.debug(`[canIrParaNutricao] Lote ${lote.id} validação por categorias: ${completo}`);
      }
      
      if (completo) {
        console.debug(`[canIrParaNutricao] Lote ${lote.id} válido encontrado, retornando true`);
        return true;
      }
    }
    
    console.debug('[canIrParaNutricao] Nenhum lote válido encontrado, retornando false');
    return false;
  }

  canIrParaNutricaoManual(): boolean {
    // Validação específica para a aba de nutrição manual
    
    // 1. Campo "Inserir dados da dieta" deve estar preenchido
    if (!this.inserirDadosDieta) {
      return false;
    }
    
    // 2. Se "Dados da dieta" = "Não", apenas isso é suficiente
    if (this.inserirDadosDieta === 'Não') {
      return true;
    }
    
    // 3. Se "Dados da dieta" = "Sim", deve preencher sistema de produção e todos os campos dos lotes
    if (this.inserirDadosDieta === 'Sim') {
      if (!this.sistemaProducao) {
        return false;
      }
      
      // Validar se todos os campos dos lotes estão preenchidos
      if (!Array.isArray(this.lotes) || this.lotes.length === 0) return false;
      
      for (const lote of this.lotes) {
        if (!lote?.id) continue;
        const categorias = this.categoriasPorLoteId[lote.id] || [];
        if (!categorias.length) continue;
        
        const pastejo = this.pastejoByLoteId[lote.id] || [];
        const ing = this.ingredientesByLoteId[lote.id] || [];
        const conc = this.concentradoByLoteId[lote.id] || [];
        const adit = this.aditivoByLoteId[lote.id] || [];
        
        const allComplete = categorias.length > 0 && categorias.every((_, i) => {
          const p = pastejo[i] || {};
          const ii = ing[i] || {};
          const cc = conc[i] || {};
          const aa = adit[i] || {};
          
          // Pastejo só é obrigatório se o sistema de produção for SEMI_CONFINADO
          const pastejoOk = this.sistemaProducao !== 'SEMI_CONFINADO' || (p?.horasPorDia != null && p?.diasPorAno != null);
          const ingOk = !!(ii?.ingrediente || '').trim() && ii?.quantidadeKgCabDia != null && ii?.ofertaDiasAno != null && ii?.producao != null;
          const concOk = (cc?.proteinaBrutaPercentual != null || (cc?.ureia?.trim()) || (cc?.subproduto?.trim())) && cc?.quantidade != null && cc?.oferta != null;
          const aditOk = (aa?.tipo?.trim() || aa?.dose != null || aa?.percentualAdicional != null) && aa?.oferta != null;
          
          return pastejoOk && ingOk && concOk && aditOk;
        });
        
        if (!allComplete) return false;
      }
      
      return true;
    }
    
    return false;
  }

  canIrParaManejo(): boolean {
    // Verificar se "Inserir dados da dieta" está preenchido
    if (!this.inserirDadosDieta) return false;
    
    // Se "Inserir dados da dieta = Não", permitir avanço
    if (this.inserirDadosDieta === 'Não') return true;
    
    // Se "Inserir dados da dieta = Sim", verificar se sistema de produção está preenchido
    if (this.inserirDadosDieta === 'Sim' && !this.sistemaProducao) return false;
    
    // Se "Inserir dados da dieta = Sim", verificar se todos os campos dos lotes estão preenchidos
    if (this.inserirDadosDieta === 'Sim') {
      if (!Array.isArray(this.lotes) || this.lotes.length === 0) return false;
      for (const lote of this.lotes) {
        if (!lote?.id) continue;
        const categorias = this.categoriasPorLoteId[lote.id] || [];
        if (!categorias.length) continue;
        const pastejo = this.pastejoByLoteId[lote.id] || [];
        const ing = this.ingredientesByLoteId[lote.id] || [];
        const conc = this.concentradoByLoteId[lote.id] || [];
        const adit = this.aditivoByLoteId[lote.id] || [];
        const allComplete = categorias.length > 0 && categorias.every((_, i) => {
          const p = pastejo[i] || {};
          const ii = ing[i] || {};
          const cc = conc[i] || {};
          const aa = adit[i] || {};
          const pastejoOk = p?.horasPorDia != null && p?.diasPorAno != null;
          const ingOk = !!(ii?.ingrediente || '').trim() && ii?.quantidadeKgCabDia != null && ii?.ofertaDiasAno != null && ii?.producao != null;
          const concOk = (cc?.proteinaBrutaPercentual != null || (cc?.ureia?.trim()) || (cc?.subproduto?.trim())) && cc?.quantidade != null && cc?.oferta != null;
          const aditOk = (aa?.tipo?.trim() || aa?.dose != null || aa?.percentualAdicional != null) && aa?.oferta != null;
          return pastejoOk && ingOk && concOk && aditOk;
        });
        if (!allComplete) return false;
      }
    }
    
    return true;
  }

  validarFormularioNutricao(): boolean {
    // Se optar por inserir dados da dieta, validar campos básicos
    const inserir = !!this.novaNutricao.inserirDadosDieta;
    if (inserir) {
      if (!this.novaNutricao.sistemaProducao) {
        this.notificationService.error('Sistema de produção é obrigatório');
        return false;
      }
      if (this.novaNutricao.tempoPastoHorasDia !== undefined && this.novaNutricao.tempoPastoHorasDia! < 0) {
        this.notificationService.error('Tempo a pasto (h/d) deve ser positivo');
        return false;
      }
      if (this.novaNutricao.tempoPastoDiasAno !== undefined && this.novaNutricao.tempoPastoDiasAno! < 0) {
        this.notificationService.error('Tempo a pasto (d/ano) deve ser positivo');
        return false;
      }
    }
    return true;
  }

  validarFormularioManejo(): boolean {
    if (!this.novoManejo.categoriaAnimal || this.novoManejo.categoriaAnimal.trim().length === 0) {
      this.notificationService.error('Categoria animal é obrigatória');
      return false;
    }

    if (!this.novoManejo.tipoManejo || this.novoManejo.tipoManejo.trim().length === 0) {
      this.notificationService.error('Tipo de manejo é obrigatório');
      return false;
    }

    if (!this.novoManejo.percentualRebanho || this.novoManejo.percentualRebanho <= 0 || this.novoManejo.percentualRebanho > 100) {
      this.notificationService.error('Percentual do rebanho deve estar entre 1 e 100');
      return false;
    }

    return true;
  }

  // Mantido para compatibilidade, não utilizado no novo layout
  getTipoAlimentoLabel(tipo: string): string { return tipo; }

  getCategoriaAnimalLabel(categoria: string): string {
    const item = this.categoriasAnimaisOpcoes.find(c => c.value === categoria);
    return item ? item.label : categoria;
  }

  private atualizarOpcoesPorTipo(): void {
    const tipo = (this.tipoRebanho || '').toUpperCase();
    
    console.log('DEBUG - atualizarOpcoesPorTipo:', {
      tipoRebanhoOriginal: this.tipoRebanho,
      tipoUpperCase: tipo,
      categoriasAnimaisLeite: this.categoriasAnimaisLeite,
      categoriasAnimaisCorte: this.categoriasAnimaisCorte
    });

    // Opções do select de categorias animais (modal de manejo)
    if (tipo === 'LEITE') {
      this.categoriasAnimaisOpcoes = this.categoriasAnimaisLeite;
      console.log('DEBUG - Definindo opções para LEITE:', this.categoriasAnimaisOpcoes);
    } else if (tipo === 'CORTE') {
      this.categoriasAnimaisOpcoes = this.categoriasAnimaisCorte;
      console.log('DEBUG - Definindo opções para CORTE:', this.categoriasAnimaisOpcoes);
    } else {
      // fallback
      this.categoriasAnimaisOpcoes = this.categoriasAnimaisCorte;
      console.log('DEBUG - Usando fallback (CORTE):', this.categoriasAnimaisOpcoes);
    }

    // Filtra categorias de corte a exibir nos dropdowns dos lotes com rótulos fixos
    console.log('DEBUG - categoriasCorte disponíveis:', this.categoriasCorte);
    console.log('DEBUG - categoriasCorte detalhadas:', this.categoriasCorte.map(c => ({ id: c.id, categoria: c.categoria, idade: c.idade })));
    if (this.categoriasCorte && this.categoriasCorte.length) {
      const pickFirst = (predicate: (c: CategoriaCorte) => boolean): CategoriaCorte | undefined => {
        return this.categoriasCorte.find(predicate);
      };
      // Empurra o primeiro item que casar e sobrescreve o rótulo para o nome fixo
      const pushFixed = (arr: CategoriaCorte[], predicate: (c: CategoriaCorte) => boolean, fixedLabel: string): void => {
        const item = pickFirst(predicate);
        console.log(`DEBUG - Procurando por "${fixedLabel}":`, item);
        if (item) arr.push({ ...item, categoria: fixedLabel });
      };

      const result: CategoriaCorte[] = [];
      const nome = (s: string | undefined) => (s || '').toLowerCase();
      const isVacaLeiteira = (c: CategoriaCorte) => {
        const n = nome(c.categoria);
        return n.includes('vaca') && (n.includes('leite') || n.includes('lact') || n.includes('ordenh'));
      };
      const isVacaSeca = (c: CategoriaCorte) => {
        const n = nome(c.categoria);
        return n.includes('vaca') && (n.includes('seca') || n.includes('nao lact') || n.includes('não lact'));
      };
      const isConfinado = (c: CategoriaCorte) => nome(c.categoria).includes('confin');

      if (tipo === 'LEITE') {
        console.log('DEBUG - Filtrando categorias para LEITE');
        // Bezerro, Novilha, Vaca leiteira, Vaca seca, Touro
        pushFixed(result, c => nome(c.categoria).includes('bezerro') || nome(c.categoria).includes('bezerra'), 'Bezerro');
        pushFixed(result, c => nome(c.categoria).includes('novilha') && !isConfinado(c), 'Novilha');
        // Para "Vaca leiteira", usar a categoria "Vaca" (não confinada)
        pushFixed(result, c => nome(c.categoria) === 'vaca' && !isConfinado(c), 'Vaca leiteira');
        // Para "Vaca seca", usar a categoria "Vaca confinada" como alternativa
        pushFixed(result, c => nome(c.categoria).includes('vaca') && isConfinado(c), 'Vaca seca');
        pushFixed(result, c => nome(c.categoria).includes('touro'), 'Touro');
      } else {
        // CORTE: Bezerro, Novilho, Novilha, Boi, Vaca, Boi confinado, Vaca confinada, Touro
        pushFixed(result, c => nome(c.categoria).includes('bezerro') || nome(c.categoria).includes('bezerra'), 'Bezerro');
        pushFixed(result, c => nome(c.categoria).includes('novilho'), 'Novilho');
        pushFixed(result, c => nome(c.categoria).includes('novilha'), 'Novilha');
        pushFixed(result, c => nome(c.categoria).includes('boi') && !isConfinado(c), 'Boi');
        pushFixed(result, c => nome(c.categoria).includes('vaca') && !isVacaLeiteira(c) && !isVacaSeca(c) && !isConfinado(c), 'Vaca');
        pushFixed(result, c => nome(c.categoria).includes('boi') && isConfinado(c), 'Boi confinado');
        pushFixed(result, c => nome(c.categoria).includes('vaca') && isConfinado(c), 'Vaca confinada');
        pushFixed(result, c => nome(c.categoria).includes('touro'), 'Touro');
      }

      // Remover duplicados por id, garantir apenas as opções mapeadas
      const unique: CategoriaCorte[] = [];
      const ids = new Set<number>();
      for (const item of result) {
        if (item?.id != null && !ids.has(item.id)) {
          unique.push(item);
          ids.add(item.id);
        }
      }
      this.categoriasCorteFiltradas = unique;
    } else {
      this.categoriasCorteFiltradas = [];
    }
  }
  
  // ===== Modal lateral: Distribuição por CAR (mock) =====
  showCarDistribuicaoModal = false;
  carDistribContext: any = null; // { loteNome, categoriaLabel, animaisComprados, pesoMedioComprados }
  carDistribItens: Array<{ id: number; carNumero: string; animais: number; status?: 'valid'|'invalid'|'neutral' }> = [];

  abrirCarDistribuicao(loteRef: any, row: any): void {
    if (!row) { return; }
    const loteNome = (loteRef?.nome || this.loteAtivo?.nome || '');
    const categoriaLabel = this.getCategoriaCorteLabel(row.categoriaCorteId);
    const animaisComprados = Number(row.animaisComprados || 0);
    const pesoMedioComprados = Number(row.pesoMedioComprados || 0);
    if (animaisComprados <= 0 || pesoMedioComprados <= 0) { return; }

    this.carDistribContext = { loteNome, categoriaLabel, animaisComprados, pesoMedioComprados };

    // Inicializar com apenas um CAR por padrão
    this.carDistribItens = [
      { id: 1, carNumero: '', animais: animaisComprados, status: 'neutral' }
    ];

    this.showCarDistribuicaoModal = true;
  }

  fecharCarDistribuicao(): void {
    this.showCarDistribuicaoModal = false;
    this.carDistribContext = null;
    this.carDistribItens = [];
  }

  adicionarCarItem(): void {
    const novoId = (this.carDistribItens.length ? Math.max(...this.carDistribItens.map(i => i.id)) + 1 : 1);
    this.carDistribItens.push({ id: novoId, carNumero: '', animais: 0, status: 'neutral' });
  }

  removerCarItem(itemId: number): void {
    if (!Array.isArray(this.carDistribItens)) return;
    if (this.carDistribItens.length <= 1) return; // sempre manter ao menos um CAR
    this.carDistribItens = this.carDistribItens.filter(it => it.id !== itemId);
  }

  validarCarNumeroMock(item: { carNumero: string; status?: any }): void {
    if (!item) return;
    if (item.carNumero === 'UF-1302405-E6D3.395B.6D27.4F42.AE22.DD56.987C.DD52') item.status = 'valid';
    else if (item.carNumero === 'SP-1234567-E6D3.395B.6D27.4F42.AE22.DD56.987C.DD52') item.status = 'invalid';
    else item.status = 'neutral';
  }

  formatCarDistribuicao(event: any, item: any): void {
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
      
      item.carNumero = formatted;
      event.target.value = formatted;
      
      // Valida o CAR automaticamente após formatação
      this.validarCarNumeroMock(item);
    } else {
      item.carNumero = '';
      item.status = 'neutral';
    }
  }

  get somaAnimaisNosCARs(): number {
    return (this.carDistribItens || []).reduce((acc, it) => acc + Number(it.animais || 0), 0);
  }

  get somaIgualAoTotal(): boolean {
    const total = Number(this.carDistribContext?.animaisComprados || 0);
    return this.somaAnimaisNosCARs === total;
  }

  // ===== Confirmação de salvamento (mock) =====
  showCarConfirmSaveModal = false;
  abrirConfirmSalvarCarDistribuicao(): void {
    if (!this.somaIgualAoTotal) return; // não permitir abrir se inválido
    this.showCarConfirmSaveModal = true;
  }
  fecharCarConfirmSaveModal(): void {
    this.showCarConfirmSaveModal = false;
  }
  confirmarSalvarCars(): void {
    // Mock: apenas fecha os modais e exibe sucesso
    this.showCarConfirmSaveModal = false;
    this.showCarDistribuicaoModal = false;
    try {
      this.notificationService.success('Distribuição por CAR confirmada (mock).');
    } catch {}
  }

  getTipoManejoLabel(tipo: string): string {
    const item = this.tiposManejo.find(t => t.value === tipo);
    return item ? item.label : tipo;
  }
  private carregarTiposManejo(): void {
    this.manejoDejetosLoteService.listarTipos().subscribe({
      next: (lista: string[]) => {
        // Converter lista simples em {value,label}
        this.tiposManejoOpcoes = (lista || []).map((v: string) => ({ value: v, label: v }));
        // Fallback: se não vier nada da API, usar constantes existentes
        if (this.tiposManejoOpcoes.length === 0) {
          this.tiposManejoOpcoes = this.tiposManejo;
        }
      },
      error: () => {
        this.tiposManejoOpcoes = this.tiposManejo;
      }
    });
  }

  // Quando a categoria muda para Bezerro/Bezerra, zerar idade de desmame
  onCategoriaCorteChange(row: any): void {
    if (!row) return;
    if (this.isCategoriaBezerroById(row?.categoriaCorteId)) {
      row.idadeDesmame = 0;
    }
  }

  // Quando animais comprados for 0, limpar peso médio comprados
  onAnimaisCompradosChange(row: any): void {
    if (!row) return;
    if ((row.animaisComprados || 0) === 0) {
      row.pesoMedioComprados = null;
    }
  }

  // Quando animais vendidos for 0, limpar peso médio vendidos
  onAnimaisVendidosChange(row: any): void {
    if (!row) return;
    
    // Limpar peso médio se animais vendidos for zero
    if ((row.animaisVendidos || 0) === 0) {
      row.pesoMedioVendidos = null;
    }
  }

  isCategoriaBezerroById(id?: number): boolean {
    const label = (this.getCategoriaCorteLabelById(id) || '').toLowerCase();
    return label.includes('bezerro') || label.includes('bezerra');
  }

  // Função para verificar se deve mostrar a coluna de idade de desmame
  shouldShowIdadeDesmamelColumn(rows: any[]): boolean {
    if (!rows || rows.length === 0) return false;
    return rows.some(row => this.isCategoriaBezerroById(row?.categoriaCorteId));
  }

  // Funções para remoção individual de categoria
  confirmarRemocaoCategoria(loteId: number, rowIndex: number): void {
    // Validar se há pelo menos 2 categorias antes de permitir remoção
    const categorias = this.loteFormRowsById[loteId];
    if (categorias && categorias.length <= 1) {
      this.notificationService.warning('Não é possível remover a categoria. Deve haver pelo menos uma categoria por lote.');
      return;
    }
    
    this.remocaoCategoriaContext = { loteId, rowIndex, isNovoLote: false };
    this.showRemocaoCategoriaModal = true;
  }

  confirmarRemocaoCategoriaNovo(panelIndex: number, rowIndex: number): void {
    // Validar se há pelo menos 2 categorias antes de permitir remoção
    const panel = this.novoLotesPanels[panelIndex];
    if (panel && panel.categoriasRows.length <= 1) {
      this.notificationService.warning('Não é possível remover a categoria. Deve haver pelo menos uma categoria por lote.');
      return;
    }
    
    this.remocaoCategoriaContext = { panelIndex, rowIndex, isNovoLote: true };
    this.showRemocaoCategoriaModal = true;
  }

  fecharRemocaoCategoriaModal(): void {
    this.showRemocaoCategoriaModal = false;
    this.remocaoCategoriaContext = null;
  }

  async removerCategoria(): Promise<void> {
    if (!this.remocaoCategoriaContext) return;

    try {
      this.isSaving = true;

      if (this.remocaoCategoriaContext.isNovoLote) {
        // Remover de novo lote
        const panelIndex = this.remocaoCategoriaContext.panelIndex!;
        const rowIndex = this.remocaoCategoriaContext.rowIndex;
        
        if (this.novoLotesPanels[panelIndex]?.categoriasRows) {
          this.novoLotesPanels[panelIndex].categoriasRows.splice(rowIndex, 1);
        }
      } else {
        // Remover de lote existente
        const loteId = this.remocaoCategoriaContext.loteId!;
        const rowIndex = this.remocaoCategoriaContext.rowIndex;
        
        if (this.loteFormRowsById[loteId]) {
          const categoriaParaRemover = this.loteFormRowsById[loteId][rowIndex];
          
          // Se a categoria tem ID (já foi salva no backend), deletar do backend primeiro
          if (categoriaParaRemover?.categoriaCorteId) {
            const categoriaExistente = this.categoriasPorLoteId[loteId]?.find(
              c => c.categoriaCorteId === categoriaParaRemover.categoriaCorteId
            );
            
            if (categoriaExistente?.id) {
              await firstValueFrom(this.categoriaLoteService.deletar(categoriaExistente.id));
              
              // Remover do cache local
              if (this.categoriasPorLoteId[loteId]) {
                this.categoriasPorLoteId[loteId] = this.categoriasPorLoteId[loteId].filter(
                  c => c.id !== categoriaExistente.id
                );
              }
            }
          }
          
          // Remover da interface
          this.loteFormRowsById[loteId].splice(rowIndex, 1);
          
          // Persistir as categorias restantes para garantir consistência
          await this.persistirCategoriasParaLote(loteId!, this.categoriasFormRows || []);
        }
      }

      this.fecharRemocaoCategoriaModal();
      this.notificationService.success('Categoria removida com sucesso!');
    } catch (error) {
      console.error('Erro ao remover categoria:', error);
      this.notificationService.error('Erro ao remover categoria. Tente novamente.');
    } finally {
      this.isSaving = false;
    }
  }

  // Funções para tooltip do botão Continuar
  getTooltipContinuar(): string {
    if (this.abaAtiva === 'informacoes') {
      if (this.canIrParaNutricao()) {
        return '';
      }
      return this.getTooltipInformacoes();
    } else if (this.abaAtiva === 'nutricao') {
      if (this.canIrParaManejo()) {
        return '';
      }
      return this.getTooltipNutricao();
    } else if (this.abaAtiva === 'manejo') {
      if (!this.canContinuarManejo()) {
        const problemas = [];
        if (!this.validarTiposManejoObrigatorios()) {
          problemas.push('Todos os tipos de manejo devem ser selecionados');
        }
        if (!this.validarPercentuaisIndividuais()) {
          problemas.push('Cada lote deve ter exatamente 100% de percentual do rebanho distribuído');
        }
        return problemas.join('. ');
      }
      return '';
    }
    return '';
  }

  private getTooltipInformacoes(): string {
    const problemas: string[] = [];

    // Verificar novos lotes
    if (Array.isArray(this.novoLotesPanels) && this.novoLotesPanels.length > 0) {
      for (let i = 0; i < this.novoLotesPanels.length; i++) {
        const p = this.novoLotesPanels[i];
        const nomeOk = ((p?.novoLote?.nome || '').trim().length >= 3);
        if (!nomeOk) {
          problemas.push(`Lote ${i + 1}: Nome deve ter pelo menos 3 caracteres`);
        }
        
        const rows = p?.categoriasRows || [];
        if (rows.length === 0) {
          problemas.push(`Lote ${i + 1}: Adicione pelo menos uma categoria`);
        } else {
          let temCategoriaCompleta = false;
          for (let j = 0; j < rows.length; j++) {
            const r = rows[j];
            const camposObrigatorios = [
              { campo: 'categoriaCorteId', nome: 'Categoria de Corte' },
              { campo: 'animaisFazenda', nome: 'Animais na Fazenda' },
              { campo: 'pesoMedioVivo', nome: 'Peso Médio Vivo' },
              { campo: 'animaisComprados', nome: 'Animais Comprados' },
              { campo: 'pesoMedioComprados', nome: 'Peso Médio Comprados' },
              { campo: 'animaisVendidos', nome: 'Animais Vendidos' },
              { campo: 'pesoMedioVendidos', nome: 'Peso Médio Vendidos' },
              { campo: 'permanenciaMeses', nome: 'Permanência (meses)' },
              { campo: 'idadeDesmame', nome: 'Idade Desmame' }
            ];
            
            const camposFaltando = camposObrigatorios.filter(c => (r as any)?.[c.campo] == null);
            if (camposFaltando.length === 0) {
              temCategoriaCompleta = true;
            }
          }
          if (!temCategoriaCompleta) {
            problemas.push(`Lote ${i + 1}: Complete todos os campos de pelo menos uma categoria`);
          }
        }
      }
    }

    // Verificar lotes existentes
    if (Array.isArray(this.lotes) && this.lotes.length > 0) {
      for (const lote of this.lotes) {
        if (!lote?.id || !lote.nome || lote.nome.trim().length < 3) {
          problemas.push(`Lote "${lote?.nome || 'sem nome'}": Nome deve ter pelo menos 3 caracteres`);
          continue;
        }
        
        const categorias = this.categoriasPorLoteId[lote.id] || [];
        if (categorias.length === 0) {
          problemas.push(`Lote "${lote.nome}": Adicione pelo menos uma categoria`);
          continue;
        }
        
        const rows = this.loteFormRowsById[lote.id] || [];
        let temCategoriaCompleta = false;
        
        if (rows.length > 0) {
          for (const r of rows) {
            const camposObrigatorios = [
              'categoriaCorteId', 'animaisFazenda', 'pesoMedioVivo', 'animaisComprados',
              'pesoMedioComprados', 'animaisVendidos', 'pesoMedioVendidos', 'permanenciaMeses'
            ];
            // Adicionar idadeDesmame apenas se for categoria de bezerro/bezerra
            if (this.isCategoriaBezerroById((r as any)?.categoriaCorteId)) {
              camposObrigatorios.push('idadeDesmame');
            }
            if (camposObrigatorios.every(campo => (r as any)?.[campo] != null)) {
              temCategoriaCompleta = true;
              break;
            }
          }
        } else {
          for (const c of categorias) {
            const camposObrigatorios = [
              'categoriaCorteId', 'quantidadeAnimais', 'pesoMedio', 'animaisComprados',
              'pesoMedioComprados', 'animaisVendidos', 'pesoMedioVendidos', 'permanenciaMeses'
            ];
            // Adicionar idadeDesmame apenas se for categoria de bezerro/bezerra
            if (this.isCategoriaBezerroById(c?.categoriaCorteId)) {
              camposObrigatorios.push('idadeDesmame');
            }
            if (camposObrigatorios.every(campo => (c as any)?.[campo] != null)) {
              temCategoriaCompleta = true;
              break;
            }
          }
        }
        
        if (!temCategoriaCompleta) {
          problemas.push(`Lote "${lote.nome}": Complete todos os campos de pelo menos uma categoria`);
        }
      }
    }

    if (problemas.length === 0 && (!this.lotes || this.lotes.length === 0) && (!this.novoLotesPanels || this.novoLotesPanels.length === 0)) {
      return 'Adicione pelo menos um lote com informações completas';
    }

    return problemas.length > 0 ? problemas.join('\n') : '';
  }

  private getTooltipNutricao(): string {
    const problemas: string[] = [];

    if (!Array.isArray(this.lotes) || this.lotes.length === 0) {
      return 'Nenhum lote encontrado';
    }

    for (const lote of this.lotes) {
      if (!lote?.id) continue;
      
      const categorias = this.categoriasPorLoteId[lote.id] || [];
      if (categorias.length === 0) {
        problemas.push(`Lote "${lote.nome}": Sem categorias`);
        continue;
      }

      const pastejo = this.pastejoByLoteId[lote.id] || [];
      const ing = this.ingredientesByLoteId[lote.id] || [];
      const conc = this.concentradoByLoteId[lote.id] || [];
      const adit = this.aditivoByLoteId[lote.id] || [];

      for (let i = 0; i < categorias.length; i++) {
        const categoria = categorias[i];
        const p = pastejo[i] || {};
        const ii = ing[i] || {};
        const cc = conc[i] || {};
        const aa = adit[i] || {};

        const problemasCat: string[] = [];

        // Validar pastejo
        if (p?.horasPorDia == null || p?.diasPorAno == null) {
          problemasCat.push('Pastejo incompleto');
        }

        // Validar ingredientes
        if (!(ii?.ingrediente || '').trim() || ii?.quantidadeKgCabDia == null || ii?.ofertaDiasAno == null || ii?.producao == null) {
          problemasCat.push('Ingredientes incompletos');
        }

        // Validar concentrado
        if ((cc?.proteinaBrutaPercentual == null && !cc?.ureia?.trim() && !cc?.subproduto?.trim()) || cc?.quantidade == null || cc?.oferta == null) {
          problemasCat.push('Concentrado incompleto');
        }

        // Validar aditivos
        if (!aa?.tipo?.trim() || aa?.dose == null || aa?.oferta == null || aa?.percentualAdicional == null) {
          problemasCat.push('Aditivos incompletos');
        }

        if (problemasCat.length > 0) {
          const nomeCategoria = (categoria as any)?.categoriaCorte?.nome || `Categoria ${i + 1}`;
          problemas.push(`Lote "${lote.nome}" - ${nomeCategoria}: ${problemasCat.join(', ')}`);
        }
      }
    }

    return problemas.length > 0 ? problemas.join('\n') : '';
  }

  // Métodos para gerenciar ingredientes
  private async carregarIngredientes(): Promise<void> {
    try {
      this.isLoadingIngredientes = true;
      const ingredientes: string[] = await firstValueFrom(this.bancoIngredientesService.listarTodosIngredientes());
      this.ingredientesDisponiveis = ingredientes;
      this.ingredientesFiltrados = ingredientes;
      
      // Não há mais tipos para extrair, pois agora são apenas strings
      this.tiposIngredientes = [];
    } catch (error) {
      console.error('Erro ao carregar ingredientes:', error);
      this.notificationService.error('Erro ao carregar ingredientes alimentares');
    } finally {
      this.isLoadingIngredientes = false;
    }
  }

  filtrarIngredientesPorTipo(tipo: string): void {
    // Como agora são apenas strings, não há filtro por tipo
    this.ingredientesFiltrados = this.ingredientesDisponiveis;
  }

  buscarIngredientesPorNome(nome: string): void {
    if (!nome || nome.trim().length < 2) {
      this.ingredientesFiltrados = this.ingredientesDisponiveis;
      return;
    }
    
    const termoBusca = nome.toLowerCase().trim();
    this.ingredientesFiltrados = this.ingredientesDisponiveis.filter(ingrediente => 
      ingrediente.toLowerCase().includes(termoBusca)
    );
  }

  obterIngredientePorNome(nome: string): string | undefined {
    return this.ingredientesDisponiveis.find(ingrediente => ingrediente === nome);
  }

  onInserirDadosDietaChange(valor: 'Sim' | 'Não' | undefined): void {
    // Se o usuário selecionar "Não", limpar todos os dados dos lotes
    if (valor === 'Não') {
      this.limparDadosLotes();
    }
  }

  private limparDadosLotes(): void {
    // Limpar dados de pastejo, ingredientes, concentrado e aditivo para todos os lotes
    this.pastejoByLoteId = {};
    this.ingredientesByLoteId = {};
    this.concentradoByLoteId = {};
    this.aditivoByLoteId = {};
    
    // Reinicializar os arrays vazios para cada lote existente
    for (const lote of this.lotes) {
      if (lote.id) {
        const categorias = this.categoriasPorLoteId[lote.id] || [];
        const numCategorias = categorias.length;
        
        this.pastejoByLoteId[lote.id] = Array(numCategorias).fill(null).map(() => ({}));
        this.ingredientesByLoteId[lote.id] = Array(numCategorias).fill(null).map(() => ({}));
        this.concentradoByLoteId[lote.id] = Array(numCategorias).fill(null).map(() => ({}));
        this.aditivoByLoteId[lote.id] = Array(numCategorias).fill(null).map(() => ({}));
      }
    }
  }
}