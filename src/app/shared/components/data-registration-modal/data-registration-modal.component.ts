import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { DecimalFormatDirective } from '../../../directives/decimal-format.directive';

export interface DadoMensal {
  mes: number;   // 1..12
  valor: number; // 6 casas decimais
}

export type EscopoCodigo = 'ESCOPO1' | 'ESCOPO2' | 'ESCOPO3';

export type DataTypeUI = 'consolidated' | 'monthly';
export type TipoDadoAPI = 'CONSOLIDADO_ANUAL' | 'MENSAL';
export type StatusCalculoAPI = 'PENDENTE' | 'PARCIAL' | 'COMPLETO';

export interface DataRegistrationForm {
  anoReferencia: number;
  valor: number | null; // consolidado: valor | mensal: média (somente se 12/12)
  dataType: DataTypeUI;
  dadosMensais?: DadoMensal[];
  escopo?: EscopoCodigo;
  originalDataType?: DataTypeUI;
  isManualInput: boolean;
  versao: number;
  tipoDado: TipoDadoAPI;
  statusCalculo: StatusCalculoAPI;
  observacoesAuditoria?: string;
}

interface EditData {
  id?: number;
  ano?: number;
  anoReferencia?: number;
  fatorMedioAnual?: number;
  valor?: number;
  versao?: number;
  observacoesAuditoria?: string;
  tipoDado?: TipoDadoAPI;
  dadosMensais?: Array<{ mes?: number; valor?: number; fatorEmissao?: number; fator?: number }>;
}

@Component({
  selector: 'app-data-registration-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DecimalFormatDirective],
  templateUrl: './data-registration-modal.component.html',
  styleUrls: ['./data-registration-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataRegistrationModalComponent implements OnInit, OnChanges {

  // === INPUTS & OUTPUTS ===
  @Input() isVisible = false;
  @Input() title = 'Cadastro de dados';
  @Input() enableScopes = false;
  @Input() isEnergyMode = false; // true: Energia (Escopo 2 fixo) | false: Combustível (Escopo 1/3)
  @Input() editMode = false;
  @Input() editData: EditData | null = null;
  @Input() existingYears: Array<number | { anoReferencia: number; tipoDado: TipoDadoAPI }> = [];
  @Input() hasInventory = false;
  @Input() serverDuplicate = false; // 👈 novo

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<DataRegistrationForm>();
  @Output() yearChanged = new EventEmitter<number>();

  // === FORM GROUP ===
  form!: FormGroup;

  // === SUPPORT ===
  months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Energia = escopo2; Combustível = escopo1 (padrão) ou escopo3
  activeScope: 'escopo1' | 'escopo2' | 'escopo3' = 'escopo2';
  originalDataType: DataTypeUI | null = null;
  dataversao = 1;
  showCancelConfirmModal = false;
  isAuditMode = false;

  get headerTitle(): string {
    if (this.editMode) {
      return this.form?.value?.dataType === 'monthly'
        ? 'Editar — Dado mensal'
        : 'Editar — Dado consolidado do ano';
    }
    return this.title;
  }

  constructor(private fb: FormBuilder) {}

  // === LIFECYCLE ===
  ngOnInit(): void {
    this.initForm();

    // Definição de escopo por modo
    this.activeScope = this.isEnergyMode ? 'escopo2' : 'escopo1';

    // Em criação: ano NÃO deve vir preenchido para consolidado
    if (!this.editMode) {
      this.form.patchValue({ year: null });
    }

    // Emit ano ao alterar
    this.form.get('year')?.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((year: number) => {
        if (!this.editMode && Number.isInteger(Number(year))) {  // 👈 AQUI
          this.yearChanged.emit(Number(year));
        }
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']?.currentValue) {
      this.editMode && this.editData ? this.loadEditData() : this.resetForm();
    }
  }

  // === FORM INIT ===
  private initForm(): void {
    this.form = this.fb.group({
      year: [null, [Validators.required, Validators.min(1900), Validators.max(2100)]],
      dataType: ['consolidated' as DataTypeUI, Validators.required],
      consolidatedValue: [null, [Validators.min(0)]],
      monthlyValues: this.fb.array(this.months.map(() => this.fb.group({ value: [0, [Validators.min(0)]] }))),
      observacoesAuditoria: [''],
    });
  }

  // Accessor
  get monthlyValues(): FormArray {
    return this.form.get('monthlyValues') as FormArray;
  }

  // === LOAD EDIT DATA ===
  private loadEditData(): void {
    // Ano e bloqueio
    const year = (this.editData?.ano ?? this.editData?.anoReferencia) ?? null;
    this.form.patchValue({ year });
    if (this.editMode) {
      this.form.get('year')?.disable(); // 🔒 trava o ano na edição (regra)
    } else {
      this.form.get('year')?.enable();
    }

    // Tipo de dado original
    const temMensal = Array.isArray(this.editData?.dadosMensais) && this.editData!.dadosMensais!.length > 0;

    if (temMensal || this.editData?.tipoDado === 'MENSAL') {
      this.originalDataType = 'monthly';
      this.form.patchValue({ dataType: 'monthly' });
      // Mapear valores mensais (usa fatorEmissao > fator > valor)
      this.monthlyValues.controls.forEach((ctrl, i) => {
        const src = this.editData!.dadosMensais?.[i];
        const v = (src?.valor ?? src?.fatorEmissao ?? src?.fator ?? 0) as number;
        ctrl.patchValue({ value: this.to6(v) });
      });
    } else {
      this.originalDataType = 'consolidated';
      this.form.patchValue({
        dataType: 'consolidated',
        // Priorize fatorMedioAnual, depois valor como fallback
        consolidatedValue: this.to6(
          this.editData?.fatorMedioAnual ?? 
          this.editData?.valor ?? 
          0
        ),
      });
      
      // Adicione este log para debug
      console.log('🔧 Modal loadEditData:', {
        fatorMedioAnual: this.editData?.fatorMedioAnual,
        valor: this.editData?.valor,
        consolidatedValueSet: this.to6(this.editData?.fatorMedioAnual ?? this.editData?.valor ?? 0)
      });
    }

    // Auditoria
    const vAtual = this.editData?.versao ?? 1;
    this.isAuditMode = vAtual > 1;
    this.dataversao = vAtual;

    if (this.editData?.observacoesAuditoria) {
      this.form.patchValue({ observacoesAuditoria: this.editData.observacoesAuditoria });
    }
  }

  // === HELPERS / FORMAT ===
  private to6(n: number | null | undefined): number {
    const v = Number(n ?? 0);
    // garantir até 6 casas no valor numérico
    return Number.isFinite(v) ? Number(v.toFixed(6)) : 0;
  }

  // === CALCULATIONS ===
  // Método para contar meses preenchidos
  getFilledMonthsCount(): number {
    const arr = this.monthlyValues.value as Array<{ value: number }>;
    return arr.filter(m => Number(m.value || 0) > 0).length;
  }
  
  // Atualizar o método calculateAnnualAverage para usar a nova lógica
  public calculateAnnualAverage(): number {
    // NOVA LÓGICA CORRIGIDA: Calcula média baseada em TODOS os 12 meses (incluindo zeros)
    const allValues = (this.monthlyValues.value as Array<{ value: number }>)
      .map(m => Number(m.value || 0)); // Inclui todos os valores, incluindo zeros
  
    const filledCount = allValues.filter(v => v > 0).length;
    if (filledCount === 0) return 0;
  
    const sum = allValues.reduce((a, b) => a + b, 0);
    return this.to6(sum / 12); // Sempre divide por 12, não pelos meses preenchidos
  }
  
  public calculateAnnualAverageDisplay(): string {
    // NOVA LÓGICA: Mostra média se houver pelo menos 1 mês preenchido
    const filledMonths = this.getFilledMonthsCount();
  
    return filledMonths > 0 ? this.calculateAnnualAverage().toFixed(6) : '0.000000';
  }
  
  // Atualizar getter para verificar meses preenchidos
  get hasAnyMonthFilled(): boolean {
    return this.getFilledMonthsCount() > 0;
  }
  
  // Atualizar validação do formulário
  public isFormValid(): boolean {
    // ano
    const yearCtrl = this.form.get('year');
    if (!yearCtrl || yearCtrl.invalid || yearCtrl.value === null) return false;
  
    // tipo
    const type: DataTypeUI = this.form.value.dataType;
    if (type === 'consolidated') {
      const v = Number(this.form.value.consolidatedValue);
      return Number.isFinite(v) && v > 0;
    }
  
    // NOVA LÓGICA: mensal válido com pelo menos 1 mês > 0
    return this.hasAnyMonthFilled;
  }

  // === STATUS CALC ===
  private calculateStatus(): StatusCalculoAPI {
    if (this.form.value.dataType === 'consolidated') {
      return Number(this.form.value.consolidatedValue) > 0 ? 'COMPLETO' : 'PENDENTE';
    }
    const filled = (this.monthlyValues.value as Array<{ value: number }>).filter(m => Number(m.value) > 0).length;
    if (filled === 0) return 'PENDENTE';
    if (filled === 12) return 'COMPLETO';
    return 'PARCIAL';
  }

  // === YEAR VALIDATION ===
  private controlYear(): AbstractControl | null {
    return this.form.get('year');
  }

  yearInvalid(tipo: DataTypeUI): boolean {
    const c = this.controlYear();
    if (!c) return false;
    return c.invalid && (c.dirty || c.touched);
  }

  // === DUPLICATE VALIDATION ===
  isYearDuplicate(year: number, tipo: DataTypeUI): boolean {
    if (!year) return false;
    const kind: TipoDadoAPI = tipo === 'consolidated' ? 'CONSOLIDADO_ANUAL' : 'MENSAL';

    return this.existingYears.some((y: any) => {
      const ano = (typeof y === 'object' ? y.anoReferencia : y);
      const tipoDado: TipoDadoAPI = (typeof y === 'object' ? y.tipoDado : kind);
      return ano === year && tipoDado === kind;
    });
  }

  // === SUBMISSION ===
  onConfirm(): void {
    const raw = this.form.getRawValue();

    // Monta dados mensais (1..12)
    const dadosMensais: DadoMensal[] | undefined =
      raw.dataType === 'monthly'
        ? this.months.map((_, i) => ({
            mes: i + 1,
            valor: this.to6(raw.monthlyValues[i].value || 0),
          }))
        : undefined;

    // NOVA LÓGICA: Média anual calculada sempre que houver meses preenchidos
    const annualAverage = this.calculateAnnualAverage();
    const mediaValida = this.hasAnyMonthFilled ? annualAverage : null;

    // Escopo: Energia=ESCOPO2 | Combustível=ESCOPO1/ESCOPO3
    let escopo: EscopoCodigo | undefined;
    if (this.enableScopes) {
      if (this.isEnergyMode) {
        escopo = 'ESCOPO2';
      } else {
        escopo = (this.activeScope === 'escopo1' ? 'ESCOPO1' : 'ESCOPO3');
      }
    }

    const payload: DataRegistrationForm = {
      anoReferencia: raw.year,
      valor: raw.dataType === 'consolidated' ? this.to6(raw.consolidatedValue || 0) : mediaValida,
      dataType: raw.dataType,
      dadosMensais,
      escopo,
      originalDataType: this.originalDataType || undefined,
      isManualInput: true,
      versao: this.dataversao,
      tipoDado: raw.dataType === 'consolidated' ? 'CONSOLIDADO_ANUAL' : 'MENSAL',
      statusCalculo: this.calculateStatus(),
      observacoesAuditoria: raw.observacoesAuditoria || '',
    };

    this.confirm.emit(payload);
  }

  // === RESET ===
  resetForm(): void {
    this.form.reset({
      year: null, // 🔧 criação não vem preenchido (regra #1)
      dataType: 'consolidated',
      consolidatedValue: null,
      monthlyValues: this.months.map(() => ({ value: 0 })),
      observacoesAuditoria: '',
    });
    this.originalDataType = null;
    this.dataversao = 1;
    this.isAuditMode = false;
    // escopo default por modo
    this.activeScope = this.isEnergyMode ? 'escopo2' : 'escopo1';
    this.form.get('year')?.enable();
  }

  // === SCOPE ===
  setActiveScope(scope: 'escopo1' | 'escopo2' | 'escopo3'): void {
    if (this.isEnergyMode) {
      this.activeScope = 'escopo2'; // trava
      return;
    }
    // combustível: 1 ou 3
    if (scope === 'escopo1' || scope === 'escopo3') {
      this.activeScope = scope;
    }
  }

  // === MODAL CANCEL ===
  confirmClose(): void {
    this.showCancelConfirmModal = true;
  }

  closeCancelConfirmModal(): void {
    this.showCancelConfirmModal = false;
  }

  confirmCancel(): void {
    this.showCancelConfirmModal = false;
    this.close.emit();
  }

  // === GETTERS ===
  get allMonthsFilled(): boolean {
    const arr = this.monthlyValues.value as Array<{ value: number }>;
    return arr.length === 12 && arr.every(m => Number(m.value) > 0);
  }

  get canConfirm(): boolean {
    // Em edição não bloqueamos por duplicidade (ano está travado)
    if (this.editMode) return this.isFormValid();
  
    const y = this.form?.get('year')?.value as number;
    const tipo = this.form?.get('dataType')?.value as DataTypeUI;
  
    const dupLocal = this.isYearDuplicate(y, tipo);  // 👈 duplicidade pelo array existingYears
    return this.isFormValid() && !dupLocal && !this.serverDuplicate; // 👈 trava também por serverDuplicate
  }

  // public isFormValid(): boolean {
  //   // ano
  //   const yearCtrl = this.form.get('year');
  //   if (!yearCtrl || yearCtrl.invalid || yearCtrl.value === null) return false;

  //   // tipo
  //   const type: DataTypeUI = this.form.value.dataType;
  //   if (type === 'consolidated') {
  //     const v = Number(this.form.value.consolidatedValue);
  //     return Number.isFinite(v) && v > 0;
  //   }

  //   // mensal: exige pelo menos 1 mês > 0 (mas média só com 12/12)
  //   const months = this.monthlyValues.value as { value: number }[];
  //   const hasAnyMonth = Array.isArray(months) && months.some(m => Number(m.value || 0) > 0);
  //   return hasAnyMonth;
  // }
}
