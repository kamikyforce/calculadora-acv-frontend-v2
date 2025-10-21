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
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() fator: MutResponse | null = null;
  @Input() isVisible = false;
  @Input() notifyInModal = false; // default: quem notifica é o componente pai
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<MutResponse>();

  mutForm!: FormGroup;
  activeTab: EscopoEnum = EscopoEnum.ESCOPO1;

  // === UI/estado ===
  isCategoriaOpen = false;
  isUfOpen = false;
  isLoading = false;
  isConfirmOpen = false;
  showSaveConfirmModal = false;
  confirmType: 'cancel' | 'save' = 'cancel';
  duplicateExists = false; // bloqueio preventivo de duplicidade

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
  // Ordem solicitada: Solo, Desmatamento, Vegetação
  tipoMudancaOptions = [TipoMudanca.SOLO, TipoMudanca.DESMATAMENTO, TipoMudanca.VEGETACAO];
  biomaOptions = Object.values(Bioma);
  ufOptions = Object.values(UF);
  siglaOptions = Object.values(SiglaFitofisionomia);

  // Fitofisionomia (Vegetação) – ordem F, G, OFL (mantém 'O' para telas fora de Vegetação)
  private allCategoriaOptions = [
    { value: 'F', label: 'F - Formação Florestal' },
    { value: 'G', label: 'G - Formação Campestre' },
    { value: 'OFL', label: 'OFL - Outras Formações Florestais' },
    { value: 'O', label: 'O - Floresta' }
  ];

  // Usado por alguns *ngFor antigos (compat)
  categoriaOptions = [
    { value: 'O', label: 'O - Floresta' },
    { value: 'F', label: 'F - Formação Florestal' },
    { value: 'OFL', label: 'OFL - Outras Formações Florestais' },
    { value: 'G', label: 'G - Formação Campestre' }
  ];

  // Parâmetro (Vegetação)
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

  // Uso anterior -> Uso atual (regras corrigidas)
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

    // Regras de negócio corrigidas
    'Vegetação nativa (Cerrado)': ['Plantio direto'], // apenas Plantio direto
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
      this.checkDuplicateEarly(); // prevenção de duplicidade
    });
    this.mutForm.get('tipoFator')?.valueChanges.subscribe(() => this.applyValidatorsByTipo());
    this.mutForm.get('escopo')?.valueChanges.subscribe(() => this.checkDuplicateEarly());

    // Validador de combinação Uso anterior/atual
    this.mutForm.setValidators(this.usoComboValidator());
  }

  // ====================== INIT / POPULATE ======================
  private initializeForm(): void {
    this.mutForm = this.fb.group({
      tipoMudanca: ['', Validators.required],
      escopo: [EscopoEnum.ESCOPO1, Validators.required],

      // Desmatamento
      bioma: [''],
      valorUnico: ['', Validators.required],
      uf: [[]],
      nomeFitofisionomia: [''],
      sigla: [''],
      categoria: [''],
      estoqueCarbono: [null, [this.dec6Validator()]],

      // Solo
      tipoFator: [''],
      usoAnterior: [''],
      usoAtual: [''],
      fatorEmissao: [null, [this.dec6Validator()]],
      referencia: [''],
      soloLAC: [null, [this.dec6Validator()]],
      soloArenoso: [null, [this.dec6Validator()]],

      // Vegetação
      biomaVegetacao: [''],
      categoriaFitofisionomia: [[]],
      parametro: [''],
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

    // ✅ CORREÇÃO: Primeiro definir tipoMudanca e escopo para garantir filtros corretos
    this.mutForm.patchValue({
      tipoMudanca: this.fator.tipoMudanca,
      escopo: this.fator.escopo
    }, { emitEvent: false });

    // ✅ CORREÇÃO: Aplicar validadores ANTES de popular os dados específicos
    this.applyValidatorsByTipo();

    let specificData: any = {};

    // Desmatamento
    if (this.fator.dadosDesmatamento?.length) {
      const d = this.fator.dadosDesmatamento[0];
      specificData = {
        ...specificData,
        bioma: d.bioma,
        valorUnico: d.valorUnico,
        uf: d.ufs || [],
        // ✅ CORREÇÃO: Garantir que os valores não sejam null/undefined
        nomeFitofisionomia: d.nomeFitofisionomia || '',
        sigla: d.siglaFitofisionomia || '',
        categoria: d.categoriaDesmatamento,
        estoqueCarbono: d.estoqueCarbono
      };
    }

    // Solo
    if (this.fator.dadosSolo?.length) {
      let reg = this.fator.dadosSolo
        .filter(r => r.valorFator && r.valorFator > 0)
        .reduce((a, b) => (b.id > a.id ? b : a), this.fator.dadosSolo[0]) || this.fator.dadosSolo[0];

      let tipoFator = reg.tipoFatorSolo || '';
      let fatorEmissao: number | null = reg.valorFator ?? null;
      let soloLAC: number | null | undefined;
      let soloArenoso: number | null | undefined;
      let usoAnterior = '';
      let usoAtual = '';
      let referencia = '';

      if (reg.descricao) {
        const refMatch = reg.descricao.match(/\(([^)]+)\)$/);
        if (refMatch) referencia = refMatch[1];
        const semRef = reg.descricao.replace(/\s*\([^)]+\)$/, '');
        const partes = semRef.split(' -> ');
        if (partes.length === 2) {
          usoAnterior = partes[0].trim();
          usoAtual = partes[1].trim();
        }
      }

      if (tipoFator === 'SOLO_USO_ANTERIOR_ATUAL') {
        const rLac = this.fator.dadosSolo.find(r => r.fatorCO2 !== null && r.fatorCO2 !== undefined);
        const rAre = this.fator.dadosSolo.find(r => r.fatorCH4 !== null && r.fatorCH4 !== undefined);
        soloLAC = rLac?.fatorCO2;
        soloArenoso = rAre?.fatorCH4;
      }

      specificData = {
        ...specificData,
        tipoFator,
        fatorEmissao,
        soloLAC,
        soloArenoso,
        usoAnterior,
        usoAtual,
        referencia
      };
    }

    // Vegetação
    if (this.fator.dadosVegetacao?.length) {
      const d = this.fator.dadosVegetacao[0];
      specificData = {
        ...specificData,
        categoriaFitofisionomia: d.categoriasFitofisionomia || [],
        parametro: d.parametro,
        amazonia: d.valorAmazonia,
        caatinga: d.valorCaatinga,
        cerrado: d.valorCerrado,
        mataAtlantica: d.valorMataAtlantica,
        pampa: d.valorPampa,
        pantanal: d.valorPantanal
      };
    }

    // ✅ CORREÇÃO: Aplicar dados específicos uma única vez
    this.mutForm.patchValue(specificData, { emitEvent: false });
    
    // ✅ CORREÇÃO: Marcar o formulário como pristine após popular
    this.mutForm.markAsPristine();
  }

  // ====================== TABS / UI ======================
  onTabChange(escopo: EscopoEnum): void {
    this.activeTab = escopo;
    this.mutForm.patchValue({ escopo }, { emitEvent: true });
  }

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
  onSubmit(): void {
    if (this.showSaveConfirmModal || this.isLoading) return;
    if (!this.mutForm.valid) {
      this.markFormGroupTouched();
      this.notifyFormErrors();
      return;
    }
    this.openConfirm('save');
  }

  // ====================== VALIDADORES / HELPERS ======================
  private applyValidatorsByTipo(): void {
    const toClear = [
      'bioma','valorUnico','nomeFitofisionomia','sigla','categoria','tipoFator','parametro','biomaVegetacao','uf',
      'categoriaFitofisionomia','amazonia','caatinga','cerrado','mataAtlantica','pampa','pantanal',
      'usoAnterior','usoAtual','referencia','fatorEmissao','soloLAC','soloArenoso'
    ];
    toClear.forEach(name => this.mutForm.get(name)?.clearValidators());

    // Desmatamento
    if (this.currentTipoMudanca === TipoMudanca.DESMATAMENTO) {
      this.setValidators('bioma', [Validators.required]);
      this.setValidators('valorUnico', [Validators.required]);
      this.setValidators('nomeFitofisionomia', [Validators.required]);
      this.setValidators('sigla', [Validators.required]);
      this.setValidators('categoria', [Validators.required]);
      this.setValidators('uf', [this.ufConditionalValidator()]);
    }

    // Vegetação
    if (this.currentTipoMudanca === TipoMudanca.VEGETACAO) {
      this.setValidators('parametro', [Validators.required]);
      this.setValidators('categoriaFitofisionomia', [this.categoriaValidator()]);
      ['amazonia','caatinga','cerrado','mataAtlantica','pampa','pantanal'].forEach(f =>
        this.setValidators(f, [this.dec6Validator()])
      );
    }

    // Solo
    if (this.currentTipoMudanca === TipoMudanca.SOLO) {
      this.setValidators('tipoFator', [Validators.required]);
      this.setValidators('usoAnterior', [Validators.required]);
      this.setValidators('usoAtual', [Validators.required]);
      this.setValidators('referencia', [Validators.required]);

      const tipoFatorValue = this.mutForm.get('tipoFator')?.value;
      ['fatorEmissao','soloLAC','soloArenoso'].forEach(f => this.setValidators(f, [this.dec6Validator()]));

      if (tipoFatorValue === TipoFatorSolo.USO_ANTERIOR_ATUAL || tipoFatorValue === 'USO_ANTERIOR_ATUAL') {
        this.setValidators('fatorEmissao', [Validators.required, this.dec6Validator()]);
      } else if (tipoFatorValue === TipoFatorSolo.SOLO_USO_ANTERIOR_ATUAL || tipoFatorValue === 'SOLO_USO_ANTERIOR_ATUAL') {
        this.setValidators('soloLAC', [Validators.required, this.dec6Validator()]);
        this.setValidators('soloArenoso', [Validators.required, this.dec6Validator()]);
      }
    }

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

  private ufRequiredValidator(): ValidatorFn {
    return (control: AbstractControl) => {
      const ufs = control.value;
      if (!ufs || !Array.isArray(ufs) || ufs.length === 0) return { ufRequired: true };
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

  private getNiceLabel(fieldName: string): string {
    const labels: Record<string, string> = {
      tipoMudanca: 'Tipo de mudança',
      escopo: 'Escopo',
      bioma: 'Bioma',
      valorUnico: 'Valor único',
      uf: 'UF',
      nomeFitofisionomia: 'Nome da fitofisionomia',
      sigla: 'Sigla',
      categoria: 'Categoria',
      estoqueCarbono: 'Estoque de carbono',
      tipoFator: 'Tipo de fator',
      usoAnterior: 'Uso anterior',
      usoAtual: 'Uso atual',
      fatorEmissao: 'Fator de emissão',
      referencia: 'Referência',
      soloLAC: 'Solo LAC',
      soloArenoso: 'Solo arenoso',
      biomaVegetacao: 'Bioma',
      categoriaFitofisionomia: 'Categoria da fitofisionomia',
      parametro: 'Parâmetro',
      amazonia: 'Amazônia',
      caatinga: 'Caatinga',
      cerrado: 'Cerrado',
      mataAtlantica: 'Mata Atlântica',
      pampa: 'Pampa',
      pantanal: 'Pantanal'
    };
    return labels[fieldName] || fieldName;
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
      // ✅ CORREÇÃO: Usar categoriaOptionsFiltered para obter o label correto
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
    // “Selecionar todos”: no HTML, marque/desmarque com base em length === all.length.
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

    const req: MutRequest = {
      tipoMudanca: data.tipoMudanca,
      escopo: data.escopo
    };

    if (data.tipoMudanca === TipoMudanca.DESMATAMENTO) {
      const id = this.mode === 'edit' && this.fator?.dadosDesmatamento?.[0]?.id ? this.fator.dadosDesmatamento[0].id : 0;

      // Defaults strongly typed (avoid null/string unions)
      const defaultSigla: SiglaFitofisionomia =
        (this.siglaOptions && this.siglaOptions.length > 0
          ? (this.siglaOptions[0] as SiglaFitofisionomia)
          : SiglaFitofisionomia.AA);

      const defaultCategoria: CategoriaDesmatamento =
        (this.categoriaOptions && this.categoriaOptions.length > 0
          ? (this.categoriaOptions[0].value as CategoriaDesmatamento)
          : CategoriaDesmatamento.F);

      req.dadosDesmatamento = [{
        id,
        bioma: data.bioma,
        valorUnico: true,
        ufs: [],
        nomeFitofisionomia: 'Auto',
        siglaFitofisionomia: defaultSigla,
        categoriaDesmatamento: defaultCategoria,
        estoqueCarbono: undefined,
        fatorCO2: undefined,
        fatorCH4: undefined,
        fatorN2O: undefined
      }];
    }

    if (data.tipoMudanca === TipoMudanca.SOLO) {
      const existing = this.mode === 'edit' && this.fator?.dadosSolo ? this.fator.dadosSolo : [];
      const valorFatorNumerico = this.castNumber(data.fatorEmissao) || 0;

      let existingMain = existing.find(r =>
        r.tipoFatorSolo === data.tipoFator &&
        (r.fatorCO2 == null && r.fatorCH4 == null)
      );

      const mainRecord: MutSoloData = {
        id: existingMain?.id || 0,
        tipoFatorSolo: data.tipoFator,
        valorFator: valorFatorNumerico,
        descricao: `${data.usoAnterior || ''} -> ${data.usoAtual || ''}${data.referencia ? ` (${data.referencia})` : ''}`,
        fatorCO2: undefined,
        fatorCH4: undefined,
        fatorN2O: undefined
      };

      req.dadosSolo = [mainRecord];

      if (data.tipoFator === 'SOLO_USO_ANTERIOR_ATUAL') {
        const idLac = existing.find(r => r.fatorCO2 != null)?.id || 0;
        const idAre = existing.find(r => r.fatorCH4 != null)?.id || 0;

        if (data.soloLAC != null) {
          req.dadosSolo.push({
            id: idLac,
            tipoFatorSolo: 'SOLO_USO_ANTERIOR_ATUAL',
            valorFator: 0,
            descricao: mainRecord.descricao,
            fatorCO2: this.castNumber(data.soloLAC),
            fatorCH4: undefined, fatorN2O: undefined
          });
        }
        if (data.soloArenoso != null) {
          req.dadosSolo.push({
            id: idAre,
            tipoFatorSolo: 'SOLO_USO_ANTERIOR_ATUAL',
            valorFator: 0,
            descricao: mainRecord.descricao,
            fatorCO2: undefined,
            fatorCH4: this.castNumber(data.soloArenoso),
            fatorN2O: undefined
          });
        }
      }
    }

    if (data.tipoMudanca === TipoMudanca.VEGETACAO) {
      const id = this.mode === 'edit' && this.fator?.dadosVegetacao?.[0]?.id ? this.fator.dadosVegetacao[0].id : 0;
      req.dadosVegetacao = [{
        id,
        categoriasFitofisionomia: (data.categoriaFitofisionomia || []).filter((c: string) => !!c),
        parametro: data.parametro,
        valorAmazonia: this.castNumber(data.amazonia),
        valorCaatinga: this.castNumber(data.caatinga),
        valorCerrado: this.castNumber(data.cerrado),
        valorMataAtlantica: this.castNumber(data.mataAtlantica),
        valorPampa: this.castNumber(data.pampa),
        valorPantanal: this.castNumber(data.pantanal),
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

  // ====================== DUPLICIDADE & SAVE ======================
  private async validateDuplicateEntry(): Promise<boolean> {
    // RN008: não bloquear por tipo+escopo (a combinação única é específica por tipo)
    // Mantemos retorno true aqui e deixamos a validação acontecer no backend com 409 quando aplicável.
    return true;
  }

  private async checkDuplicateEarly(): Promise<void> {
    // RN008B — só checa após todos os campos da combinação do tipo selecionado
    this.duplicateExists = false; // não bloquear preventivamente por tipo/escopo
  }

  // private handleSaveError(error: any, operation: 'edit' | 'create' | 'update-existing'): void {
  //   console.error('Erro ao salvar fator MUT:', error);
  //   if (error?.status === 409) {
  //     const msg = this.buildDuplicateMessage();
  //     this.notificationService.warning(msg);
  //     return;
  //   }
  //   this.notificationService.error(
  //     operation === 'create' ? MESSAGES.MUT.ERRO.CRIAR : MESSAGES.MUT.ERRO.ATUALIZAR
  //   );
  // }

  private buildDuplicateMessage(): string {
    const tipo = this.mutForm.get('tipoMudanca')?.value;
    const escopo = this.activeTab;
    if (tipo === TipoMudanca.SOLO) {
      const tipoFator = this.mutForm.get('tipoFator')?.value;
      const usoAnterior = this.mutForm.get('usoAnterior')?.value;
      const usoAtual = this.mutForm.get('usoAtual')?.value;
      const tipoFatorLabel = this.getTipoFatorLabel(tipoFator);
      return `Já existe fator Solo para ${tipoFatorLabel} / ${usoAnterior} → ${usoAtual} neste escopo.`;
    }
    if (tipo === TipoMudanca.DESMATAMENTO) {
      const bioma = this.mutForm.get('bioma')?.value;
      const biomaLabel = this.getBiomaLabel(bioma);
      const valorUnico = this.mutForm.get('valorUnico')?.value;
      const ufs: string[] = this.mutForm.get('uf')?.value || [];
      if (valorUnico === true) {
        return `Já existe fator de Desmatamento para ${biomaLabel} / Valor único neste escopo.`;
      }
      const ufStr = ufs && ufs.length ? ufs[0] : 'UF';
      return `Já existe fator de Desmatamento para ${biomaLabel} / ${ufStr} neste escopo.`;
    }
    if (tipo === TipoMudanca.VEGETACAO) {
      const categorias: string[] = this.mutForm.get('categoriaFitofisionomia')?.value || [];
      const parametro = this.mutForm.get('parametro')?.value;
      const catStr = categorias && categorias.length ? this.getCategoriaLabel(categorias[0]) : 'Categoria';
      return `Já existe fator de Vegetação para ${catStr} / ${parametro} neste escopo.`;
    }
    return 'Dados duplicados detectados neste escopo.';
  }

  private async performSave(): Promise<void> {
    if (!this.mutForm.valid) {
      this.markFormGroupTouched();
      this.notifyFormErrors();
      return;
    }

    if (this.mode === 'create') {
      const ok = await this.validateDuplicateEntry();
      if (!ok) {
        this.notificationService.warning('Já existe um fator para este Tipo de mudança e Escopo. Não é possível duplicar.');
        return;
      }
    }

    this.isLoading = true;
    const mutRequest = this.buildMutRequest();

    const operation = this.mode === 'create'
      ? this.mutService.criar(mutRequest)
      : this.mutService.atualizar(this.fator!.id, mutRequest);

    operation.subscribe({
      next: (response) => {
        this.isLoading = false;
        
        // <<< evita duplicação >>>
        if (this.notifyInModal) {
          this.notificationService.success(
            this.mode === 'create' ? MESSAGES.MUT.SUCESSO_CRIAR : MESSAGES.MUT.SUCESSO_ATUALIZAR
          );
        }
        // <<< -- >>>
        
        this.fator = response;
        this.populateForm(); // reflete dados escopo 1/3
        this.save.emit(response); // o pai continua livre para notificar
      },
      error: (err: any) => {
        this.isLoading = false;
        this.handleSaveError(err, this.mode);
      }
    });
  }

  private handleSaveError(error: any, operation: 'edit' | 'create' | 'update-existing'): void {
    console.error('Erro ao salvar fator MUT:', error);
    if (error?.status === 409) {
      const msg = this.buildDuplicateMessage();
      this.notificationService.warning(msg);
      return;
    }
    this.notificationService.error(
      operation === 'create' ? MESSAGES.MUT.ERRO.CRIAR : MESSAGES.MUT.ERRO.ATUALIZAR
    );
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

  // Public: used in template and duplicate message builder
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
      case 'F':
        return 'Formação Florestal';
      case 'G':
        return 'Formação Campestre';
      case 'OFL':
        return 'Outras Formações Florestais';
      case 'O':
        return 'Floresta';
      default:
        return key || 'Categoria da fitofisionomia';
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
      ufControl?.setValidators([this.ufRequiredValidator()]);
    }
    ufControl?.updateValueAndValidity();
  }
}
