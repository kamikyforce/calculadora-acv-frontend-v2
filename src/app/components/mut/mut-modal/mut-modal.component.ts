import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, ValidatorFn, AbstractControl } from '@angular/forms';
import { CommonModule } from '@angular/common';

import {
  MutRequest,
  MutResponse,
  TipoMudanca,
  Bioma,
  UF,
  EscopoEnum,
  TipoFatorSolo,
  SiglaFitofisionomia,
  CategoriaDesmatamento,
  MutSoloData
} from '../../../core/models/mut.model';

import { MutService } from '../../../core/services/mut.service';
import { NotificationService } from '../../../core/services/notification.service';
import { DecimalFormatDirective } from '../../../directives/decimal-format.directive';
import { MESSAGES } from '../../../shared/constants/messages';

@Component({
  selector: 'app-mut-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DecimalFormatDirective],
  templateUrl: './mut-modal.component.html',
  styleUrls: ['./mut-modal.component.scss']
})
export class MutModalComponent implements OnInit {
  // Tratamento de duplicidade (geral + SOLO específico)
  // - Detecção genérica de duplicidade (para SOLO, DESMATAMENTO e VEGETAÇÃO) por 409, RN008_DUPLICIDADE, DADOS_DUPLICADOS ou mensagens com "RN008/duplicados"
  // - Para SOLO: tentativa automática de atualizar registro existente com LAC/Arenoso via tryUpdateExistingOnDuplicate()
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() fator: MutResponse | null = null;
  @Input() isVisible = false;
  @Input() notifyInModal = false;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<MutResponse>();

  mutForm!: FormGroup;
  activeTab: EscopoEnum = EscopoEnum.ESCOPO1;
  private lastTab: EscopoEnum = EscopoEnum.ESCOPO1;

  private normalizeSiglaToOption(sigla: string | null | undefined): SiglaFitofisionomia | '' {
    const v = (sigla ?? '').toString();
    if (!v) return '' as any;
    const found = this.siglaOptions.find(opt => String(opt).toUpperCase() === v.toUpperCase());
    return (found as any) ?? '' as any;
  }

  // === UI/estado ===
  isCategoriaOpen = false;
  isUfOpen = false;
  isLoading = false;
  isConfirmOpen = false;
  showSaveConfirmModal = false;
  confirmType: 'cancel' | 'save' = 'cancel';
  duplicateExists = false;

  // === Expor para o template ===
  MESSAGES = MESSAGES;
  TipoMudanca = TipoMudanca;
  Bioma = Bioma;
  UF = UF;
  EscopoEnum = EscopoEnum;
  TipoFatorSolo = TipoFatorSolo;
  SiglaFitofisionomia = SiglaFitofisionomia;
  CategoriaDesmatamento = CategoriaDesmatamento;

  // ===== Opções UI =====
  tipoMudancaOptions = [TipoMudanca.SOLO, TipoMudanca.DESMATAMENTO, TipoMudanca.VEGETACAO];
  biomaOptions = Object.values(Bioma);
  ufOptions = Object.values(UF);
  siglaOptions = Object.values(SiglaFitofisionomia);

  // Fitofisionomia (Vegetação) – ordem F, G, OFL, O (compat)
  private allCategoriaOptions = [
    { value: 'F', label: 'F - Formação Florestal' },
    { value: 'G', label: 'G - Formação Campestre' },
    { value: 'OFL', label: 'OFL - Outras Formações Florestais' },
    { value: 'O', label: 'O - Floresta' }
  ];
  categoriaOptions = [
    { value: 'O', label: 'O - Floresta' },
    { value: 'F', label: 'F - Formação Florestal' },
    { value: 'OFL', label: 'OFL - Outras Formações Florestais' },
    { value: 'G', label: 'G - Formação Campestre' }
  ];

  parametroOptions: string[] = [
    'REMOÇÃO de floresta primária (tCO2e/ha/ano)',
    'Percentual de ESTOQUE de floresta secundária remanescente em relação ao carbono inicial (%)',
    'REMOÇÃO de floresta secundária com histórico de floresta (tCO2e/ha ano)',
    'REMOÇÃO de floresta secundária com histórico de pastagem (tCO2e/ha/ano)',
    'REMOÇÃO de floresta secundária com histórico de agricultura (tCO2e/ha/ano)',
    'REMOÇÃO de floresta secundária com outros históricos (tCO2e/ha/ano)',
    'REMOÇÃO de campo primário (tCO2e/ha/ano)',
    'REMOÇÃO de campo secundário (tCO2e/ha/ano)',
    'Percentual de ESTOQUE de campo secundária remanescente em relação ao carbono inicial (%)'
  ];

  // Uso anterior – lista base
  usoAnteriorOptions: string[] = [
    'Cana-de-açúcar com queima',
    'Cultivo convencional',
    'Cultivo convencional (Demais regiões)',
    'Cultivo convencional (Região sul)',
    'Integração lavoura-pecuária',
    'Pastagem degradada',
    'Pastagem/pastagem melhorada',
    'Integração lavoura-pecuária(-floresta)',
    'Pastagem',
    'Floresta plantada - eucalipto',
    'Café',
    'Regeneração Natural',
    'Plantio direto',
    'Pastagem não degradada',
    'Agricultura convencional',
    'Lavoura',
    'Vegetação nativa (Cerrado)',
    'Vegetação nativa (Floresta)',
    'Vegetação nativa (geral)',
    'Vegetação nativa (Cerrado) solo argiloso',
    'Vegetação nativa (Cerrado) solo médio',
    'Vegetação nativa (Cerradão) solo médio',
    'Vegetação nativa (Cerradão)',
    'Severamente Degradado',
    'Moderadamente Degradado',
    'Não Degradado',
    'Melhorado sem uso de insumos',
    'Melhorado com uso de insumos'
  ];

  // Regras Uso anterior → Uso atual
  private usoAtualMap: Record<string, string[]> = {
    'Cana-de-açúcar com queima': ['Cana-de-açúcar sem queima'],
    'Cultivo convencional': ['Integração lavoura-pecuária(-floresta)', 'Pastagem/pastagem melhorada', 'Pastagem melhorada com insumos', 'Sistema agroflorestal'],
    'Cultivo convencional (Demais regiões)': ['Plantio direto'],
    'Cultivo convencional (Região sul)': ['Plantio direto'],
    'Integração lavoura-pecuária': ['Cultivo convencional', 'Pastagem/pastagem melhorada', 'Pastagem melhorada com insumos', 'Plantio direto'],
    'Pastagem degradada': ['Cultivo convencional', 'Integração lavoura-pecuária(-floresta)', 'Plantio direto'],
    'Pastagem/pastagem melhorada': ['Sistema agroflorestal', 'Integração lavoura-pecuária(-floresta)'],
    'Integração lavoura-pecuária(-floresta)': [],
    'Pastagem': ['Floresta plantada - eucalipto', 'Café', 'Regeneração Natural'],
    'Floresta plantada - eucalipto': [],
    'Café': [],
    'Regeneração Natural': [],
    'Plantio direto': ['Cultivo convencional', 'Integração lavoura-pecuária(-floresta)'],
    'Pastagem não degradada': ['Agricultura convencional'],
    'Agricultura convencional': [],
    'Lavoura': ['Café'],

    // Correções de negócio fornecidas
    'Vegetação nativa (Cerrado)': ['Plantio direto'],
    'Vegetação nativa (Floresta)': ['Plantio direto'],
    'Vegetação nativa (geral)': ['Lavoura convencional'],
    'Vegetação nativa (Cerrado) solo argiloso': ['Lavoura convencional'],
    'Vegetação nativa (Cerrado) solo médio': ['Lavoura convencional'],
    'Vegetação nativa (Cerradão) solo médio': ['Lavoura convencional'],
    'Vegetação nativa (Cerradão)': ['Pastagem degradada', 'Pastagem nominal'],

    'Severamente Degradado': ['Severamente Degradado', 'Moderadamente Degradado', 'Não Degradado', 'Melhorado sem uso de insumos', 'Melhorado com uso de insumos'],
    'Moderadamente Degradado': ['Severamente Degradado', 'Moderadamente Degradado', 'Não Degradado', 'Melhorado sem uso de insumos', 'Melhorado com uso de insumos'],
    'Não Degradado': ['Severamente Degradado', 'Moderadamente Degradado', 'Não Degradado', 'Melhorado sem uso de insumos', 'Melhorado com uso de insumos'],
    'Melhorado sem uso de insumos': ['Severamente Degradado', 'Moderadamente Degradado', 'Não Degradado', 'Melhorado sem uso de insumos', 'Melhorado com uso de insumos'],
    'Melhorado com uso de insumos': ['Severamente Degradado', 'Moderadamente Degradado', 'Não Degradado', 'Melhorado sem uso de insumos', 'Melhorado com uso de insumos']
  };

  // ====== ESTADO POR ESCOPO (campos independentes) ======
  private soloScope: Record<EscopoEnum, { fatorEmissao: number | null; referencia: string; soloLAC: number | null; soloArenoso: number | null; }> = {
    [EscopoEnum.ESCOPO1]: { fatorEmissao: null, referencia: '', soloLAC: null, soloArenoso: null },
    [EscopoEnum.ESCOPO3]: { fatorEmissao: null, referencia: '', soloLAC: null, soloArenoso: null }
  };

  private desmatScope: Record<EscopoEnum, { nomeFitofisionomia: string; sigla: SiglaFitofisionomia | '' ; categoria: CategoriaDesmatamento | '' ; estoqueCarbono: number | null; }> = {
    [EscopoEnum.ESCOPO1]: { nomeFitofisionomia: '', sigla: '' as any, categoria: '' as any, estoqueCarbono: null },
    [EscopoEnum.ESCOPO3]: { nomeFitofisionomia: '', sigla: '' as any, categoria: '' as any, estoqueCarbono: null }
  };

  private vegetScope: Record<EscopoEnum, { amazonia: number | null; caatinga: number | null; cerrado: number | null; mataAtlantica: number | null; pampa: number | null; pantanal: number | null; }> = {
    [EscopoEnum.ESCOPO1]: { amazonia: null, caatinga: null, cerrado: null, mataAtlantica: null, pampa: null, pantanal: null },
    [EscopoEnum.ESCOPO3]: { amazonia: null, caatinga: null, cerrado: null, mataAtlantica: null, pampa: null, pantanal: null }
  };

  constructor(
    private fb: FormBuilder,
    private mutService: MutService,
    private notificationService: NotificationService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    if (this.fator && this.mode === 'edit') {
      this.populateForm();
      this.activeTab = this.fator.escopo;
      this.lastTab = this.fator.escopo;
    }

    // Valor único → habilita/desabilita UF
    this.mutForm.get('valorUnico')?.valueChanges.subscribe(v => {
      const uf = this.mutForm.get('uf');
      if (v === true || v === 'true') {
        uf?.disable({ emitEvent: false });
        uf?.setValue([], { emitEvent: false });
      } else {
        uf?.enable({ emitEvent: false });
      }
      uf?.updateValueAndValidity();
    });

    // Regras por tipo/escopo
    this.mutForm.get('tipoMudanca')?.valueChanges.subscribe(() => {
      this.applyValidatorsByTipo();
      this.checkDuplicateEarly();
    });
    this.mutForm.get('tipoFator')?.valueChanges.subscribe(() => this.applyValidatorsByTipo());
    this.mutForm.get('escopo')?.valueChanges.subscribe(() => this.checkDuplicateEarly());

    // Validador de combinação Uso anterior/atual (Solo)
    this.mutForm.setValidators(this.usoComboValidator());
  }

  // ====================== INIT / POPULATE ======================
  private initializeForm(): void {
    this.mutForm = this.fb.group({
      tipoMudanca: ['', Validators.required],
      escopo: [EscopoEnum.ESCOPO1, Validators.required],

      // Desmatamento (replicados: bioma, valorUnico, uf)
      bioma: [''],
      valorUnico: [false, Validators.required],
      uf: [[]],
      // Independentes por escopo:
      nomeFitofisionomia: [''],
      sigla: [''],
      categoria: [''],
      estoqueCarbono: [null, [this.dec6Validator()]],

      // Solo (replicados: tipoFator, usoAnterior, usoAtual)
      tipoFator: [''],
      usoAnterior: [''],
      usoAtual: [''],
      // Independentes por escopo:
      fatorEmissao: [null, [this.dec6Validator()]],    // fator de emissão (principal)
      referencia: [''],
      soloLAC: [null, [this.dec6Validator()]],
      soloArenoso: [null, [this.dec6Validator()]],

      // Vegetação (replicados: categoriaFitofisionomia, parametro)
      biomaVegetacao: [''],
      categoriaFitofisionomia: [[]],
      parametro: [''],
      // Independentes por escopo (6 biomas):
      amazonia: [null, [this.dec6Validator()]],
      caatinga: [null, [this.dec6Validator()]],
      cerrado: [null, [this.dec6Validator()]],
      mataAtlantica: [null, [this.dec6Validator()]],
      pampa: [null, [this.dec6Validator()]],
      pantanal: [null, [this.dec6Validator()]]
    });

    if (this.mode === 'edit') {
      this.mutForm.get('tipoMudanca')?.disable();
    }

    this.applyValidatorsByTipo();
  }

  private populateForm(): void {
    if (!this.fator) return;

    // Setar tipo e escopo
    this.mutForm.patchValue({
      tipoMudanca: this.fator.tipoMudanca,
      escopo: this.fator.escopo
    }, { emitEvent: false });

    this.applyValidatorsByTipo();

    // Desmatamento — carrega independentes no mapa do escopo do fator
    if (this.fator.dadosDesmatamento?.length) {
      const d = this.fator.dadosDesmatamento[0];
      this.mutForm.patchValue({
        bioma: d.bioma,
        valorUnico: d.valorUnico,
        uf: d.ufs || []
      }, { emitEvent: false });

      this.onValorUnicoChange();

      this.desmatScope[this.fator.escopo] = {
        nomeFitofisionomia: d.nomeFitofisionomia || '',
        sigla: this.normalizeSiglaToOption(d.siglaFitofisionomia as any),
        categoria: (d.categoriaDesmatamento as any) ?? '' as any,
        estoqueCarbono: d.estoqueCarbono ?? null
      };
    }

    // Solo — carrega independentes no mapa do escopo do fator
    if (this.fator.dadosSolo?.length) {
      // Registro principal
      const principalList = this.fator.dadosSolo.filter(r => r.principal === true);
      const main = principalList.length
        ? principalList.reduce((a, b) => (b.id > a.id ? b : a), principalList[0])
        : (this.fator.dadosSolo.find(r => r.fatorCO2 == null && r.fatorCH4 == null) || this.fator.dadosSolo[0]);

      const tipoFator = main.tipoFatorSolo || '';
      const fatorEmissao = main.valorFator ?? null;
      const referencia = main.descricao || '';
      const soloLAC = this.fator.dadosSolo.find(r => r.fatorCO2 != null)?.fatorCO2 ?? null;
      const soloArenoso = this.fator.dadosSolo.find(r => r.fatorCH4 != null)?.fatorCH4 ?? null;

      this.mutForm.patchValue({
        tipoFator,
        usoAnterior: main.usoAnterior || '',
        usoAtual: main.usoAtual || ''
      }, { emitEvent: false });

      this.soloScope[this.fator.escopo] = {
        fatorEmissao, referencia, soloLAC, soloArenoso
      };
    }

    // Vegetação — carrega independentes no mapa do escopo do fator
    if (this.fator.dadosVegetacao?.length) {
      const d = this.fator.dadosVegetacao[0];
      this.mutForm.patchValue({
        categoriaFitofisionomia: d.categoriasFitofisionomia || [],
        parametro: d.parametro
      }, { emitEvent: false });

      this.vegetScope[this.fator.escopo] = {
        amazonia: d.valorAmazonia ?? null,
        caatinga: d.valorCaatinga ?? null,
        cerrado: d.valorCerrado ?? null,
        mataAtlantica: d.valorMataAtlantica ?? null,
        pampa: d.valorPampa ?? null,
        pantanal: d.valorPantanal ?? null
      };
    }

    // Aplica ao form os independentes do escopo atual (se existirem)
    this.loadIndependentFieldsForScope(this.fator.escopo);

    this.mutForm.markAsPristine();
  }

  // ====================== TABS / UI ======================
  onTabChange(escopo: EscopoEnum): void {
    console.info('[MUT][TabChange] from', this.activeTab, 'to', escopo);
    // Salva independentes do escopo anterior
    this.persistIndependentFieldsForScope(this.activeTab);
    this.lastTab = this.activeTab;

    // Troca aba e restaura independentes do novo escopo
    this.activeTab = escopo;
    this.mutForm.patchValue({ escopo }, { emitEvent: true });

    // Primeiro aplica o que já temos em memória
    this.loadIndependentFieldsForScope(escopo);

    // Se estiver editando e os campos do novo escopo estiverem vazios, tenta carregar do backend
    this.maybeFetchSiblingScopeFields(escopo);

    console.info('[MUT][TabChange] loaded fields for', escopo, {
      solo: this.soloScope[escopo],
      desmatamento: this.desmatScope[escopo],
      vegetacao: this.vegetScope[escopo]
    });
  }

  private persistIndependentFieldsForScope(scope: EscopoEnum): void {
    const v = this.mutForm.getRawValue();
    console.debug('[MUT][PersistScope]', scope, 'raw form', v);

    // Solo independentes
    this.soloScope[scope] = {
      fatorEmissao: this.castNumber(v.fatorEmissao) ?? null,
      referencia: v.referencia || '',
      soloLAC: this.castNumber(v.soloLAC) ?? null,
      soloArenoso: this.castNumber(v.soloArenoso) ?? null
    };
    console.debug('[MUT][PersistScope][Solo]', scope, this.soloScope[scope]);

    // Desmatamento independentes
    this.desmatScope[scope] = {
      nomeFitofisionomia: v.nomeFitofisionomia || '',
      sigla: v.sigla || '',
      categoria: v.categoria || '',
      estoqueCarbono: this.castNumber(v.estoqueCarbono) ?? null
    } as any;
    console.debug('[MUT][PersistScope][Desmatamento]', scope, this.desmatScope[scope]);

    // Vegetação independentes
    this.vegetScope[scope] = {
      amazonia: this.castNumber(v.amazonia) ?? null,
      caatinga: this.castNumber(v.caatinga) ?? null,
      cerrado: this.castNumber(v.cerrado) ?? null,
      mataAtlantica: this.castNumber(v.mataAtlantica) ?? null,
      pampa: this.castNumber(v.pampa) ?? null,
      pantanal: this.castNumber(v.pantanal) ?? null
    };
    console.debug('[MUT][PersistScope][Vegetacao]', scope, this.vegetScope[scope]);
  }

  private loadIndependentFieldsForScope(scope: EscopoEnum): void {
    console.debug('[MUT][LoadScope] applying fields for', scope);

    // Solo
    const solo = this.soloScope[scope];
    this.mutForm.patchValue({
      fatorEmissao: solo.fatorEmissao,
      referencia: solo.referencia,
      soloLAC: solo.soloLAC,
      soloArenoso: solo.soloArenoso
    }, { emitEvent: false });
    console.debug('[MUT][LoadScope][Solo]', scope, solo);

    // Desmatamento
    const des = this.desmatScope[scope];
    this.mutForm.patchValue({
      nomeFitofisionomia: des.nomeFitofisionomia,
      sigla: des.sigla,
      categoria: des.categoria,
      estoqueCarbono: des.estoqueCarbono
    }, { emitEvent: false });
    console.debug('[MUT][LoadScope][Desmatamento]', scope, des);

    // Vegetação
    const veg = this.vegetScope[scope];
    this.mutForm.patchValue({
      amazonia: veg.amazonia,
      caatinga: veg.caatinga,
      cerrado: veg.cerrado,
      mataAtlantica: veg.mataAtlantica,
      pampa: veg.pampa,
      pantanal: veg.pantanal
    }, { emitEvent: false });
    console.debug('[MUT][LoadScope][Vegetacao]', scope, veg);
  }

  // Nova função: carrega os campos independentes do "escopo irmão" se estiverem vazios
  private maybeFetchSiblingScopeFields(scope: EscopoEnum): void {
    if (this.mode !== 'edit') return;

    const tipo = this.currentTipoMudanca;
    // Helpers para checar se o estado local está vazio
    const isEmptySolo =
      this.soloScope[scope]?.fatorEmissao == null &&
      !this.soloScope[scope]?.referencia &&
      this.soloScope[scope]?.soloLAC == null &&
      this.soloScope[scope]?.soloArenoso == null;

    const isEmptyDesmat =
      !this.desmatScope[scope]?.nomeFitofisionomia &&
      !this.desmatScope[scope]?.sigla &&
      !this.desmatScope[scope]?.categoria &&
      this.desmatScope[scope]?.estoqueCarbono == null;

    const isEmptyVeget =
      this.vegetScope[scope]?.amazonia == null &&
      this.vegetScope[scope]?.caatinga == null &&
      this.vegetScope[scope]?.cerrado == null &&
      this.vegetScope[scope]?.mataAtlantica == null &&
      this.vegetScope[scope]?.pampa == null &&
      this.vegetScope[scope]?.pantanal == null;

    // SOLO: ler valores independentes apenas se houver registro no escopo atual com o mesmo tipo+uso
    if (tipo === TipoMudanca.SOLO) {
      if (isEmptySolo) {
        this.loadSoloFromSiblingByUsoAnteriorAtual(scope);
      }
      return;
    }

    // Desmatamento – mantém pré-preenchimento do último registro do escopo
    if (tipo === TipoMudanca.DESMATAMENTO && isEmptyDesmat) {
      this.mutService.listar({ tipoMudanca: tipo, escopo: scope, page: 0, size: 1, sort: 'dataAtualizacao', direction: 'DESC' })
        .subscribe({
          next: (resp: any) => {
            const item = resp?.content?.[0];
            const d = item?.dadosDesmatamento?.[0];
            if (!d) return;
            this.desmatScope[scope] = {
              nomeFitofisionomia: d.nomeFitofisionomia || '',
              sigla: this.normalizeSiglaToOption(d.siglaFitofisionomia as any),
              categoria: (d.categoriaDesmatamento as any) ?? '' as any,
              estoqueCarbono: d.estoqueCarbono ?? null
            } as any;
            this.loadIndependentFieldsForScope(scope);
          },
          error: () => { /* silencioso */ }
        });
      return;
    }

    // Vegetação – mantém pré-preenchimento do último registro do escopo
    if (tipo === TipoMudanca.VEGETACAO && isEmptyVeget) {
      this.mutService.listar({ tipoMudanca: tipo, escopo: scope, page: 0, size: 1, sort: 'dataAtualizacao', direction: 'DESC' })
        .subscribe({
          next: (resp: any) => {
            const item = resp?.content?.[0];
            const d = item?.dadosVegetacao?.[0];
            if (!d) return;
            this.vegetScope[scope] = {
              amazonia: d.valorAmazonia ?? null,
              caatinga: d.valorCaatinga ?? null,
              cerrado: d.valorCerrado ?? null,
              mataAtlantica: d.valorMataAtlantica ?? null,
              pampa: d.valorPampa ?? null,
              pantanal: d.valorPantanal ?? null
            };
            this.loadIndependentFieldsForScope(scope);
          },
          error: () => { /* silencioso */ }
        });
      return;
    }
  }

  // Função auxiliar para Solo: busca valores independentes do escopo atual com mesmo tipo+uso
  private loadSoloFromSiblingByUsoAnteriorAtual(scope: EscopoEnum): void {
    const data = this.mutForm.getRawValue();
    const tipoFator = data.tipoFator;
    const usoAnterior = String(data.usoAnterior || '').trim();
    const usoAtual = String(data.usoAtual || '').trim();

    // Só busca se o par de uso estiver definido
    if (!tipoFator || !usoAnterior || !usoAtual) {
      // Garante que os campos independentes fiquem vazios se não houver base para leitura
      this.soloScope[scope] = { fatorEmissao: null, referencia: '', soloLAC: null, soloArenoso: null };
      this.loadIndependentFieldsForScope(scope);
      return;
    }

    this.mutService.buscarSoloPorUsoAnteriorAtual(scope, tipoFator, usoAnterior, usoAtual).subscribe({
      next: (item) => {
        if (!item || !item.dadosSolo?.length) {
          // Não existe no escopo alvo — mantém vazio para o usuário preencher
          this.soloScope[scope] = { fatorEmissao: null, referencia: '', soloLAC: null, soloArenoso: null };
          this.loadIndependentFieldsForScope(scope);
          return;
        }

        const dados = item.dadosSolo || [];
        // Main: linha com CO2/CH4 nulos e par de uso igual
        const main = dados.find((r: any) =>
          String(r?.usoAnterior || '').trim() === usoAnterior &&
          String(r?.usoAtual || '').trim() === usoAtual &&
          r?.fatorCO2 == null && r?.fatorCH4 == null
        ) || dados[0];

        const referencia = String(main?.descricao || '').trim();
        const fatorEmissao = this.castNumber(main?.valorFator) ?? null;

        // Auxiliares LAC/arenoso: uso vazio, mesma referência
        const auxLAC = dados.find((r: any) =>
          String(r?.usoAnterior || '').trim() === '' &&
          String(r?.usoAtual || '').trim() === '' &&
          String(r?.descricao || '').trim() === referencia &&
          r?.fatorCO2 != null
        );
        const auxArenoso = dados.find((r: any) =>
          String(r?.usoAnterior || '').trim() === '' &&
          String(r?.usoAtual || '').trim() === '' &&
          String(r?.descricao || '').trim() === referencia &&
          r?.fatorCH4 != null
        );

        this.soloScope[scope] = {
          fatorEmissao,
          referencia,
          soloLAC: this.castNumber(auxLAC?.fatorCO2) ?? null,
          soloArenoso: this.castNumber(auxArenoso?.fatorCH4) ?? null
        };
        this.loadIndependentFieldsForScope(scope);
      },
      error: () => {
        // Em erro, não perturba — deixa o usuário editar manualmente
        this.soloScope[scope] = { fatorEmissao: null, referencia: '', soloLAC: null, soloArenoso: null };
        this.loadIndependentFieldsForScope(scope);
      }
    });
  }

  // ====================== UI ACTIONS ======================
  openConfirm(type: 'cancel' | 'save'): void {
    this.confirmType = type;
    if (type === 'cancel') this.isConfirmOpen = true;
    if (type === 'save') this.showSaveConfirmModal = true;
  }
  closeConfirm(): void { this.isConfirmOpen = false; this.confirmType = 'cancel'; }
  closeSaveConfirmModal(): void { this.showSaveConfirmModal = false; }
  confirmSave(): void {
      this.showSaveConfirmModal = false;
      if (!this.isLoading) this.performSave();
  }
  handleConfirm(): void {
    if (this.confirmType !== 'cancel') return;
    this.isConfirmOpen = false;
    this.mutForm.reset({ tipoMudanca: '', escopo: EscopoEnum.ESCOPO1, valorUnico: false });
    this.activeTab = EscopoEnum.ESCOPO1;
    this.close.emit();
  }
  onClose(): void {
    if (this.mutForm.dirty) this.openConfirm('cancel');
    else {
      this.mutForm.reset({ tipoMudanca: '', escopo: EscopoEnum.ESCOPO1, valorUnico: false });
      this.activeTab = EscopoEnum.ESCOPO1;
      this.close.emit();
    }
  }
  async onSubmit(): Promise<void> {
    if (this.showSaveConfirmModal || this.isLoading) return;
    if (!this.mutForm.valid) {
      this.markFormGroupTouched();
      this.notifyFormErrors();
      return;
    }
    
    // Validação de duplicidade antes de abrir modal de confirmação
    const isValid = await this.validateDuplicateEntry();
    if (!isValid) {
      console.warn('[MUT][Submit] duplicate entry detected, aborting submit');
      return;
    }
    
    this.openConfirm('save');
  }

  // ====================== VALIDADORES / HELPERS ======================
  private applyValidatorsByTipo(): void {
      const currentTipo = this.currentTipoMudanca;
      const tipoFatorValue = this.mutForm.get('tipoFator')?.value;
      console.info('[MUT][Validators] tipoMudanca=', currentTipo, 'tipoFator=', tipoFatorValue, 'escopo=', this.activeTab);
  
      // 1) Limpa TODOS os validadores antes de aplicar os do tipo atual
      Object.keys(this.mutForm.controls).forEach(k => this.mutForm.get(k)?.clearValidators());
  
      // Campos sempre obrigatórios (independente do tipo)
      this.setValidators('tipoMudanca', [Validators.required]);
      this.setValidators('escopo', [Validators.required]);
  
      if (this.currentTipoMudanca === TipoMudanca.DESMATAMENTO) {
          console.debug('[MUT][Validators] applying DESMATAMENTO validators');
          // Replicados
          this.setValidators('bioma', [Validators.required]);
          this.setValidators('valorUnico', [Validators.required]);
          this.setValidators('uf', [this.ufConditionalValidator()]);
          // Independentes
          this.setValidators('nomeFitofisionomia', [Validators.required]);
          this.setValidators('sigla', [Validators.required]);
          this.setValidators('categoria', [Validators.required]);
          this.setValidators('estoqueCarbono', [this.dec6Validator()]);
      }
  
      if (this.currentTipoMudanca === TipoMudanca.VEGETACAO) {
          console.debug('[MUT][Validators] applying VEGETACAO validators');
          // Replicados
          this.setValidators('parametro', [Validators.required]);
          this.setValidators('categoriaFitofisionomia', [this.categoriaValidator()]);
          // Independentes
          ['amazonia','caatinga','cerrado','mataAtlantica','pampa','pantanal'].forEach(f =>
              this.setValidators(f, [this.dec6Validator()])
          );
      }
  
      if (this.currentTipoMudanca === TipoMudanca.SOLO) {
            console.debug('[MUT][Validators] applying SOLO validators');
            // Replicados
            this.setValidators('tipoFator', [Validators.required]);
            this.setValidators('usoAnterior', [Validators.required]);
            this.setValidators('usoAtual', [Validators.required]);
            // Independentes
            this.setValidators('referencia', [Validators.required]);
            ['fatorEmissao','soloLAC','soloArenoso'].forEach(f => this.setValidators(f, [this.dec6Validator()]));

            const tipoFatorSolo = this.mutForm.get('tipoFator')?.value;

            // Correção: usar TipoFatorSolo (não TipoMudanca)
            if (tipoFatorSolo === this.TipoFatorSolo.USO_ANTERIOR_ATUAL || tipoFatorSolo === 'USO_ANTERIOR_ATUAL') {
                // USO_ANTERIOR_ATUAL: exige fatorEmissao, LAC/Arenoso opcionais
                this.setValidators('fatorEmissao', [Validators.required, this.dec6Validator()]);
                this.setValidators('soloLAC', [this.dec6Validator()]);
                this.setValidators('soloArenoso', [this.dec6Validator()]);
            } else if (tipoFatorSolo === this.TipoFatorSolo.SOLO_USO_ANTERIOR_ATUAL || tipoFatorSolo === 'SOLO_USO_ANTERIOR_ATUAL') {
                // SOLO_USO_ANTERIOR_ATUAL: exige ao menos LAC (Arenoso opcional); fatorEmissao opcional
                this.setValidators('fatorEmissao', [this.dec6Validator()]);
                this.setValidators('soloLAC', [Validators.required, this.dec6Validator()]);
                this.setValidators('soloArenoso', [this.dec6Validator()]);
            }
        }
  
      // Atualiza validade após redefinir/aplicar
      Object.keys(this.mutForm.controls).forEach(k => this.mutForm.get(k)?.updateValueAndValidity({ emitEvent: false }));
      console.debug('[MUT][Validators] controls updated');
  }

  private setValidators(field: string, validators: any[]): void {
    const c = this.mutForm.get(field);
    if (!c) return;
    c.setValidators(validators);
  }

  private usoComboValidator(): ValidatorFn {
    return (group: AbstractControl) => {
      const tipo = group.get('tipoMudanca')?.value;
      if (tipo !== TipoMudanca.SOLO) return null;
      const anterior = group.get('usoAnterior')?.value;
      const atual = group.get('usoAtual')?.value;
      if (!anterior || !atual) return null;
      const allowed = this.usoAtualMap[anterior] || [];
      return allowed.includes(atual) ? null : { invalidUsoCombo: true };
    };
  }

  private ufConditionalValidator(): ValidatorFn {
    return (control: AbstractControl) => {
      const v = this.mutForm?.get('valorUnico')?.value;
      const ufs = control.value;
      if (v === true || v === 'true') return null;
      if ((v === false || v === 'false') && (!ufs || !Array.isArray(ufs) || ufs.length === 0)) {
        return { ufRequired: true };
      }
      return null;
    };
  }

  private categoriaValidator(): ValidatorFn {
    return (control: AbstractControl) => {
      if (this.currentTipoMudanca !== TipoMudanca.VEGETACAO) return null;
      const v = control?.value;
      return Array.isArray(v) && v.length > 0 ? null : { required: true };
    };
  }

  private dec6Validator(): ValidatorFn {
    const REGEX = /^-?\d+(\.\d{1,6})?$/;
    return (control: AbstractControl) => {
      const v = control.value;
      if (v === null || v === '' || v === undefined) return null;
      return REGEX.test(String(v).replace(',', '.')) ? null : { dec6: true };
    };
  }

  private markFormGroupTouched(): void {
    Object.keys(this.mutForm.controls).forEach(key => this.mutForm.get(key)?.markAsTouched());
  }

  isFieldInvalid(fieldName: string): boolean {
    const f = this.mutForm.get(fieldName);
    return !!(f && f.invalid && (f.dirty || f.touched));
  }

  getFieldError(controlOrName: string | AbstractControl | null | undefined): string {
    const field = typeof controlOrName === 'string' ? this.mutForm.get(controlOrName) : controlOrName;
    const errors = field?.errors;
    if (!errors) return '';

    if (errors['required']) return MESSAGES.MUT.VALIDACAO.CAMPO_OBRIGATORIO;
    if (errors['ufRequired']) return 'UFs são obrigatórias quando "Valor único" for "Não"';
    if (errors['minlength']) return MESSAGES.MUT.VALIDACAO.MINIMO_CARACTERES.replace('{min}', errors['minlength'].requiredLength);
    if (errors['maxlength']) return MESSAGES.MUT.VALIDACAO.MAXIMO_CARACTERES.replace('{max}', errors['maxlength'].requiredLength);
    if (errors['min']) return MESSAGES.MUT.VALIDACAO.VALOR_MINIMO.replace('{min}', errors['min'].min);
    if (errors['max']) return MESSAGES.MUT.VALIDACAO.VALOR_MAXIMO.replace('{max}', errors['max'].max);
    if (errors['dec6']) return MESSAGES.MUT.VALIDACAO.DECIMAL_INVALIDO;
    if (errors['invalidUsoCombo']) return MESSAGES.MUT.VALIDACAO.COMBINACAO_USO_INVALIDA;

    return MESSAGES.MUT.VALIDACAO.CAMPO_INVALIDO;
  }

  private notifyFormErrors(): void {
    const invalidFields: string[] = [];
    Object.keys(this.mutForm.controls).forEach((name) => {
      const control = this.mutForm.get(name);
      if (control && control.invalid && (control.dirty || control.touched)) {
        invalidFields.push(name);
      }
    });
    if (invalidFields.length > 0) {
      this.notificationService.warning('Existem campos inválidos no formulário. Verifique os dados informados.');
    }
  }

  // ====================== MULTISELECT – CATEGORIA / UF ======================
  get categoriaOptionsFiltered(): any[] {
    return this.currentTipoMudanca === TipoMudanca.VEGETACAO
      ? this.allCategoriaOptions.filter(c => ['F', 'G', 'OFL'].includes(c.value))
      : this.allCategoriaOptions;
  }

  get categoriasSelecionadas(): string[] {
    return (this.mutForm.get('categoriaFitofisionomia')?.value || []) as string[];
  }
  get categoriaFitofisionomiaDisplay(): string {
    const c = this.categoriasSelecionadas;
    if (c.length === 0) return 'Selecione os itens';
    if (c.length === 1) {
      const option = this.categoriaOptionsFiltered.find(opt => opt.value === c[0]);
      return option ? option.label : c[0];
    }
    return `${c.length} itens selecionados`;
  }
  isCategoriaSelected(v: string): boolean { return this.categoriasSelecionadas.includes(v); }
  toggleAllCategorias(checked: boolean): void {
    const ctrl = this.mutForm.get('categoriaFitofisionomia');
    if (!ctrl) return;
    const all = this.categoriaOptionsFiltered.map(o => o.value);
    ctrl.setValue(checked ? all : []);
    ctrl.markAsDirty();
    ctrl.updateValueAndValidity({ emitEvent: true });
  }
  toggleCategoria(v: string, checked: boolean): void {
    const ctrl = this.mutForm.get('categoriaFitofisionomia');
    if (!ctrl) return;
    const set = new Set<string>(this.categoriasSelecionadas);
    checked ? set.add(v) : set.delete(v);
    ctrl.setValue(Array.from(set));
    ctrl.markAsDirty();
    ctrl.updateValueAndValidity({ emitEvent: true });
  }

  // UF
  get ufsSelecionadas(): string[] {
    return (this.mutForm.get('uf')?.value || []) as string[];
  }
  get ufDisplay(): string {
    const sel = this.ufsSelecionadas;
    return sel.length ? sel.join(', ') : 'Selecione os itens';
  }
  isUfSelected(u: string): boolean { return this.ufsSelecionadas.includes(u); }
  toggleAllUf(checked: boolean): void {
    const ctrl = this.mutForm.get('uf');
    if (!ctrl) return;
    ctrl.setValue(checked ? [...this.ufOptions] : []);
    ctrl.markAsDirty(); ctrl.updateValueAndValidity({ emitEvent: true });
  }
  toggleUf(u: string, checked: boolean): void {
    const ctrl = this.mutForm.get('uf');
    if (!ctrl) return;
    const set = new Set<string>(this.ufsSelecionadas);
    checked ? set.add(u) : set.delete(u);
    ctrl.setValue(Array.from(set));
    ctrl.markAsDirty(); ctrl.updateValueAndValidity({ emitEvent: true });
  }

  // ====================== BUILD REQUEST ======================
  private buildMutRequest(): MutRequest {
    const data = this.mutForm.getRawValue(); // inclui campos desabilitados
    // Garante que o estado independente do escopo atual está salvo
    this.persistIndependentFieldsForScope(this.activeTab);

    const req: MutRequest = {
      tipoMudanca: data.tipoMudanca,
      escopo: data.escopo
    };

    if (data.tipoMudanca === TipoMudanca.DESMATAMENTO) {
      const s = this.desmatScope[this.activeTab];
      const id = this.mode === 'edit' && this.fator?.dadosDesmatamento?.[0]?.id ? this.fator.dadosDesmatamento[0].id : 0;

      // usa exatamente o que está no form (sem forçar valorUnico=true)
      const ufs: string[] = (data.valorUnico === true || data.valorUnico === 'true') ? [] : (data.uf || []);

      const siglaFinal = (s.sigla as any) || (this.siglaOptions?.[0] as any) || SiglaFitofisionomia.AA;
      const catFinal = (s.categoria as any) || (this.categoriaOptions?.[0]?.value as any) || CategoriaDesmatamento.F;

      req.dadosDesmatamento = [{
            id,
            bioma: data.bioma,
            valorUnico: (data.valorUnico === true || data.valorUnico === 'true'),
            ufs: ufs as any,
            nomeFitofisionomia: s.nomeFitofisionomia || 'Auto',
            siglaFitofisionomia: siglaFinal as SiglaFitofisionomia,
            categoriaDesmatamento: catFinal,
            estoqueCarbono: this.castNumber(s.estoqueCarbono),
            fatorCO2: undefined,
            fatorCH4: undefined,
            fatorN2O: undefined
          }];
    }

    if (data.tipoMudanca === TipoMudanca.SOLO) {
      const s = this.soloScope[this.activeTab];
      const existing = this.fator?.dadosSolo ? this.fator.dadosSolo : [];

      const normalizeTipo = (raw: any) => String(raw || '').toUpperCase().trim().replace(/^SOLO_/, '');
      const usoAnt = String(data.usoAnterior || '').trim();
      const usoAt = String(data.usoAtual || '').trim();

      // Preferir main com MESMO tipo e MESMO par de uso; se não houver, cair em tipo; senão, primeiro main
      let existingMain =
        existing.find(r =>
          normalizeTipo(r.tipoFatorSolo) === normalizeTipo(data.tipoFator) &&
          String(r?.usoAnterior || '').trim() === usoAnt &&
          String(r?.usoAtual || '').trim() === usoAt &&
          (r.fatorCO2 == null && r.fatorCH4 == null)
        ) ||
        existing.find(r =>
          normalizeTipo(r.tipoFatorSolo) === normalizeTipo(data.tipoFator) &&
          (r.fatorCO2 == null && r.fatorCH4 == null)
        ) ||
        existing.find(r => (r.fatorCO2 == null && r.fatorCH4 == null));

      const tipoFatorSoloFinal = existingMain?.tipoFatorSolo || data.tipoFator;

      const mainRecord: MutSoloData = {
        id: existingMain?.id || 0,
        tipoFatorSolo: tipoFatorSoloFinal,
        valorFator: this.castNumber(s.fatorEmissao) || 0,
        descricao: s.referencia || '',
        fatorCO2: undefined,
        fatorCH4: undefined,
        fatorN2O: undefined,
        usoAnterior: usoAnt || '',
        usoAtual: usoAt || ''
      };

      req.dadosSolo = [mainRecord];

      if (normalizeTipo(tipoFatorSoloFinal) === normalizeTipo(this.TipoFatorSolo.SOLO_USO_ANTERIOR_ATUAL) ||
          normalizeTipo(tipoFatorSoloFinal) === normalizeTipo(this.TipoFatorSolo.USO_ANTERIOR_ATUAL)) {

        const idLac = existing.find(r => r.fatorCO2 != null)?.id || 0;
        const idAre = existing.find(r => r.fatorCH4 != null)?.id || 0;

        // ✅ Consolidar LAC (CO2) e Arenoso (CH4) em um único item para o par vazio ("", "")
        const auxId = idLac || idAre || 0;
        if (s.soloLAC != null || s.soloArenoso != null) {
          const auxRecord: MutSoloData = {
            id: auxId,
            tipoFatorSolo: tipoFatorSoloFinal,
            valorFator: 0,
            descricao: mainRecord.descricao,
            fatorCO2: s.soloLAC != null ? this.castNumber(s.soloLAC) : undefined,
            fatorCH4: s.soloArenoso != null ? this.castNumber(s.soloArenoso) : undefined,
            fatorN2O: undefined,
            usoAnterior: '',
            usoAtual: ''
          };
          req.dadosSolo.push(auxRecord);
        }
      }

      // ✅ Passo de segurança: deduplicar por (tipoFatorSolo, usoAnterior, usoAtual)
      req.dadosSolo = this.mergeDadosSoloByUso(req.dadosSolo);
    }

    if (data.tipoMudanca === TipoMudanca.VEGETACAO) {
      const v = this.vegetScope[this.activeTab];
      const id = this.mode === 'edit' && this.fator?.dadosVegetacao?.[0]?.id ? this.fator.dadosVegetacao[0].id : 0;
      req.dadosVegetacao = [{
        id,
        categoriasFitofisionomia: (data.categoriaFitofisionomia || []).filter((c: string) => !!c),
        parametro: data.parametro,
        valorAmazonia: this.castNumber(v.amazonia),
        valorCaatinga: this.castNumber(v.caatinga),
        valorCerrado: this.castNumber(v.cerrado),
        valorMataAtlantica: this.castNumber(v.mataAtlantica),
        valorPampa: this.castNumber(v.pampa),
        valorPantanal: this.castNumber(v.pantanal),
        bioma: data.biomaVegetacao || null
      }];
    }

    return req;
  }

  private castNumber(v: any): number | undefined {
    if (v === null || v === undefined || v === '') return undefined;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? Number(n.toFixed(6)) : undefined;
  }

  private mergeDadosSoloByUso(items: MutSoloData[]): MutSoloData[] {
    const map = new Map<string, MutSoloData>();

    for (const item of items) {
      const key = `${String(item.tipoFatorSolo || '')}|${String(item.usoAnterior || '').trim()}|${String(item.usoAtual || '').trim()}`;
      const existing = map.get(key);

      if (!existing) {
        map.set(key, { ...item });
        continue;
      }

      // Mescla preservando valores não nulos: mantém id existente ou o novo, une fatores
      map.set(key, {
        ...existing,
        id: existing.id || item.id || 0,
        valorFator: existing.valorFator || item.valorFator || 0,
        fatorCO2: existing.fatorCO2 ?? item.fatorCO2,
        fatorCH4: existing.fatorCH4 ?? item.fatorCH4,
        fatorN2O: existing.fatorN2O ?? item.fatorN2O,
        descricao: existing.descricao || item.descricao || ''
      });
    }

    return Array.from(map.values());
  }

  // ====================== DUPLICIDADE & SAVE ======================
  private sameUfs(a?: string[], b?: string[]): boolean {
    const sa = (a || []).slice().sort();
    const sb = (b || []).slice().sort();
    if (sa.length !== sb.length) return false;
    for (let i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) return false;
    }
    return true;
  }

  private async validateDuplicateEntry(): Promise<boolean> {
    const data = this.mutForm.getRawValue();
    const escopo = data.escopo as EscopoEnum;
    const tipo = this.currentTipoMudanca;
    const currentId = this.fator?.id;

    const toNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    // SOLO: RN008 por escopo (referência + fatorEmissao + LAC + arenoso)
    if (tipo === TipoMudanca.SOLO) {
      const s = this.soloScope[this.activeTab];
      const tipoFator = String(data.tipoFator || '').trim();
      const referencia = String(s?.referencia || '').trim();
      const fatorEmissao = toNum(s?.fatorEmissao);
      const soloLAC = toNum(s?.soloLAC);
      const soloArenoso = toNum(s?.soloArenoso);

      if (!tipoFator || (!referencia && fatorEmissao == null && soloLAC == null && soloArenoso == null)) {
        return true;
      }

      return await new Promise<boolean>((resolve) => {
        this.mutService.buscarSoloPorRN008(escopo, tipoFator, referencia, fatorEmissao, soloLAC, soloArenoso).subscribe({
          next: (found) => {
            const isDuplicate = !!found && (!currentId || found.id !== currentId);
            if (isDuplicate) {
              this.duplicateExists = true;
              const msg = this.buildDuplicateMessage();
              this.notificationService.warning(`${msg} Registro de Solo já existe neste ${this.getEscopoLabel(escopo)}.`);
              // CRUD de edição automático no caso de duplicidade
              this.tryUpdateExistingOnDuplicate();
              resolve(false);
            } else {
              resolve(true);
            }
          },
          error: () => resolve(true)
        });
      });
    }

    // DESMATAMENTO: valores independentes por escopo (nome + sigla + categoria + estoque) + Bioma+UFs
    if (tipo === TipoMudanca.DESMATAMENTO) {
      const d = this.desmatScope[this.activeTab];
      const nome = String(d?.nomeFitofisionomia || '').trim().toLowerCase();
      const sigla = String(d?.sigla || '').trim().toUpperCase();
      const categoria = String(d?.categoria || '').trim().toUpperCase();
      const estoque = toNum(d?.estoqueCarbono);
      const bioma = data.bioma;
      const ufs = data.uf || [];

      if (!nome && !sigla && !categoria && estoque == null) {
        return true;
      }

      return await new Promise<boolean>((resolve) => {
        this.mutService.listar({ tipoMudanca: TipoMudanca.DESMATAMENTO, escopo, page: 0, size: 500 }).subscribe({
          next: (resp) => {
            const lista = resp?.content || [];
            
            // Check for duplicate by independent fields (nome + sigla + categoria + estoque)
            const dupByFields = lista.find(item => {
              const r = item.dadosDesmatamento?.[0];
              if (!r) return false;
              return (
                String(r.nomeFitofisionomia || '').trim().toLowerCase() === nome &&
                String(r.siglaFitofisionomia || '').trim().toUpperCase() === sigla &&
                String(r.categoriaDesmatamento || '').trim().toUpperCase() === categoria &&
                toNum(r.estoqueCarbono) === estoque
              );
            });
            
            // Check for duplicate by Bioma+UFs (database constraint)
            const dupByBiomaUfs = lista.find(item => {
              const r = item.dadosDesmatamento?.[0];
              if (!r) return false;
              return (
                r.bioma === bioma &&
                this.sameUfs(r.ufs || [], ufs)
              );
            });
            
            const isDuplicateFields = !!dupByFields && (!currentId || dupByFields.id !== currentId);
            const isDuplicateBiomaUfs = !!dupByBiomaUfs && (!currentId || dupByBiomaUfs.id !== currentId);
            
            if (isDuplicateFields) {
              this.duplicateExists = true;
              const msg = this.buildDuplicateMessage();
              this.notificationService.warning(msg);
              this.tryUpdateExistingDesmatOnDuplicate();
              resolve(false);
            } else if (isDuplicateBiomaUfs) {
              this.duplicateExists = true;
              const msg = this.buildDesmatBiomaUfsDuplicateMessage();
              this.notificationService.warning(`${msg}\n\nAtualizando registro existente.`);
              this.tryUpdateExistingDesmatByBiomaUfs(dupByBiomaUfs);
              resolve(false);
            } else {
              resolve(true);
            }
          },
          error: () => resolve(true)
        });
      });
    }

    // VEGETAÇÃO: todos os biomas por escopo
    if (tipo === TipoMudanca.VEGETACAO) {
      const v = this.vegetScope[this.activeTab];
      const vals = [
        toNum(v?.amazonia), toNum(v?.caatinga), toNum(v?.cerrado),
        toNum(v?.mataAtlantica), toNum(v?.pampa), toNum(v?.pantanal)
      ];

      if (vals.every(x => x == null)) {
        return true;
      }

      return await new Promise<boolean>((resolve) => {
        this.mutService.listar({ tipoMudanca: TipoMudanca.VEGETACAO, escopo, page: 0, size: 500 }).subscribe({
          next: (resp) => {
            const lista = resp?.content || [];
            const dup = lista.find(item => {
              const r = item.dadosVegetacao?.[0];
              if (!r) return false;
              const actual = [
                toNum(r.valorAmazonia), toNum(r.valorCaatinga), toNum(r.valorCerrado),
                toNum(r.valorMataAtlantica), toNum(r.valorPampa), toNum(r.valorPantanal)
              ];
              return actual.every((num, idx) => num === vals[idx]);
            });
            const isDuplicate = !!dup && (!currentId || dup.id !== currentId);
            if (isDuplicate) {
              this.duplicateExists = true;
              this.notificationService.warning(`Registro de Vegetação já existe neste ${this.getEscopoLabel(escopo)}.`);
              resolve(false);
            } else {
              resolve(true);
            }
          },
          error: () => resolve(true)
        });
      });
    }

    return true;
  }

  private async checkDuplicateEarly(): Promise<void> {
    this.duplicateExists = false;
    console.debug('[MUT][DuplicateEarly] tipo=', this.currentTipoMudanca, 'escopo=', this.mutForm.get('escopo')?.value, 'duplicateExists=', this.duplicateExists);
  }

  private async performSave(): Promise<void> {
    console.info('[MUT][Save] start | mode=', this.mode, 'escopo=', this.activeTab);

    if (!this.mutForm.valid) {
      console.warn('[MUT][Save] form invalid', { errors: this.mutForm.errors, controls: this.mutForm });
      this.markFormGroupTouched();
      this.notifyFormErrors();
      return;
    }

    // ✅ Validação de duplicidade por escopo antes de salvar
    const canProceed = await this.validateDuplicateEntry();
    if (!canProceed) {
      console.warn('[MUT][Save] bloqueado por duplicidade no escopo.');
      return;
    }

    const mutRequest = this.buildMutRequest();
    console.info('[MUT][Save] request built', mutRequest);

    // Detecta mudança de escopo ao editar: cria um novo fator em vez de atualizar o existente
    const isEscopoChanged = this.mode === 'edit' && this.fator && this.fator.escopo !== mutRequest.escopo;

    const operation = (this.mode === 'create' || isEscopoChanged)
      ? this.mutService.criar(mutRequest)
      : this.mutService.atualizar(this.fator!.id, mutRequest);

    console.info('[MUT][Save] operation=', ((this.mode === 'create' || isEscopoChanged) ? 'POST' : 'PUT'),
                 'url-id=', (isEscopoChanged ? 'new' : this.fator?.id));

    this.isLoading = true;
    operation.subscribe({
      next: (response) => {
        console.info('[MUT][Save] success', response);
        this.isLoading = false;

        if (this.notifyInModal) {
          this.notificationService.success(
            (this.mode === 'create' || isEscopoChanged) ? MESSAGES.MUT.SUCESSO_CRIAR : MESSAGES.MUT.SUCESSO_ATUALIZAR
          );
        }

        this.fator = response;
        // Recarrega mapas para o escopo salvo
        this.populateForm();
        this.save.emit(response);
      },
      error: (err: any) => {
        console.error('[MUT][Save] error raw', err);
        this.isLoading = false;
        this.handleSaveError(err, (isEscopoChanged ? 'update-existing' : this.mode));
      }
    });
  }

  private handleSaveError(error: any, operation: 'edit' | 'create' | 'update-existing'): void {
    console.error('Erro ao salvar fator MUT:', error);

    console.log('➡️ Backend error', {
      status: error?.status,
      codigo: error?.error?.codigo,
      mensagem: error?.error?.mensagem || error?.message,
      idExistente: error?.error?.idExistente,
      raw: error
    });

    const status = error?.status;
    const codigo = error?.codigo || error?.error?.codigo || '';
    const mensagem = (error?.mensagem || error?.error?.mensagem || error?.message || '').toString();

    // Check for DESMATAMENTO Bioma+UFs constraint error first
    if (
      this.currentTipoMudanca === TipoMudanca.DESMATAMENTO &&
      status === 400 &&
      codigo === 'ERRO_VALIDACAO' &&
      (/ux_desm_ufs_escopo|ufs_hash/i.test(mensagem))
    ) {
      const msg = this.buildDesmatBiomaUfsDuplicateMessage();
      this.notificationService.warning(msg);
      return;
    }

    // Sinalização ampla de duplicidade (inclui mensagens/códigos alternativos)
    const isDuplicate409 =
      status === 409 &&
      (
        codigo === 'DADOS_DUPLICADOS' ||
        codigo === 'DUPLICACAO_REGISTRO' ||
        /duplicados|duplicação|RN008|Valores de Solo/i.test(mensagem)
      );

    // ✅ NOVO: tratar também 400 ERRO_VALIDACAO com mensagem de RN008
    const isDuplicate400 =
      status === 400 &&
      (
        codigo === 'ERRO_VALIDACAO' &&
        /Valores de Solo.*já existem neste escopo/i.test(mensagem)
      );

    const isDuplicate = isDuplicate409 || isDuplicate400;

    // Opção 1: 409 com idExistente → PUT direto
    const idExistente = error?.error?.idExistente ?? error?.idExistente;
    if (this.currentTipoMudanca === TipoMudanca.SOLO && isDuplicate && idExistente) {
      this.fator = { id: idExistente, tipoMudanca: this.currentTipoMudanca, escopo: this.activeTab, dadosSolo: this.fator?.dadosSolo || [] } as any;
      this.mode = 'edit';

      const mutRequest = this.buildMutRequest();
      this.mutService.atualizar(idExistente, mutRequest).subscribe({
        next: (resp) => {
          if (this.notifyInModal) {
            this.notificationService.success('Registro de Solo atualizado com LAC/Arenoso.');
          }
          this.save.emit(resp);
          this.onClose();
        },
        error: (err2) => {
          console.error('[MUT][Save] Falha no PUT direto após duplicidade', err2);
          this.notificationService.error('Não foi possível atualizar o registro existente (PUT direto).');
        }
      });
      return;
    }

    // Opção 2: duplicidade sem idExistente → tentar localizar e atualizar
    if (this.currentTipoMudanca === TipoMudanca.SOLO && isDuplicate && !idExistente) {
      console.info('[MUT][Duplicate] Detecção de duplicidade (', status, '/', codigo, ') — tentando buscar registro existente para atualizar...');
      this.tryUpdateExistingOnDuplicate();
      return;
    }

    // RN008/Duplicidade – cobrir 409, RN008_DUPLICIDADE, DADOS_DUPLICADOS e mensagens afins
    if (
      status === 409 ||
      codigo === 'RN008_DUPLICIDADE' ||
      codigo === 'DADOS_DUPLICADOS' ||
      /RN008|DADOS_DUPLICADOS|duplicados/i.test(mensagem)
    ) {
      // Para SOLO, tenta atualizar o registro existente com LAC/Arenoso automaticamente
      if (this.currentTipoMudanca === TipoMudanca.SOLO && operation !== 'update-existing') {
        this.tryUpdateExistingOnDuplicate();
        return;
      }
      // ✅ NOVO: para DESMATAMENTO, tenta atualizar registro existente automaticamente
      if (this.currentTipoMudanca === TipoMudanca.DESMATAMENTO && operation !== 'update-existing') {
        this.tryUpdateExistingDesmatOnDuplicate();
        return;
      }
      const msg = this.buildDuplicateMessage();
      this.notificationService.warning(msg);
      return;
    }

    // Detecta duplicidade vinda como 400/ERRO_VALIDACAO do backend (constraint uq_mut_solo_fator_uso)
    if (status === 400 && codigo === 'ERRO_VALIDACAO' &&
        /uq_mut_solo_fator_uso|duplicate key value violates unique constraint/i.test(mensagem)) {
      const msg = this.buildDuplicateMessage();
      this.notificationService.warning(
        `${msg}\nEdite o registro existente ou altere os valores para salvar.`
      );
      return;
    }

    // Unicidade de tipo+escopo (não permitir alterar escopo via PUT do mesmo id)
    if (status === 400 && codigo === 'ERRO_VALIDACAO' && /tipo.*escopo/i.test(mensagem)) {
      const tipoLabel = this.getTipoMudancaLabel(this.currentTipoMudanca);
      this.notificationService.warning(
        `Já existe um fator de ${tipoLabel} com este escopo. ` +
        `Para salvar no novo escopo, um novo fator será criado. ` +
        `Altere o escopo e confirme para criar outro registro.`
      );
      return;
    }

    // Fallback de erro genérico: mostrar toast contextualizado por tipo
    const genericMsg = this.buildGenericErrorMessage(error);
    this.notificationService.error(genericMsg);
  }

  // ====================== GETTERS / LABELS ======================
  get isEscopo1(): boolean { return this.activeTab === EscopoEnum.ESCOPO1; }
  get isEscopo3(): boolean { return this.activeTab === EscopoEnum.ESCOPO3; }
  get currentTipoMudanca(): TipoMudanca { return this.mutForm.get('tipoMudanca')?.value; }
  get isTipoMudancaDisabled(): boolean { return this.mode === 'edit'; }

  getTipoMudancaLabel(tipo: TipoMudanca): string {
    const labels = {
      [TipoMudanca.SOLO]: 'Solo',
      [TipoMudanca.DESMATAMENTO]: 'Desmatamento',
      [TipoMudanca.VEGETACAO]: 'Vegetação'
    } as const;
    return (labels as any)[tipo] as string;
  }

  getBiomaLabel(bioma: Bioma | string): string {
    const key = String(bioma);
    const byEnumValue: Record<string, string> = {
      [Bioma.AMAZONIA]: 'Amazônia',
      [Bioma.CAATINGA]: 'Caatinga',
      [Bioma.CERRADO]: 'Cerrado',
      [Bioma.MATA_ATLANTICA]: 'Mata Atlântica',
      [Bioma.PAMPA]: 'Pampa',
      [Bioma.PANTANAL]: 'Pantanal'
    };
    const byName: Record<string, string> = {
      AMAZONIA: 'Amazônia',
      CAATINGA: 'Caatinga',
      CERRADO: 'Cerrado',
      MATA_ATLANTICA: 'Mata Atlântica',
      PAMPA: 'Pampa',
      PANTANAL: 'Pantanal'
    };
    return byEnumValue[key] ?? byName[key.toUpperCase()] ?? key;
  }

  onTipoFatorChange(): void { this.applyValidatorsByTipo(); }

  onUsoAnteriorChange(): void {
    this.mutForm.get('usoAtual')?.setValue('');
    this.mutForm.get('usoAtual')?.updateValueAndValidity();
  }

  get usoAtualOptions(): string[] {
    const anterior = this.mutForm.get('usoAnterior')?.value || '';
    return this.usoAtualMap[anterior] || [];
  }

  get isSoloTipoUsoAnteriorAtual(): boolean {
    const tipo = this.mutForm.get('tipoFator')?.value;
    return this.currentTipoMudanca === this.TipoMudanca.SOLO &&
           (tipo === this.TipoFatorSolo.USO_ANTERIOR_ATUAL || tipo === 'USO_ANTERIOR_ATUAL');
  }

  get isSoloTipoSoloUso(): boolean {
    const tipo = this.mutForm.get('tipoFator')?.value;
    return this.currentTipoMudanca === this.TipoMudanca.SOLO &&
           (tipo === this.TipoFatorSolo.SOLO_USO_ANTERIOR_ATUAL || tipo === 'SOLO_USO_ANTERIOR_ATUAL');
  }

  onParametroChange(event: any): void {
    const novoValor = event?.target?.value ?? event;
    const ctrl = this.mutForm.get('parametro');
    ctrl?.setValue(novoValor);
    ctrl?.markAsTouched();
    ctrl?.updateValueAndValidity();
  }

  private getTipoFatorLabel(tipo: TipoFatorSolo | string | null | undefined): string {
    const raw = (typeof tipo === 'string' ? tipo : (tipo as any)) ?? '';
    const key = String(raw).toUpperCase();
    switch (key) {
      case 'USO_ANTERIOR_ATUAL':
      case 'SOLO_USO_ANTERIOR_ATUAL':
        return 'Uso anterior/atual';
      default:
        return key || 'Tipo de fator';
    }
  }

  private getCategoriaLabel(sigla: SiglaFitofisionomia | string | null | undefined): string {
    const key = String(sigla ?? '').toUpperCase();
    switch (key) {
      case 'F': return 'Formação Florestal';
      case 'G': return 'Formação Campestre';
      case 'OFL': return 'Outras Formações Florestais';
      case 'O': return 'Floresta';
      default: return key || 'Categoria da fitofisionomia';
    }
  }

  onValorUnicoChange(): void {
    const valorUnico = this.mutForm.get('valorUnico')?.value;
    const ufControl = this.mutForm.get('uf');

    if (valorUnico === true || valorUnico === 'true') {
      ufControl?.disable({ emitEvent: false });
      ufControl?.setValue([], { emitEvent: false });
      ufControl?.clearValidators();
    } else {
      ufControl?.enable({ emitEvent: false });
      ufControl?.setValidators([this.ufConditionalValidator()]);
    }
    ufControl?.updateValueAndValidity();
  }

  private tryUpdateExistingOnDuplicate(): void {
    const data = this.mutForm.getRawValue();
    const escopo = data.escopo as EscopoEnum;
    const tipoFator = data.tipoFator;
    const usoAnterior = data.usoAnterior;
    const usoAtual = data.usoAtual;

    console.info('[MUT][Duplicate] Tentando atualizar registro existente com LAC/Arenoso', {
      escopo, tipoFator, usoAnterior, usoAtual
    });

    const s = this.soloScope[this.activeTab];
    const referencia = s?.referencia || '';
    const fatorEmissao = this.castNumber(s?.fatorEmissao);
    const soloLAC = this.castNumber(s?.soloLAC);
    const soloArenoso = this.castNumber(s?.soloArenoso);

    this.isLoading = true;

    // ✅ NOVO: primeiro tenta encontrar por RN008 (referência + valores)
    this.mutService.buscarSoloPorRN008(escopo, tipoFator, referencia, fatorEmissao, soloLAC, soloArenoso).subscribe({
      next: (foundByValues) => {
        if (foundByValues && foundByValues.id) {
          this.fator = foundByValues;
          this.mode = 'edit';
          const mutRequest = this.buildMutRequest();

          console.info('[MUT][Duplicate] RN008 encontrado. Atualizando registro existente', { id: foundByValues.id, mutRequest });

          this.mutService.atualizar(foundByValues.id, mutRequest).subscribe({
              next: (resp) => {
                console.info('[MUT][Duplicate] Atualização concluída via RN008', resp);
                this.isLoading = false;
                if (this.notifyInModal) {
                  this.notificationService.success('Registro de Solo atualizado com LAC/Arenoso.');
                }
                this.save.emit(resp);
                this.onClose();
              },
            error: (err) => {
              console.log('➡️ Backend error', {
                status: err?.status,
                codigo: err?.error?.codigo,
                mensagem: err?.error?.mensagem || err?.message,
                idExistente: err?.error?.idExistente,
                raw: err
              });
              console.error('[MUT][Duplicate] Falha ao atualizar via RN008', err);
              // Fallback para busca por usoAnterior/usoAtual
              this.updateByUsoAnteriorAtualFallback(escopo, tipoFator, usoAnterior, usoAtual);
            }
          });
          return;
        }

        // Fallback: buscar por usoAnterior/usoAtual
        this.updateByUsoAnteriorAtualFallback(escopo, tipoFator, usoAnterior, usoAtual);
      },
      error: (err) => {
        console.error('[MUT][Duplicate] Falha na busca RN008', err);
        // Fallback: buscar por usoAnterior/usoAtual
        this.updateByUsoAnteriorAtualFallback(escopo, tipoFator, usoAnterior, usoAtual);
      }
    });
  }

  // ====================== DUPLICIDADE: AUTO-EDIÇÃO PARA DESMATAMENTO ======================
  private tryUpdateExistingDesmatOnDuplicate(): void {
    const data = this.mutForm.getRawValue();
    const escopo = data.escopo as EscopoEnum;

    const d = this.desmatScope[this.activeTab];
    const nome = String(d?.nomeFitofisionomia || '').trim().toLowerCase();
    const sigla = String(d?.sigla || '').trim().toUpperCase();
    const categoria = String(d?.categoria || '').trim().toUpperCase();
    const estoque = this.castNumber(d?.estoqueCarbono);

    this.isLoading = true;

    this.mutService.listar({ tipoMudanca: TipoMudanca.DESMATAMENTO, escopo, page: 0, size: 500 }).subscribe({
      next: (resp) => {
        const lista = resp?.content || [];
        const encontrado = lista.find(item => {
          const r = item.dadosDesmatamento?.[0];
          if (!r) return false;
          return (
            String(r.nomeFitofisionomia || '').trim().toLowerCase() === nome &&
            String(r.siglaFitofisionomia || '').trim().toUpperCase() === sigla &&
            String(r.categoriaDesmatamento || '').trim().toUpperCase() === categoria &&
            this.castNumber(r.estoqueCarbono) === estoque
          );
        });

        if (encontrado && encontrado.id) {
          this.fator = encontrado;
          this.mode = 'edit';
          const mutRequest = this.buildMutRequest();

          this.mutService.atualizar(encontrado.id, mutRequest).subscribe({
            next: (respAtualizado) => {
              this.isLoading = false;
              this.notificationService.success('Registro de Desmatamento atualizado.');
              this.save.emit(respAtualizado);
              this.onClose();
            },
            error: (err2) => {
              this.isLoading = false;
              console.error('[MUT][Duplicate][DESMAT] Falha no PUT após duplicidade', err2);
              this.notificationService.error('Não foi possível atualizar o registro existente (PUT).');
            }
          });
        } else {
          this.isLoading = false;
          this.duplicateExists = true;
          console.info('[MUT][Duplicate][DESMAT] Nenhum registro encontrado para edição automática.');
          // Mostra o toast estruturado com os dados atuais (Bioma/UFs/Valor Único e independentes)
          const msg = this.buildDuplicateMessage();
          this.notificationService.warning(msg);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.duplicateExists = true;
        console.error('[MUT][Duplicate][DESMAT] Falha ao listar para localizar duplicata', err);
        // Em erro, ainda mostramos a mensagem para orientar o usuário
        const msg = this.buildDuplicateMessage();
        this.notificationService.warning(msg);
      }
    });
  }

  private tryUpdateExistingDesmatByBiomaUfs(existingRecord: any): void {
    if (!existingRecord || !existingRecord.id) {
      this.isLoading = false;
      this.notificationService.error('Registro existente não encontrado para atualização.');
      return;
    }

    this.isLoading = true;
    this.fator = existingRecord;
    this.mode = 'edit';
    const mutRequest = this.buildMutRequest();

    this.mutService.atualizar(existingRecord.id, mutRequest).subscribe({
      next: (respAtualizado) => {
        this.isLoading = false;
        this.notificationService.success('Registro de Desmatamento atualizado com novos dados.');
        this.save.emit(respAtualizado);
        this.onClose();
      },
      error: (err2) => {
        this.isLoading = false;
        console.error('[MUT][Duplicate][DESMAT][BiomaUfs] Falha no PUT após duplicidade', err2);
        this.notificationService.error('Não foi possível atualizar o registro existente.');
      }
    });
  }

  private updateByUsoAnteriorAtualFallback(
    escopo: EscopoEnum,
    tipoFator: string,
    usoAnterior: string,
    usoAtual: string
  ): void {
    const s = this.soloScope[this.activeTab];
    const referencia = s?.referencia || '';
    
    this.mutService.buscarSoloPorUsoAnteriorAtual(escopo, tipoFator, usoAnterior, usoAtual, referencia).subscribe({
      next: (found) => {
        if (!found || !found.id) {
          this.duplicateExists = true;
          const msg = this.buildDuplicateMessage();
          this.notificationService.warning(`${msg}\nEdite o registro existente ou altere os valores para salvar.`);
          this.isLoading = false;
          return;
        }

        this.fator = found;
        this.mode = 'edit';

        const mutRequest = this.buildMutRequest();

        console.info('[MUT][Duplicate] Atualizando registro existente (fallback por uso)', { id: found.id, mutRequest });

        this.mutService.atualizar(found.id, mutRequest).subscribe({
          next: (resp) => {
            console.info('[MUT][Duplicate] Atualização concluída (fallback por uso)', resp);
            this.isLoading = false;
            if (this.notifyInModal) {
              this.notificationService.success('Registro de Solo atualizado com LAC/Arenoso.');
            }
            this.save.emit(resp);
            this.onClose();
          },
          error: (err) => {
            console.log('➡️ Backend error', {
              status: err?.status,
              codigo: err?.error?.codigo,
              mensagem: err?.error?.mensagem || err?.message,
              idExistente: err?.error?.idExistente,
              raw: err
            });
            console.error('[MUT][Duplicate] Falha ao atualizar registro existente (fallback por uso)', err);
            this.isLoading = false;
            this.notificationService.error('Não foi possível atualizar o registro existente.');
          }
        });
      },
      error: (err) => {
        console.error('[MUT][Duplicate] Falha na busca de registro existente (fallback por uso)', err);
        this.duplicateExists = true;
        this.isLoading = false;
        const msg = this.buildDuplicateMessage();
        this.notificationService.warning(`${msg}\nNão foi possível localizar o registro existente para atualizar.`);
      }
    });
  }

  // Toast estruturado para DESMATAMENTO (Bioma + UFs / Valor Único)
  private buildDesmatBiomaUfsDuplicateMessage(): string {
    const data = this.mutForm.getRawValue();
    const escopoLabel = this.getEscopoLabel(data.escopo);
    const biomaLabel = this.getBiomaLabel(data.bioma);
    const valorUnico = !!data.valorUnico;
    const ufsSel = Array.isArray(data.uf) ? data.uf : [];
    const ufsDisplay = ufsSel.length ? ufsSel.join(', ') : '—';

    const header = `Registro de Desmatamento já existe neste escopo (${escopoLabel}).`;
    const cause = valorUnico
      ? 'Chave duplicada: Bioma + Valor Único.'
      : 'Chave duplicada: Bioma + UFs.';

    return [
      header,
      cause,
      `- Bioma: ${biomaLabel}`,
      `- Valor Único: ${valorUnico ? 'Sim' : 'Não'}`,
      `- UFs: ${ufsDisplay}`,
      '',
      'Ação sugerida: edite o registro existente ou altere os valores.'
    ].join('\n');
  }

  // Toast estruturado para RN008/Duplicidade por tipo
  private buildDuplicateMessage(): string {
    const data = this.mutForm.getRawValue();
    const escopoLabel = this.getEscopoLabel(data.escopo);

    if (this.currentTipoMudanca === TipoMudanca.SOLO) {
      const tipoLabel = this.getTipoFatorLabel(data.tipoFator);
      const usoAnterior = String(data.usoAnterior || '').trim();
      const usoAtual = String(data.usoAtual || '').trim();
      const referencia = String(this.soloScope[this.activeTab]?.referencia || '').trim();
      const fe = this.castNumber(this.soloScope[this.activeTab]?.fatorEmissao);
      const lac = this.castNumber(this.soloScope[this.activeTab]?.soloLAC);
      const arenoso = this.castNumber(this.soloScope[this.activeTab]?.soloArenoso);

      const lines = [
        `Duplicidade detectada no escopo ${escopoLabel}.`,
        `- Tipo de fator: ${tipoLabel}`,
        `- Uso anterior → uso atual: ${usoAnterior} → ${usoAtual}`,
      ];

      if (referencia || fe !== undefined || lac !== undefined || arenoso !== undefined) {
        lines.push('- Valores informados:');
        if (fe !== undefined) lines.push(`  • Fator de emissão: ${fe}`);
        if (lac !== undefined) lines.push(`  • Solo LAC: ${lac}`);
        if (arenoso !== undefined) lines.push(`  • Solo Arenoso: ${arenoso}`);
        if (referencia) lines.push(`  • Referência: ${referencia}`);
      }

      lines.push('', 'Ação sugerida: editar o registro existente ou ajustar os valores.');
      return lines.join('\n');
    }

    if (this.currentTipoMudanca === TipoMudanca.DESMATAMENTO) {
      const biomaLabel = this.getBiomaLabel(data.bioma);
      const valorUnico = !!data.valorUnico;
      const ufsSel = Array.isArray(data.uf) ? data.uf : [];
      const ufsDisplay = ufsSel.length ? ufsSel.join(', ') : '—';

      const nome = String(this.desmatScope[this.activeTab]?.nomeFitofisionomia || '').trim();
      const sigla = String(this.desmatScope[this.activeTab]?.sigla || '').trim();
      const categoria = String(this.desmatScope[this.activeTab]?.categoria || '').trim();
      const estoque = this.castNumber(this.desmatScope[this.activeTab]?.estoqueCarbono);

      const lines = [
        `Duplicidade detectada no escopo ${escopoLabel}.`,
        `- Bioma: ${biomaLabel}`,
        `- Valor Único: ${valorUnico ? 'Sim' : 'Não'}`,
        `- UFs: ${ufsDisplay}`,
      ];

      if (nome || sigla || categoria || estoque !== undefined) {
        lines.push('- Campos independentes:');
        if (nome) lines.push(`  • Fitofisionomia: ${nome}`);
        if (sigla) lines.push(`  • Sigla: ${sigla}`);
        if (categoria) lines.push(`  • Categoria: ${categoria}`);
        if (estoque !== undefined) lines.push(`  • Estoque de carbono: ${estoque}`);
      }

      lines.push('', 'Ação sugerida: editar o registro existente ou ajustar os valores.');
      return lines.join('\n');
    }

    if (this.currentTipoMudanca === TipoMudanca.VEGETACAO) {
      const parametro = String(data.parametro || '').trim();
      const categorias = this.categoriasSelecionadas;
      const categoriasDisplay = (categorias && categorias.length) ? categorias.join(', ') : '—';

      const lines = [
        `Duplicidade detectada no escopo ${escopoLabel}.`,
        `- Parâmetro: ${parametro || '—'}`,
        `- Categorias da fitofisionomia: ${categoriasDisplay}`,
        '',
        'Ação sugerida: editar o registro existente ou ajustar os valores.'
      ];
      return lines.join('\n');
    }

    return `Duplicidade detectada no escopo ${escopoLabel}. Ajuste os valores ou edite o registro existente.`;
  }

  // Toast estruturado para erros gerais por tipo
  private buildGenericErrorMessage(error: any): string {
    const data = this.mutForm.getRawValue();
    const escopoLabel = this.getEscopoLabel(data.escopo);
    const backendMsg = String(error?.error?.mensagem || error?.error?.message || error?.message || 'Erro desconhecido');

    if (this.currentTipoMudanca === TipoMudanca.SOLO) {
      const tipoLabel = this.getTipoFatorLabel(data.tipoFator);
      const usoAnterior = String(data.usoAnterior || '').trim();
      const usoAtual = String(data.usoAtual || '').trim();
      return [
        `Erro ao salvar Solo (${escopoLabel}).`,
        `- Tipo de fator: ${tipoLabel}`,
        `- Uso anterior → uso atual: ${usoAnterior} → ${usoAtual}`,
        '',
        `Detalhes: ${backendMsg}`
      ].join('\n');
    }

    if (this.currentTipoMudanca === TipoMudanca.DESMATAMENTO) {
      const biomaLabel = this.getBiomaLabel(data.bioma);
      const valorUnico = !!data.valorUnico;
      const ufsSel = Array.isArray(data.uf) ? data.uf : [];
      const ufsDisplay = ufsSel.length ? ufsSel.join(', ') : '—';
      return [
        `Erro ao salvar Desmatamento (${escopoLabel}).`,
        `- Bioma: ${biomaLabel}`,
        `- Valor Único: ${valorUnico ? 'Sim' : 'Não'}`,
        `- UFs: ${ufsDisplay}`,
        '',
        `Detalhes: ${backendMsg}`
      ].join('\n');
    }

    if (this.currentTipoMudanca === TipoMudanca.VEGETACAO) {
      const parametro = String(data.parametro || '').trim();
      const categorias = this.categoriasSelecionadas;
      const categoriasDisplay = (categorias && categorias.length) ? categorias.join(', ') : '—';
      return [
        `Erro ao salvar Vegetação (${escopoLabel}).`,
        `- Parâmetro: ${parametro || '—'}`,
        `- Categorias da fitofisionomia: ${categoriasDisplay}`,
        '',
        `Detalhes: ${backendMsg}`
      ].join('\n');
    }

    return `Erro (${escopoLabel}): ${backendMsg}`;
  }

  private getEscopoLabel(e: EscopoEnum): string {
    return e === EscopoEnum.ESCOPO1 ? 'Escopo 1'
         : e === EscopoEnum.ESCOPO3 ? 'Escopo 3'
         : String(e);
  }
}