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
  MutSoloData,
  MutDesmatamentoData
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
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() fator: MutResponse | null = null;
  @Input() isVisible = false;
  @Input() notifyInModal = false;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<MutResponse>();

  mutForm!: FormGroup;
  activeTab: EscopoEnum = EscopoEnum.ESCOPO1;
  private lastTab: EscopoEnum = EscopoEnum.ESCOPO1;

  // === UI/estado ===
  isCategoriaOpen = false;
  isUfOpen = false;
  isLoading = false;
  isConfirmOpen = false;
  showSaveConfirmModal = false;
  confirmType: 'cancel' | 'save' = 'cancel';
  duplicateExists = false;

  // Guards para evitar loop de tentativas no DESMATAMENTO
  private hasTriedDesmatUpdateById = false;
  private hasTriedDesmatUpdateByBiomaUfs = false;

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

  // Fitofisionomia (Vegetação) – ordem F, G, OFL, O
  private allCategoriaOptions = [
    { value: 'F', label: 'F - Floresta' },
    { value: 'G', label: 'G - Campo' },
    { value: 'OFL', label: 'OFL - Outras Formações Lenhosas' },
    { value: 'O', label: 'O - Outras' }
  ];
  categoriaOptions = [...this.allCategoriaOptions];

  parametroOptions: string[] = [
    'REMOÇÃO de floresta primária (tCO2e/ha/ano)',
    'Percentual de ESTOQUE de floresta secundária remanescente em relação ao carbono inicial (%)',
    'REMOÇÃO de floresta secundária com histórico de floresta (tCO2e/ha/ano)',
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
    'Plantio direto',
    'Pastagem não degradada',
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

  // ====================== LIFECYCLE ======================
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
      tipoMudanca: [{ value: '', disabled: this.mode === 'edit' }, Validators.required],
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
      fatorEmissao: [null, [this.dec6Validator()]],
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

    // Desmatamento
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

    // Solo
    if (this.fator.dadosSolo?.length) {
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

    // Vegetação
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

    // Aplica independentes do escopo atual
    this.loadIndependentFieldsForScope(this.fator.escopo);
    this.mutForm.markAsPristine();
  }

  // ====================== TABS / UI ======================
  onTabChange(escopo: EscopoEnum): void {
    // Salva independentes do escopo anterior
    this.persistIndependentFieldsForScope(this.activeTab);
    this.lastTab = this.activeTab;

    // Troca aba e restaura independentes do novo escopo
    this.activeTab = escopo;
    this.mutForm.patchValue({ escopo }, { emitEvent: true });

    // Aplica o que já temos em memória
    this.loadIndependentFieldsForScope(escopo);

    // Se estiver editando e escopo alvo vazio, tenta buscar do backend (solo/desmat)
    this.maybeFetchSiblingScopeFields(escopo);
  }

  private persistIndependentFieldsForScope(scope: EscopoEnum): void {
    const v = this.mutForm.getRawValue();

    // Solo independentes
    this.soloScope[scope] = {
      fatorEmissao: this.castNumber(v.fatorEmissao) ?? null,
      referencia: v.referencia || '',
      soloLAC: this.castNumber(v.soloLAC) ?? null,
      soloArenoso: this.castNumber(v.soloArenoso) ?? null
    };

    // Desmatamento independentes
    this.desmatScope[scope] = {
      nomeFitofisionomia: v.nomeFitofisionomia || '',
      sigla: v.sigla || '',
      categoria: v.categoria || '',
      estoqueCarbono: this.castNumber(v.estoqueCarbono) ?? null
    } as any;

    // Vegetação independentes
    this.vegetScope[scope] = {
      amazonia: this.castNumber(v.amazonia) ?? null,
      caatinga: this.castNumber(v.caatinga) ?? null,
      cerrado: this.castNumber(v.cerrado) ?? null,
      mataAtlantica: this.castNumber(v.mataAtlantica) ?? null,
      pampa: this.castNumber(v.pampa) ?? null,
      pantanal: this.castNumber(v.pantanal) ?? null
    };
  }

  private loadIndependentFieldsForScope(scope: EscopoEnum): void {
    // Solo
    const solo = this.soloScope[scope];
    this.mutForm.patchValue({
      fatorEmissao: solo.fatorEmissao,
      referencia: solo.referencia,
      soloLAC: solo.soloLAC,
      soloArenoso: solo.soloArenoso
    }, { emitEvent: false });

    // Desmatamento
    const des = this.desmatScope[scope];
    this.mutForm.patchValue({
      nomeFitofisionomia: des.nomeFitofisionomia,
      sigla: des.sigla,
      categoria: des.categoria,
      estoqueCarbono: des.estoqueCarbono
    }, { emitEvent: false });

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
  }

  // Pre-fetch SOLO/DESMAT (somente em edição, quando vazio)
  private maybeFetchSiblingScopeFields(scope: EscopoEnum): void {
    if (this.mode !== 'edit') return;

    const isEmptySolo =
      this.soloScope[scope]?.fatorEmissao == null &&
      !this.soloScope[scope]?.referencia &&
      this.soloScope[scope]?.soloLAC == null &&
      this.soloScope[scope]?.soloArenoso == null;

    if (this.currentTipoMudanca === TipoMudanca.SOLO && isEmptySolo) {
      this.loadSoloFromSiblingByUsoAnteriorAtual(scope);
    }

    const isEmptyDesmat =
      !this.desmatScope[scope]?.nomeFitofisionomia &&
      !this.desmatScope[scope]?.sigla &&
      !this.desmatScope[scope]?.categoria &&
      this.desmatScope[scope]?.estoqueCarbono == null;

    if (this.currentTipoMudanca === TipoMudanca.DESMATAMENTO && isEmptyDesmat) {
      this.loadDesmatFromSiblingByBiomaUfs(scope);
    }
  }

  private loadDesmatFromSiblingByBiomaUfs(scope: EscopoEnum): void {
    const data = this.mutForm.getRawValue();
    const bioma = data.bioma;
    const valorUnico = (data.valorUnico === true || data.valorUnico === 'true');
    const ufsSel = Array.isArray(data.uf) ? data.uf : [];

    if (!bioma) {
      this.desmatScope[scope] = { nomeFitofisionomia: '', sigla: '' as any, categoria: '' as any, estoqueCarbono: null };
      this.loadIndependentFieldsForScope(scope);
      return;
    }

    this.mutService.listar({ tipoMudanca: TipoMudanca.DESMATAMENTO, escopo: scope, page: 0, size: 500 }).subscribe({
      next: (resp) => {
        const lista = resp?.content || [];
        const encontrado = lista.find(item => {
          const r = item.dadosDesmatamento?.[0];
          if (!r) return false;
          const matchBioma = r.bioma === bioma;
          const matchVu = !!r.valorUnico === valorUnico;
          const matchUfs = valorUnico ? true : this.sameUfs(r.ufs || [], ufsSel);
          return matchBioma && matchVu && matchUfs;
        });

        if (encontrado) {
          const r: MutDesmatamentoData | undefined = encontrado.dadosDesmatamento?.[0];
          this.desmatScope[scope] = {
            nomeFitofisionomia: String(r?.nomeFitofisionomia || ''),
            sigla: (this.normalizeSiglaToOption(r?.siglaFitofisionomia) || '') as any,
            categoria: (r?.categoriaDesmatamento || '') as any,
            estoqueCarbono: this.castNumber(r?.estoqueCarbono) ?? null
          } as any;
        } else {
          this.desmatScope[scope] = { nomeFitofisionomia: '', sigla: '' as any, categoria: '' as any, estoqueCarbono: null };
        }

        this.loadIndependentFieldsForScope(scope);
      },
      error: () => {
        this.desmatScope[scope] = { nomeFitofisionomia: '', sigla: '' as any, categoria: '' as any, estoqueCarbono: null };
        this.loadIndependentFieldsForScope(scope);
      }
    });
  }

  private loadSoloFromSiblingByUsoAnteriorAtual(scope: EscopoEnum): void {
    const data = this.mutForm.getRawValue();
    const tipoFator = data.tipoFator;
    const usoAnterior = String(data.usoAnterior || '').trim();
    const usoAtual = String(data.usoAtual || '').trim();

    if (!tipoFator || !usoAnterior || !usoAtual) {
      this.soloScope[scope] = { fatorEmissao: null, referencia: '', soloLAC: null, soloArenoso: null };
      this.loadIndependentFieldsForScope(scope);
      return;
    }

    this.mutService.buscarSoloPorUsoAnteriorAtual(scope, tipoFator, usoAnterior, usoAtual).subscribe({
      next: (item) => {
        if (!item || !item.dadosSolo?.length) {
          this.soloScope[scope] = { fatorEmissao: null, referencia: '', soloLAC: null, soloArenoso: null };
          this.loadIndependentFieldsForScope(scope);
          return;
        }

        const dados = item.dadosSolo || [];

        const main = dados.find((r: any) =>
          String(r?.usoAnterior || '').trim() === usoAnterior &&
          String(r?.usoAtual || '').trim() === usoAtual &&
          r?.fatorCO2 == null && r?.fatorCH4 == null
        ) || dados[0];

        const referencia = String(main?.descricao || '').trim();
        const fatorEmissao = this.castNumber(main?.valorFator) ?? null;

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
    const isValid = await this.validateDuplicateEntry();
    if (!isValid) return;
    this.openConfirm('save');
  }

  // ====================== VALIDADORES / HELPERS ======================
  private applyValidatorsByTipo(): void {
    const tipoAtual = this.currentTipoMudanca;

    // 1) Limpa TODOS os validadores antes de aplicar os do tipo atual
    Object.keys(this.mutForm.controls).forEach(k => this.mutForm.get(k)?.clearValidators());

    // Campos sempre obrigatórios
    this.setValidators('tipoMudanca', [Validators.required]);
    this.setValidators('escopo', [Validators.required]);

    if (tipoAtual === TipoMudanca.DESMATAMENTO) {
      // Replicados
      this.setValidators('bioma', [Validators.required]);
      this.setValidators('valorUnico', [Validators.required]);
      this.setValidators('uf', [this.ufConditionalValidator()]);
      // Independentes
      this.setValidators('nomeFitofisionomia', [Validators.required]);
      this.setValidators('sigla', [Validators.required]);
      this.setValidators('categoria', [Validators.required]);
      this.setValidators('estoqueCarbono', [Validators.required, this.dec6Validator()]);
    }

    if (tipoAtual === TipoMudanca.VEGETACAO) {
      // Replicados
      this.setValidators('parametro', [Validators.required]);
      this.setValidators('categoriaFitofisionomia', [this.categoriaValidator()]);
      // Independentes
      ['amazonia','caatinga','cerrado','mataAtlantica','pampa','pantanal'].forEach(f =>
        this.setValidators(f, [this.dec6Validator()])
      );
    }

    if (tipoAtual === TipoMudanca.SOLO) {
      // Replicados
      this.setValidators('tipoFator', [Validators.required]);
      this.setValidators('usoAnterior', [Validators.required]);
      this.setValidators('usoAtual', [Validators.required]);
      // Independentes
      this.setValidators('referencia', [Validators.required]);
      ['fatorEmissao','soloLAC','soloArenoso'].forEach(f => this.setValidators(f, [this.dec6Validator()]));

      const tipoFatorSolo = this.mutForm.get('tipoFator')?.value;

      // Regras específicas para TipoFatorSolo
      if (tipoFatorSolo === this.TipoFatorSolo.USO_ANTERIOR_ATUAL || tipoFatorSolo === 'USO_ANTERIOR_ATUAL') {
        this.setValidators('fatorEmissao', [Validators.required, this.dec6Validator()]);
        this.setValidators('soloLAC', [this.dec6Validator()]);
        this.setValidators('soloArenoso', [this.dec6Validator()]);
      } else if (tipoFatorSolo === this.TipoFatorSolo.SOLO_USO_ANTERIOR_ATUAL || tipoFatorSolo === 'SOLO_USO_ANTERIOR_ATUAL') {
        this.setValidators('fatorEmissao', [this.dec6Validator()]);
        this.setValidators('soloLAC', [Validators.required, this.dec6Validator()]);
        this.setValidators('soloArenoso', [this.dec6Validator()]);
      }
    }

    // Atualiza validade
    Object.keys(this.mutForm.controls).forEach(k => this.mutForm.get(k)?.updateValueAndValidity({ emitEvent: false }));
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
    const data = this.mutForm.getRawValue();
    this.persistIndependentFieldsForScope(this.activeTab);

    // ao editar e mudar de escopo, criamos um novo fator (filhos sem reaproveitar IDs)
    const isCrossScopeCreate = this.mode === 'edit' && this.fator?.escopo !== this.activeTab;

    const req: MutRequest = {
      tipoMudanca: data.tipoMudanca,
      escopo: data.escopo
    };

    if (data.tipoMudanca === TipoMudanca.DESMATAMENTO) {
      const s = this.desmatScope[this.activeTab];
      // 🔧 FIX principal: pinna o id correto do filho que corresponde ao Bioma/ValorÚnico/UFs do formulário
      const existingChildId = (this.mode === 'edit') ? this.getExistingDesmatChildIdForForm() : 0;
      const id = isCrossScopeCreate ? 0 : existingChildId;

      req.dadosDesmatamento = [{
        id,
        bioma: data.bioma,
        valorUnico: (data.valorUnico === true || data.valorUnico === 'true'),
        ufs: ((data.valorUnico === true || data.valorUnico === 'true') ? [] : (data.uf || [])) as any,
        nomeFitofisionomia: s.nomeFitofisionomia,
        siglaFitofisionomia: s.sigla as SiglaFitofisionomia,
        categoriaDesmatamento: s.categoria as CategoriaDesmatamento,
        estoqueCarbono: this.castNumber(s.estoqueCarbono),
        fatorCO2: undefined,
        fatorCH4: undefined,
        fatorN2O: undefined
      }];
    }

    if (data.tipoMudanca === TipoMudanca.SOLO) {
      const s = this.soloScope[this.activeTab];
      const existing = isCrossScopeCreate ? [] : (this.fator?.dadosSolo ? this.fator.dadosSolo : []);

      const normalizeTipo = (raw: any) => String(raw || '').toUpperCase().trim().replace(/^SOLO_/, '');
      const usoAnt = String(data.usoAnterior || '').trim();
      const usoAt = String(data.usoAtual || '').trim();

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
        id: isCrossScopeCreate ? 0 : (existingMain?.id || 0),
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

        const idLac = isCrossScopeCreate ? 0 : (existing.find(r => r.fatorCO2 != null)?.id || 0);
        const idAre = isCrossScopeCreate ? 0 : (existing.find(r => r.fatorCH4 != null)?.id || 0);

        const auxId = isCrossScopeCreate ? 0 : (idLac || idAre || 0);
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

      req.dadosSolo = this.mergeDadosSoloByUso(req.dadosSolo);
    }

    if (data.tipoMudanca === TipoMudanca.VEGETACAO) {
      const v = this.vegetScope[this.activeTab];
      const existingId = (this.mode === 'edit' && this.fator?.dadosVegetacao?.[0]?.id) ? this.fator.dadosVegetacao[0].id : 0;
      const id = isCrossScopeCreate ? 0 : existingId;

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

  // 🔎 Seleciona o id do filho de Desmatamento correspondente ao Bioma/ValorÚnico/UFs atuais
  private getExistingDesmatChildIdForForm(): number {
    if (!this.fator?.dadosDesmatamento?.length) return 0;

    const data = this.mutForm.getRawValue();
    const bioma = data.bioma;
    const valorUnico = (data.valorUnico === true || data.valorUnico === 'true');
    const ufsSel: string[] = Array.isArray(data.uf) ? data.uf : [];

    const match = this.fator.dadosDesmatamento.find(r =>
      r.bioma === bioma &&
      (!!r.valorUnico === valorUnico) &&
      (valorUnico ? true : this.sameUfs(r.ufs || [], ufsSel))
    );

    // fallback para o primeiro filho se não achar correspondência exata
    return (match?.id ?? this.fator.dadosDesmatamento[0].id) || 0;
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
    const sa = (a || []).map(x => String(x)).slice().sort();
    const sb = (b || []).map(x => String(x)).slice().sort();
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

    // SOLO — checagem antecipada (somente create)
    if (tipo === TipoMudanca.SOLO) {
      const usoAnterior = String(this.mutForm.get('usoAnterior')?.value || '').trim();
      const usoAtual = String(this.mutForm.get('usoAtual')?.value || '').trim();

      if (this.mode === 'edit' || !usoAnterior || !usoAtual) return true;

      const normalizeTipo = (raw: any) => String(raw || '').toUpperCase().trim().replace(/^SOLO_/, '');
      const tipoFatorSel = normalizeTipo(this.mutForm.get('tipoFator')?.value);

      const isOk = await new Promise<boolean>((resolve) => {
        this.mutService.listar({ tipoMudanca: TipoMudanca.SOLO, escopo, page: 0, size: 500 }).subscribe({
          next: (resp) => {
            const lista = resp?.content || [];
            const found = lista.find(item => {
              const main = (item.dadosSolo || []).find(r =>
                String(r?.usoAnterior || '').trim().toLowerCase() === usoAnterior.toLowerCase() &&
                String(r?.usoAtual || '').trim().toLowerCase() === usoAtual.toLowerCase() &&
                (r?.fatorCO2 == null && r?.fatorCH4 == null) &&
                normalizeTipo(r?.tipoFatorSolo) === tipoFatorSel
              );
              return !!main;
            });

            if (found) {
              this.duplicateExists = true;
              const msg = this.buildDuplicateMessage();
              this.notificationService.warning(`${msg} Já existe registro de Solo com o mesmo Tipo de fator + Uso anterior/atual neste ${this.getEscopoLabel(escopo)}.`);
              resolve(false);
            } else {
              resolve(true);
            }
          },
          error: () => resolve(true)
        });
      });

      return isOk;
    }

    // DESMATAMENTO — validação de duplicidade desabilitada no front
    if (tipo === TipoMudanca.DESMATAMENTO) {
      return true;
    }

    // VEGETAÇÃO — validação de duplicidade: apenas no modo "create"
    if (tipo === TipoMudanca.VEGETACAO) {
      if (this.mode !== 'create') return true; // skip on edit

      const escopoAtual: EscopoEnum = escopo;
      const escopoIrmao: EscopoEnum = escopoAtual === EscopoEnum.ESCOPO1 ? EscopoEnum.ESCOPO3 : EscopoEnum.ESCOPO1;

      const parametro = String(data.parametro || '').trim();
      const categoriasSel: string[] = Array.isArray(data.categoriaFitofisionomia)
        ? (data.categoriaFitofisionomia as any[]).filter((c: any) => !!c).map(c => String(c))
        : [];

      if (!parametro || categoriasSel.length === 0) {
        return true;
      }

      const mesmaChave = (item: any) => {
        const dv = item?.dadosVegetacao?.[0];
        if (!dv) return false;
        const paramsIgual = String(dv.parametro || '').trim() === parametro;
        const catsItem = Array.isArray(dv.categoriasFitofisionomia) ? dv.categoriasFitofisionomia.slice().map((c: any) => String(c)).sort() : [];
        const catsSel = categoriasSel.slice().sort();
        const catsIgual = JSON.stringify(catsItem) === JSON.stringify(catsSel);
        return paramsIgual && catsIgual;
      };

      const checaNoEscopo = (e: EscopoEnum) => new Promise<boolean>((resolve) => {
        this.mutService.listar({ tipoMudanca: TipoMudanca.VEGETACAO, escopo: e, page: 0, size: 500 }).subscribe({
          next: (resp) => {
            const lista = resp?.content || [];
            const dup = lista.find(mesmaChave);
            const isDup = !!dup && (!currentId || dup.id !== currentId);
            resolve(isDup);
          },
          error: () => resolve(false)
        });
      });

      const dupAtual = await checaNoEscopo(escopoAtual);
      const dupIrmao = await checaNoEscopo(escopoIrmao);

      if (dupAtual || dupIrmao) {
        this.duplicateExists = true;
        const msg = this.buildVegetacaoDuplicateMessage();
        this.notificationService.warning(msg);
        return false;
      }

      return true;
    }

    return true;
  }

  private async checkDuplicateEarly(): Promise<void> {
    this.duplicateExists = false;
  }

  private async performSave(): Promise<void> {
    if (!this.mutForm.valid) {
      this.markFormGroupTouched();
      this.notifyFormErrors();
      return;
    }

    const canProceed = await this.validateDuplicateEntry();
    if (!canProceed) return;

    // Tipo atual e mudança de escopo calculada do formulário
    const tipoAtual = this.currentTipoMudanca;
    const escopoForm = this.mutForm.get('escopo')?.value as EscopoEnum;
    const isEscopoChanged =
      this.mode === 'edit' &&
      this.fator &&
      this.fator.escopo !== escopoForm;

    // === DESMATAMENTO: evitar POST quando há mudança de escopo (mitigar 500/ux_desm_ufs_escopo) ===
    if (tipoAtual === TipoMudanca.DESMATAMENTO && isEscopoChanged) {
      const data = this.mutForm.getRawValue();
      const bioma = data.bioma;
      const valorUnico = (data.valorUnico === true || data.valorUnico === 'true');
      const ufsSel: string[] = Array.isArray(data.uf) ? data.uf : [];

      this.isLoading = true;

      this.mutService.listar({
        tipoMudanca: TipoMudanca.DESMATAMENTO,
        escopo: escopoForm,
        page: 0,
        size: 500
      }).subscribe({
        next: (resp) => {
          const lista = resp?.content || [];
          const found = lista.find(item => {
            const r = item.dadosDesmatamento?.[0];
            if (!r) return false;
            const matchBioma = r.bioma === bioma;
            const matchVu = !!r.valorUnico === valorUnico;
            const matchUfs = valorUnico ? true : this.sameUfs(r.ufs || [], ufsSel);
            return matchBioma && matchVu && matchUfs;
          });

          if (found && found.id) {
            // Atualiza o existente no escopo alvo (PUT), evitando POST + replicação
            this.activeTab = escopoForm;
            this.mutForm.patchValue({ escopo: escopoForm }, { emitEvent: false });
            this.fator = found;
            this.mode = 'edit';

            const mutRequest = this.buildMutRequest();
            this.mutService.atualizar(found.id, mutRequest).subscribe({
              next: (response) => {
                this.isLoading = false;
                if (this.notifyInModal) {
                  this.notificationService.success(MESSAGES.MUT.SUCESSO_ATUALIZAR);
                }
                this.fator = response;
                this.populateForm();
                this.save.emit(response);
              },
              error: (err) => {
                this.isLoading = false;
                this.handleSaveError(err, 'update-existing');
              }
            });
          } else {
            // Sem registro igual no escopo alvo → criar normalmente
            const mutRequest = this.buildMutRequest();
            this.mutService.criar(mutRequest).subscribe({
              next: (response) => {
                this.isLoading = false;
                if (this.notifyInModal) {
                  this.notificationService.success(MESSAGES.MUT.SUCESSO_CRIAR);
                }
                this.fator = response;
                this.populateForm();
                this.save.emit(response);
              },
              error: (err) => {
                this.isLoading = false;
                this.handleSaveError(err, 'create');
              }
            });
          }
        },
        error: () => {
          // Se falhar a listagem, prioriza PUT para evitar POST que dispara replicação
          const mutRequest = this.buildMutRequest();
          this.mutService.atualizar(this.fator!.id, mutRequest).subscribe({
            next: (response) => {
              this.isLoading = false;
              if (this.notifyInModal) {
                this.notificationService.success(MESSAGES.MUT.SUCESSO_ATUALIZAR);
              }
              this.fator = response;
              this.populateForm();
              this.save.emit(response);
            },
            error: (err) => {
              this.isLoading = false;
              this.handleSaveError(err, 'edit');
            }
          });
        }
      });

      // Não seguir o fluxo padrão quando DESMATAMENTO mudou de escopo
      return;
    }

    // === Fluxo padrão (SOLO/VEGETAÇÃO, ou DESMATAMENTO sem mudança de escopo) ===
    const mutRequest = this.buildMutRequest();
    const operation = (this.mode === 'create' || isEscopoChanged)
      ? this.mutService.criar(mutRequest)
      : this.mutService.atualizar(this.fator!.id, mutRequest);

    this.isLoading = true;
    operation.subscribe({
      next: (response) => {
        this.isLoading = false;

        if (this.notifyInModal) {
          this.notificationService.success(
            (this.mode === 'create' || isEscopoChanged) ? MESSAGES.MUT.SUCESSO_CRIAR : MESSAGES.MUT.SUCESSO_ATUALIZAR
          );
        }

        this.fator = response;
        this.populateForm();
        this.save.emit(response);
      },
      error: (err: any) => {
        this.isLoading = false;
        this.handleSaveError(err, (isEscopoChanged ? 'update-existing' : this.mode));
      }
    });
  }

  // ===== Novo helper: procura registro de Desmatamento por Bioma/ValorÚnico/UFs nos 2 escopos =====
  private findExistingDesmatByBiomaUfsAcrossScopes(
    bioma: Bioma | string,
    valorUnico: boolean,
    ufs: string[],
    escopoPreferido: EscopoEnum
  ): Promise<any | null> {
    const checkIn = (e: EscopoEnum) => new Promise<any | null>((resolve) => {
      this.mutService.listar({ tipoMudanca: TipoMudanca.DESMATAMENTO, escopo: e, page: 0, size: 500 }).subscribe({
        next: (resp) => {
          const lista = resp?.content || [];
          const found = lista.find(item => {
            const r = item.dadosDesmatamento?.[0];
            if (!r) return false;
            const matchBioma = r.bioma === bioma;
            const matchVu = !!r.valorUnico === valorUnico;
            const matchUfs = valorUnico ? true : this.sameUfs(r.ufs || [], ufs);
            return matchBioma && matchVu && matchUfs;
          });
          resolve(found || null);
        },
        error: () => resolve(null)
      });
    });

    const escopoIrmao = escopoPreferido === EscopoEnum.ESCOPO1 ? EscopoEnum.ESCOPO3 : EscopoEnum.ESCOPO1;

    return new Promise(async (resolve) => {
      const a = await checkIn(escopoPreferido);
      if (a) return resolve(a);
      const b = await checkIn(escopoIrmao);
      resolve(b);
    });
  }

  private handleSaveError(error: any, operation: 'edit' | 'create' | 'update-existing'): void {
    const status = error?.status;
    const codigo = error?.codigo || error?.error?.codigo || '';
    const mensagem = (error?.mensagem || error?.error?.mensagem || error?.message || error?.statusText || '').toString();
    const idExistente = error?.error?.idExistente ?? error?.idExistente;

    // === DESMATAMENTO: short-circuit se o conflito é com o MESMO registro (evita loop) ===
    const currentMutId = this.fator?.id;
    if (
      this.currentTipoMudanca === TipoMudanca.DESMATAMENTO &&
      status === 409 &&
      (codigo === 'RN008_DUPLICIDADE' || /RN008/i.test(codigo)) &&
      idExistente &&
      idExistente === currentMutId
    ) {
      if (!this.hasTriedDesmatUpdateById) {
        this.hasTriedDesmatUpdateById = true;
        this.mutService.buscarPorId(idExistente).subscribe({
          next: (full) => {
            this.fator = full;
            this.mode = 'edit';
            const mutRequest = this.buildMutRequest(); // agora com o child id correto
            this.mutService.atualizar(idExistente, mutRequest).subscribe({
              next: (resp) => { this.save.emit(resp); this.onClose(); },
              error: (e) => { this.notificationService.warning(this.buildDesmatBiomaUfsDuplicateMessage()); }
            });
          },
          error: () => this.notificationService.warning(this.buildDesmatBiomaUfsDuplicateMessage())
        });
      }
      return;
    }

    // === DESMATAMENTO: 409 RN008 com idExistente → buscar e atualizar ===
    if (
      this.currentTipoMudanca === TipoMudanca.DESMATAMENTO &&
      status === 409 &&
      (codigo === 'RN008_DUPLICIDADE' || /RN008/i.test(codigo)) &&
      idExistente
    ) {
      if (this.hasTriedDesmatUpdateById || operation === 'update-existing') {
        const msg = this.buildDesmatBiomaUfsDuplicateMessage();
        this.notificationService.warning(msg);
        return;
      }
      this.hasTriedDesmatUpdateById = true;

      this.mutService.buscarPorId(idExistente).subscribe({
        next: (existente) => {
          if (existente) {
            this.tryUpdateExistingDesmatByBiomaUfs(existente);
          } else {
            const msg = this.buildDesmatBiomaUfsDuplicateMessage();
            this.notificationService.warning(`${msg}\nNão foi possível localizar o registro existente para atualizar.`);
          }
        },
        error: () => {
          const msg = this.buildDesmatBiomaUfsDuplicateMessage();
          this.notificationService.warning(`${msg}\nNão foi possível localizar o registro existente para atualizar.`);
        }
      });
      return;
    }

    // === DESMATAMENTO: constraint (mensagem SQL) → auto-editar existente ===
    if (
      this.currentTipoMudanca === TipoMudanca.DESMATAMENTO &&
      (/ux_desm_ufs_escopo|ufs_hash/i.test(mensagem))
    ) {
      if (this.hasTriedDesmatUpdateByBiomaUfs || operation === 'update-existing') {
        const msg = this.buildDesmatBiomaUfsDuplicateMessage();
        this.notificationService.warning(msg);
        return;
      }
      this.hasTriedDesmatUpdateByBiomaUfs = true;
      this.recoverDesmatFromBiomaUfsAndUpdate();
      return;
    }

    // === DESMATAMENTO: 500 genérico (ERRO_INTERNO) – tratar como possível duplicidade de UFs ===
    if (
      this.currentTipoMudanca === TipoMudanca.DESMATAMENTO &&
      status === 500 &&
      !this.hasTriedDesmatUpdateByBiomaUfs
    ) {
      this.hasTriedDesmatUpdateByBiomaUfs = true;
      this.recoverDesmatFromBiomaUfsAndUpdate();
      return;
    }

    // VEGETAÇÃO índice único
    if (
      this.currentTipoMudanca === TipoMudanca.VEGETACAO &&
      (/ux_veg_categoria_param_escopo/i.test(mensagem))
    ) {
      const msg = this.buildVegetacaoDuplicateMessage();
      this.notificationService.warning(msg);
      return;
    }

    // duplicidades genéricas
    const isDuplicate409 =
      status === 409 &&
      (
        codigo === 'DADOS_DUPLICADOS' ||
        codigo === 'DUPLICACAO_REGISTRO' ||
        /duplicados|duplicação|RN008|Valores de Solo/i.test(mensagem)
      );

    const isDuplicate400 =
      status === 400 &&
      (
        codigo === 'ERRO_VALIDACAO' &&
        /Valores de Solo.*já existem neste escopo/i.test(mensagem)
      );

    const isDuplicate = isDuplicate409 || isDuplicate400;

    // SOLO com idExistente → atualizar
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
        error: () => {
          this.notificationService.error('Não foi possível atualizar o registro existente (PUT direto).');
        }
      });
      return;
    }

    // DESMATAMENTO com idExistente → atualizar
    if (this.currentTipoMudanca === TipoMudanca.DESMATAMENTO && isDuplicate && idExistente) {
      this.mutService.buscarPorId(idExistente).subscribe({
        next: (found) => {
          this.fator = found;
          this.mode = 'edit';
          const mutRequest = this.buildMutRequest();
          this.mutService.atualizar(idExistente, mutRequest).subscribe({
            next: (resp) => {
              if (this.notifyInModal) {
                this.notificationService.success('Registro de Desmatamento atualizado.');
              }
              this.save.emit(resp);
              this.onClose();
            },
            error: () => {
              this.notificationService.error('Não foi possível atualizar o registro existente (PUT direto).');
            }
          });
        },
        error: () => {
          // Fallback: tenta atualizar mesmo sem carregar totalmente
          this.fator = { id: idExistente, tipoMudanca: this.currentTipoMudanca, escopo: this.activeTab, dadosDesmatamento: this.fator?.dadosDesmatamento || [] } as any;
          this.mode = 'edit';
          const mutRequest = this.buildMutRequest();
          this.mutService.atualizar(idExistente, mutRequest).subscribe({
            next: (resp) => {
              if (this.notifyInModal) {
                this.notificationService.success('Registro de Desmatamento atualizado.');
              }
              this.save.emit(resp);
              this.onClose();
            },
            error: () => {
              this.notificationService.error('Não foi possível atualizar o registro existente (PUT direto).');
            }
          });
        }
      });
      return;
    }

    // SOLO duplicidade sem idExistente → localizar e atualizar
    if (this.currentTipoMudanca === TipoMudanca.SOLO && isDuplicate && !idExistente) {
      this.tryUpdateExistingOnDuplicate();
      return;
    }

    // RN008/Duplicidade genérica
    if (
      status === 409 ||
      codigo === 'RN008_DUPLICIDADE' ||
      codigo === 'DADOS_DUPLICADOS' ||
      /RN008|DADOS_DUPLICADOS|duplicados/i.test(mensagem)
    ) {
      if (this.currentTipoMudanca === TipoMudanca.SOLO && operation !== 'update-existing') {
        this.tryUpdateExistingOnDuplicate();
        return;
      }
      if (this.currentTipoMudanca === TipoMudanca.DESMATAMENTO && operation !== 'update-existing') {
        this.tryUpdateExistingDesmatOnDuplicate();
        return;
      }
      if (this.currentTipoMudanca === TipoMudanca.VEGETACAO) {
        const msg = this.buildVegetacaoDuplicateMessage();
        this.notificationService.warning(msg);
        return;
      }
      const msg = this.buildDuplicateMessage();
      this.notificationService.warning(msg);
      return;
    }

    // Unicidade tipo+escopo
    if (status === 400 && codigo === 'ERRO_VALIDACAO' && /tipo.*escopo/i.test(mensagem)) {
      const tipoLabel = this.getTipoMudancaLabel(this.currentTipoMudanca);
      this.notificationService.warning(
        `Já existe um fator de ${tipoLabel} com este escopo. ` +
        `Para salvar no novo escopo, um novo fator será criado. ` +
        `Altere o escopo e confirme para criar outro registro.`
      );
      return;
    }

    // Fallback
    const genericMsg = this.buildGenericErrorMessage(error);
    this.notificationService.error(genericMsg);
  }

  // ===== Recuperação para 500/constraint no Desmatamento =====
  private recoverDesmatFromBiomaUfsAndUpdate(): void {
    const data = this.mutForm.getRawValue();
    const escopo = data.escopo as EscopoEnum;
    const bioma = data.bioma;
    const valorUnico = (data.valorUnico === true || data.valorUnico === 'true');
    const ufsSel = Array.isArray(data.uf) ? data.uf : [];

    this.findExistingDesmatByBiomaUfsAcrossScopes(bioma, valorUnico, ufsSel, escopo)
      .then((existente) => {
        if (existente) {
          this.tryUpdateExistingDesmatByBiomaUfs(existente);
        } else {
          // Sem localizar (pode estar inativo): ao menos notificar claramente
          const msg = this.buildDesmatBiomaUfsDuplicateMessage();
          this.notificationService.warning(msg);
        }
      })
      .catch(() => {
        const msg = this.buildDesmatBiomaUfsDuplicateMessage();
        this.notificationService.warning(msg);
      });
  }

  // ====================== SOLO: auto-update em duplicidade ======================
  private tryUpdateExistingOnDuplicate(): void {
    const data = this.mutForm.getRawValue();
    const escopo = data.escopo as EscopoEnum;
    const tipoFator = data.tipoFator;
    const usoAnterior = data.usoAnterior;
    const usoAtual = data.usoAtual;

    const s = this.soloScope[this.activeTab];
    const referencia = s?.referencia || '';
    const fatorEmissao = this.castNumber(s?.fatorEmissao);
    const soloLAC = this.castNumber(s?.soloLAC);
    const soloArenoso = this.castNumber(s?.soloArenoso);

    this.isLoading = true;

    this.mutService.buscarSoloPorRN008(escopo, tipoFator, referencia, fatorEmissao, soloLAC, soloArenoso).subscribe({
      next: (foundByValues) => {
        if (foundByValues && foundByValues.id) {
          this.fator = foundByValues;
          this.mode = 'edit';
          const mutRequest = this.buildMutRequest();

          this.mutService.atualizar(foundByValues.id, mutRequest).subscribe({
            next: (resp) => {
              this.isLoading = false;
              if (this.notifyInModal) {
                this.notificationService.success('Registro de Solo atualizado com LAC/Arenoso.');
              }
              this.save.emit(resp);
              this.onClose();
            },
            error: () => {
              // Fallback por uso
              this.updateByUsoAnteriorAtualFallback(escopo, tipoFator, usoAnterior, usoAtual);
            }
          });
          return;
        }

        // Fallback por uso
        this.updateByUsoAnteriorAtualFallback(escopo, tipoFator, usoAnterior, usoAtual);
      },
      error: () => {
        this.updateByUsoAnteriorAtualFallback(escopo, tipoFator, usoAnterior, usoAtual);
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

        this.mutService.atualizar(found.id, mutRequest).subscribe({
          next: (resp) => {
            this.isLoading = false;
            if (this.notifyInModal) {
              this.notificationService.success('Registro de Solo atualizado com LAC/Arenoso.');
            }
            this.save.emit(resp);
            this.onClose();
          },
          error: () => {
            this.isLoading = false;
            this.notificationService.error('Não foi possível atualizar o registro existente.');
          }
        });
      },
      error: () => {
        this.duplicateExists = true;
        this.isLoading = false;
        const msg = this.buildDuplicateMessage();
        this.notificationService.warning(`${msg}\nNão foi possível localizar o registro existente para atualizar.`);
      }
    });
  }

  // ====================== DESMATAMENTO: auto-edição em duplicidade ======================
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
            error: () => {
              this.isLoading = false;
              this.notificationService.error('Não foi possível atualizar o registro existente (PUT).');
            }
          });
        } else {
          this.isLoading = false;
          this.duplicateExists = true;
          const msg = this.buildDuplicateMessage();
          this.notificationService.warning(msg);
        }
      },
      error: () => {
        this.isLoading = false;
        this.duplicateExists = true;
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

    const proceedUpdate = (full: any) => {
      // Garantir que não será tratado como cross-scope create
      const escopo: EscopoEnum = full.escopo as EscopoEnum;
      this.activeTab = escopo;
      this.mutForm.patchValue({ escopo }, { emitEvent: false });

      this.isLoading = true;
      this.fator = full;
      this.mode = 'edit';
      const mutRequest = this.buildMutRequest();

      this.mutService.atualizar(full.id, mutRequest).subscribe({
        next: (respAtualizado) => {
          this.isLoading = false;
          this.notificationService.success('Registro de Desmatamento atualizado com novos dados.');
          this.save.emit(respAtualizado);
          this.onClose();
        },
        error: (err) => {
          this.isLoading = false;
          this.handleSaveError(err, 'update-existing');
        }
      });
    };

    const hasDadosDesmatId = !!existingRecord?.dadosDesmatamento?.[0]?.id;
    if (!hasDadosDesmatId) {
      this.mutService.buscarPorId(existingRecord.id).subscribe({
        next: (full) => proceedUpdate(full || existingRecord),
        error: () => proceedUpdate(existingRecord)
      });
    } else {
      proceedUpdate(existingRecord);
    }
  }

  private switchToSiblingAndLoadExistingDesmat(existingRecord: any): void {
    const escopo: EscopoEnum = existingRecord?.escopo as EscopoEnum;
    if (!escopo) return;

    this.activeTab = escopo;
    this.mutForm.patchValue({ escopo }, { emitEvent: false });
    this.fator = existingRecord;
    this.mode = 'edit';

    const r: MutDesmatamentoData | undefined = existingRecord.dadosDesmatamento?.[0];
    this.desmatScope[escopo] = {
      nomeFitofisionomia: String(r?.nomeFitofisionomia || ''),
      sigla: (this.normalizeSiglaToOption(r?.siglaFitofisionomia) || '') as any,
      categoria: (r?.categoriaDesmatamento || '') as any,
      estoqueCarbono: this.castNumber(r?.estoqueCarbono) ?? null
    } as any;

    this.loadIndependentFieldsForScope(escopo);
  }

  // ====================== Toasts / Labels ======================

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

  private buildVegetacaoDuplicateMessage(): string {
    const data = this.mutForm.getRawValue();
    const escopoLabel = this.getEscopoLabel(data.escopo);
    const parametro = String(data.parametro || '').trim();
    const categorias = this.categoriasSelecionadas;
    const categoriasDisplay = (categorias && categorias.length) ? categorias.join(', ') : '—';

    const v = this.vegetScope[this.activeTab];
    const toLine = (rotulo: string, val: any) => {
      const n = Number(val);
      return Number.isFinite(n) ? `  • ${rotulo}: ${n}` : undefined;
    };

    const lines: string[] = [
      `Registro de Vegetação já existe neste escopo (${escopoLabel}).`,
      `Chave duplicada: Categoria(s) da fitofisionomia + Parâmetro.`,
      `- Parâmetro: ${parametro || '—'}`,
      `- Categorias: ${categoriasDisplay}`,
    ];

    const valores: (string | undefined)[] = [
      toLine('Amazônia', v?.amazonia),
      toLine('Caatinga', v?.caatinga),
      toLine('Cerrado', v?.cerrado),
      toLine('Mata Atlântica', v?.mataAtlantica),
      toLine('Pampa', v?.pampa),
      toLine('Pantanal', v?.pantanal),
    ].filter(Boolean);

    if (valores.length) {
      lines.push('- Valores por Bioma:');
      lines.push(...(valores as string[]));
    }

    lines.push('', 'Ação sugerida: edite o registro existente ou ajuste os valores.');
    return lines.join('\n');
  }

  private buildDuplicateMessage(): string {
    const data = this.mutForm.getRawValue();
    const escopoLabel = this.getEscopoLabel(data.escopo);

    if (this.currentTipoMudanca === TipoMudanca.SOLO) {
      const usoAnterior = String(data.usoAnterior || '').trim();
      const usoAtual = String(data.usoAtual || '').trim();

      const lines = [
        `Duplicidade detectada no escopo ${escopoLabel}.`,
        `- Uso anterior → uso atual: ${usoAnterior} → ${usoAtual}`,
        '',
        'Ação sugerida: editar o registro existente ou ajustar os valores.'
      ];
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

  private buildGenericErrorMessage(error: any): string {
    const data = this.mutForm.getRawValue();
    const escopoLabel = this.getEscopoLabel(data.escopo);
    const backendMsg = String(error?.error?.mensagem || error?.error?.message || error?.message || 'Erro desconhecido');

    if (this.currentTipoMudanca === TipoMudanca.SOLO) {
      const usoAnterior = String(data.usoAnterior || '').trim();
      const usoAtual = String(data.usoAtual || '').trim();
      return [
        `Erro ao salvar Solo (${escopoLabel}).`,
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
    return this.currentTipoMudanca === TipoMudanca.SOLO &&
           (tipo === this.TipoFatorSolo.USO_ANTERIOR_ATUAL || tipo === 'USO_ANTERIOR_ATUAL');
  }

  get isSoloTipoSoloUso(): boolean {
    const tipo = this.mutForm.get('tipoFator')?.value;
    return this.currentTipoMudanca === TipoMudanca.SOLO &&
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
      case 'F': return 'F - Floresta';
      case 'G': return 'G - Campo';
      case 'OFL': return 'OFL - Outras Formações Lenhosas';
      case 'O': return 'O - Outras';
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

  // ====================== Utils ======================
  private normalizeSiglaToOption(sigla: string | null | undefined): SiglaFitofisionomia | '' {
    const v = (sigla ?? '').toString();
    if (!v) return '' as any;
    const found = this.siglaOptions.find(opt => String(opt).toUpperCase() === v.toUpperCase());
    return (found as any) ?? '' as any;
  }

  private getEscopoLabel(e: EscopoEnum): string {
    return e === EscopoEnum.ESCOPO1 ? 'Escopo 1'
         : e === EscopoEnum.ESCOPO3 ? 'Escopo 3'
         : String(e);
  }
}