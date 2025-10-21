import {
  Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, FormControl, AsyncValidatorFn, ValidationErrors
} from '@angular/forms';
import { Subject, of, Observable, timer, from } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, switchMap, catchError, map, filter } from 'rxjs/operators';
import { CombustivelResponse, CombustivelService } from '../../../core/services/combustivel.service';
import { DecimalFormatDirective } from '../../../directives/decimal-format.directive';
import { EscopoEnum } from '../../../core/models/escopo.enum';

export interface FuelRegistrationForm {
  nome: string;
  unidade: string;
  co2: number;
  ch4: number;
  n2o: number;
  tipo?: 'FOSSIL' | 'BIOFUEL';
  escopo?: EscopoEnum;
}

export interface ScopeFuelData {
  nome: string;
  unidade: string;
  co2: number;
  ch4: number;
  n2o: number;
}

export interface ScopeFuelFormData {
  escopo1?: ScopeFuelData;
  escopo3Producao?: ScopeFuelData;
}

function decimalValidator(control: AbstractControl) {
  const v = control.value;
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? null : { invalidDecimal: true };
}

function combustivelExistsValidator(
  combustivelService: CombustivelService,
  currentId?: number,
  escopo?: EscopoEnum
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const nome = control.value?.trim();

    if (!nome || nome.length < 2 || !escopo) {
      return of(null);
    }

    return timer(350).pipe(
      switchMap(() => {
        if (currentId) {
          return combustivelService.buscarPorNomeEEscopo(nome, escopo).pipe(
            map((combustivel: CombustivelResponse | null) => {
              return combustivel && combustivel.id !== currentId
                ? { combustivelExists: { message: 'Combustível já cadastrado neste escopo' } }
                : null;
            })
          );
        } else {
          return combustivelService.verificarExistenciaPorNomeEEscopo(nome, escopo).pipe(
            map(exists => exists
              ? { combustivelExists: { message: 'Combustível já cadastrado neste escopo' } }
              : null
            )
          );
        }
      }),
      catchError(() => of(null))
    );
  };
}

@Component({
  selector: 'app-fuel-registration-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DecimalFormatDirective],
  templateUrl: './fuel-registration-modal.component.html',
  styleUrls: ['./fuel-registration-modal.component.scss']
})
export class FuelRegistrationModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isVisible = false;
  @Input() title = 'Cadastro de combustível';
  @Input() isEditMode = false;
  @Input() initialData: FuelRegistrationForm | null = null;
  @Input() currentCombustivelId?: number;
  @Input() enableScopes = false;
  @Input() isEnergyMode = false;

  // IDs por escopo para edição correta
  currentCombustivelIdEscopo1?: number;
  currentCombustivelIdEscopo3?: number;

  private getCurrentCombustivelId(): number | undefined {
    if (!this.enableScopes) return this.currentCombustivelId;
    return this.activeScope === 'escopo1'
      ? this.currentCombustivelIdEscopo1
      : this.currentCombustivelIdEscopo3;
  }
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<any>();
  @Output() updateExisting = new EventEmitter<any>();

  fuelForm!: FormGroup;
  private destroy$ = new Subject<void>();

  // estados
  isValidatingName = false;
  existingCombustivel: CombustivelResponse | null = null;
  showUpdateConfirmation = false;

  // abas/escopos
  activeScope: 'escopo1' | 'escopo3-producao' = 'escopo1';

  private readonly emptyScope: ScopeFuelData = { nome: '', unidade: '', co2: 0, ch4: 0, n2o: 0 };

  scopeFuelFormData: ScopeFuelFormData = {
    escopo1: { ...this.emptyScope },
    escopo3Producao: { ...this.emptyScope }
  };

  showReplicationMessage = false;
  showCancelConfirmModal = false;
  showCopyConfirmModal = false;
  showDuplicateNameModal = false;
  duplicateNameMessage = '';
  pendingFormData: any = null;

  // busca
  searchResults: CombustivelResponse[] = [];
  isSearching = false;
  showSearchResults = false;
  searchControl: FormControl = new FormControl('');

  readonly unidadeOptions = [
    'kg', 'liter', 'litro', 'l', 'm³', 'm3', 'tonelada CO2/litro',
    't', 'g', 'ton', 'tonelada', 'Toneladas', 'galão', 'galao'
  ] as const;

  constructor(private fb: FormBuilder, private combustivelService: CombustivelService) { }

  unidadeValidator = (control: AbstractControl): ValidationErrors | null => {
    if (!control.value || control.value.trim().length === 0) {
      return null;
    }

    const unidade = control.value.trim().toLowerCase();
    const isValid = this.unidadeOptions.some(u => u.toLowerCase() === unidade);
    
    return isValid ? null : { 
      unidadeInvalida: { 
        value: control.value,
        validUnits: this.unidadeOptions 
      } 
    };
  }

  // ===== lifecycle =====
  ngOnInit(): void {
    this.initializeForm();
    this.setupSearch();
    this.setupNameValidation();
    if (this.enableScopes) {
      this.initializeTabs();
      this.setupSharedNameAndUnitSync();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']) {
      const isNowVisible = changes['isVisible'].currentValue;
      const wasVisible = changes['isVisible'].previousValue;

      if (isNowVisible && !wasVisible) {
        if (!this.isEditMode && !this.initialData) {
          this.resetForm();
          if (this.enableScopes) {
            this.initializeScopeFuelData(true);
          }
        } else if (this.enableScopes) {
          this.initializeScopeFuelData();
        }
      }
    }

    if (changes['initialData']) {
      const newData = changes['initialData'].currentValue;
      const oldData = changes['initialData'].previousValue;

      if (newData && newData !== oldData) {
        this.resetForm();
        if (this.enableScopes) {
          setTimeout(() => {
            this.loadInitialDataIntoScopes();
            this.loadScopeFuelData();
          }, 0);
        }
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===== init helpers =====
  private initializeForm(): void {
    this.fuelForm = this.fb.group({
      nome: ['',
        [Validators.required, Validators.minLength(2)],
        [this.conditionalAsyncValidator()]
      ],
      unidade: ['', [Validators.required, this.unidadeValidator]],
      co2: [0, [Validators.required, decimalValidator]],
      ch4: [0, [Validators.required, decimalValidator]],
      n2o: [0, [Validators.required, decimalValidator]]
    });
  }

  private conditionalAsyncValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const value = control.value?.trim();
      if (!value || value.length < 2) return of(null);

      if (this.isEditMode && this.initialData?.nome === value) return of(null);

      const currentEscopo = this.getCurrentEscopo();
      const validatorResult = combustivelExistsValidator(
        this.combustivelService,
        this.getCurrentCombustivelId(),
        currentEscopo
      )(control);
      return validatorResult instanceof Promise ? from(validatorResult) : validatorResult;
    };
  }

  private getCurrentEscopo(): EscopoEnum {
    if (!this.enableScopes) return EscopoEnum.ESCOPO1;
    return this.activeScope === 'escopo1' ? EscopoEnum.ESCOPO1 : EscopoEnum.ESCOPO3;
  }

  private setupNameValidation(): void {
      const nomeControl = this.fuelForm.get('nome');
      if (!nomeControl) return;
  
      nomeControl.statusChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe(status => {
          const value = (nomeControl.value ?? '').toString().trim();
          const shouldTrack =
            value.length >= 2 && !(this.isEditMode && this.initialData?.nome === value);
  
          // Atualiza o indicador apenas quando devemos acompanhar a verificação
          this.isValidatingName = shouldTrack && status === 'PENDING';
  
          // Mantém a lógica prévia (limpar dados existentes se houver erro de duplicidade)
          if (status !== 'PENDING' && nomeControl.hasError('combustivelExists')) {
            this.existingCombustivel = null;
          }
        });
  }

  private setupSearch(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term: string) => {
          if (!term || term.length < 2) {
            this.showSearchResults = false;
            return of<CombustivelResponse[]>([]);
          }
          this.isSearching = true;
          return this.combustivelService.buscarPorNome(term).pipe(
            catchError(() => of<CombustivelResponse[]>([]))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(results => {
        this.searchResults = results;
        this.isSearching = false;
        this.showSearchResults = results.length > 0;
      });
  }

  // ===== shared name/unit sync =====
  private setupSharedNameAndUnitSync(): void {
      const nomeCtrl = this.fuelForm.get('nome');
      const unidadeCtrl = this.fuelForm.get('unidade');
  
      if (nomeCtrl) {
          nomeCtrl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(v => {
              if (!this.enableScopes) return;
              const val = (v ?? '').toString();
              if (!this.scopeFuelFormData.escopo1) this.scopeFuelFormData.escopo1 = { ...this.emptyScope };
              if (!this.scopeFuelFormData.escopo3Producao) this.scopeFuelFormData.escopo3Producao = { ...this.emptyScope };
              this.scopeFuelFormData.escopo1.nome = val;
              this.scopeFuelFormData.escopo3Producao.nome = val;
          });
      }
  
      if (unidadeCtrl) {
          unidadeCtrl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(v => {
              if (!this.enableScopes) return;
              const val = (v ?? '').toString();
              if (!this.scopeFuelFormData.escopo1) this.scopeFuelFormData.escopo1 = { ...this.emptyScope };
              if (!this.scopeFuelFormData.escopo3Producao) this.scopeFuelFormData.escopo3Producao = { ...this.emptyScope };
              // Replicar unidade para ambos escopos
              this.scopeFuelFormData.escopo1.unidade = val;
              this.scopeFuelFormData.escopo3Producao.unidade = val;
          });
      }
  }

  // ===== scopes =====
  private initializeScopeFuelData(forceEmpty: boolean = false): void {
    if (forceEmpty) {
      this.scopeFuelFormData = {
        escopo1: { ...this.emptyScope },
        escopo3Producao: { ...this.emptyScope }
      };
      this.activeScope = 'escopo1';
      this.loadScopeFuelData();
      return;
    }

    if (!this.scopeFuelFormData.escopo1) this.scopeFuelFormData.escopo1 = { ...this.emptyScope };
    if (!this.scopeFuelFormData.escopo3Producao) this.scopeFuelFormData.escopo3Producao = { ...this.emptyScope };
    this.loadScopeFuelData();
  }

  private initializeTabs(): void {
    this.setActiveScope('escopo1');
  }

  shouldShowScope(scope: string): boolean {
    return scope === 'escopo1' || scope === 'escopo3-producao';
  }

  private getScopeKey(scope: 'escopo1' | 'escopo3-producao'): keyof ScopeFuelFormData {
    return scope === 'escopo1' ? 'escopo1' : 'escopo3Producao';
  }

  private loadScopeFuelData(): void {
    const k = this.getScopeKey(this.activeScope);
    const d = this.scopeFuelFormData[k];
    if (d) {
      this.fuelForm.patchValue({
        nome: d.nome ?? '',
        unidade: d.unidade ?? '',
        co2: d.co2 ?? 0,
        ch4: d.ch4 ?? 0,
        n2o: d.n2o ?? 0
      });
    }
  }

  private saveScopeFuelData(): void {
      if (!this.enableScopes) return;
  
      const v = this.fuelForm.value;
      const k = this.getScopeKey(this.activeScope);
  
      const dataToSave: ScopeFuelData = {
        nome: (v.nome ?? '').toString(),
        unidade: (v.unidade ?? '').toString(),
        co2: Number(v.co2) || 0,
        ch4: Number(v.ch4) || 0,
        n2o: Number(v.n2o) || 0
      };
  
      this.scopeFuelFormData[k] = dataToSave;
  
      console.log('💾 Salvando', this.activeScope, '- Nome:', dataToSave.nome, '| Unidade:', dataToSave.unidade, '| Fatores:', { co2: dataToSave.co2, ch4: dataToSave.ch4, n2o: dataToSave.n2o });
  
      // Sincroniza nome e unidade entre escopos
      if (this.enableScopes) {
        if (!this.scopeFuelFormData.escopo1) this.scopeFuelFormData.escopo1 = { ...this.emptyScope };
        if (!this.scopeFuelFormData.escopo3Producao) this.scopeFuelFormData.escopo3Producao = { ...this.emptyScope };
  
        const { nome, unidade } = dataToSave;
        this.scopeFuelFormData.escopo1.nome = nome;
        this.scopeFuelFormData.escopo1.unidade = unidade;
        this.scopeFuelFormData.escopo3Producao.nome = nome;
        this.scopeFuelFormData.escopo3Producao.unidade = unidade;
  
        console.log('🔄 Sincronização nome/unidade aplicada para ambos escopos');
      }
  }

  onConfirm(): void {
    console.log('✅ onConfirm() iniciado - enableScopes:', this.enableScopes);

    if (!this.fuelForm.valid) {
      console.log('❌ Form inválido');
      return;
    }

    this.saveScopeFuelData();
    this.verificarNomeDuplicadoAntesSalvar();

    // ✅ Single emission happens later in executarSalvamento(payload)
    // (no confirm.emit or onClose here)
  }

  setActiveScope(scope: 'escopo1' | 'escopo3-producao'): void {
    if (!this.enableScopes) return;
    this.saveScopeFuelData();
    this.activeScope = scope;
    this.loadScopeFuelData();
    setTimeout(() => this.updateReplicationMessage(), 100);
  }

  confirmReplicateAllData(): void {
    if (!this.enableScopes) return;
    const s1 = this.scopeFuelFormData.escopo1;
    if (s1 && s1.nome?.trim()) {
      this.showCopyConfirmModal = true;
    }
  }

  closeCopyConfirmModal(): void {
    this.showCopyConfirmModal = false;
  }

  replicateAllDataScope1ToScope3(): void {
    if (!this.enableScopes) return;
    const s1 = this.scopeFuelFormData.escopo1;
    if (!s1) return;
    
    const currentS3 = this.scopeFuelFormData.escopo3Producao ?? this.emptyScope;
    this.scopeFuelFormData.escopo3Producao = {
        nome: s1.nome || '',
        // Replica também a unidade do Escopo 1
        unidade: s1.unidade || '',
        co2: Number(s1.co2) || 0,
        ch4: Number(s1.ch4) || 0,
        n2o: Number(s1.n2o) || 0
    };

    if (this.activeScope === 'escopo3-producao') {
      this.loadScopeFuelData();
    }

    this.updateReplicationMessage();
    this.closeCopyConfirmModal();
  }

  // ===== busca =====
  selectCombustivel(c: CombustivelResponse): void {
    this.fuelForm.patchValue({
      nome: c.nome,
      unidade: c.unidade,
      co2: c.fatorEmissaoCO2,
      ch4: c.fatorEmissaoCH4,
      n2o: c.fatorEmissaoN2O
    });
    this.searchControl.setValue(c.nome);
    this.showSearchResults = false;

    if (this.enableScopes) this.saveScopeFuelData();
  }

  onSearchFocus(): void {
    if (this.searchResults.length > 0) this.showSearchResults = true;
  }

  onSearchBlur(): void {
    setTimeout(() => (this.showSearchResults = false), 200);
  }

  clearSearch(): void {
    this.searchControl.setValue('');
    this.searchResults = [];
    this.showSearchResults = false;
  }

  // ===== ações =====
  confirmClose(): void {
    this.showCancelConfirmModal = true;
  }

  closeCancelConfirmModal(): void {
    this.showCancelConfirmModal = false;
  }

  confirmCancel(): void {
    this.closeCancelConfirmModal();
    this.onClose();
  }

  onClose(): void {
    if (this.enableScopes) {
      this.saveScopeFuelData();
      if (this.isEnergyMode) this.setActiveScope('escopo1');
    }
    this.close.emit();
  }

  confirmUpdate(): void {
    if (this.existingCombustivel) {
      this.updateExisting.emit({
        existingId: this.existingCombustivel.id,
        newData: this.fuelForm.value
      });
      this.showUpdateConfirmation = false;
    }
  }

  cancelUpdate(): void {
    this.showUpdateConfirmation = false;
    this.existingCombustivel = null;
  }

  useExistingData(): void {
    if (!this.existingCombustivel) return;

    this.fuelForm.patchValue({
      nome: this.existingCombustivel.nome,
      unidade: this.existingCombustivel.unidade,
      co2: this.existingCombustivel.fatorEmissaoCO2,
      ch4: this.existingCombustivel.fatorEmissaoCH4,
      n2o: this.existingCombustivel.fatorEmissaoN2O
    });

    if (this.enableScopes) {
      const fuelData: ScopeFuelData = {
        nome: this.existingCombustivel.nome,
        unidade: this.existingCombustivel.unidade,
        co2: this.existingCombustivel.fatorEmissaoCO2,
        ch4: this.existingCombustivel.fatorEmissaoCH4,
        n2o: this.existingCombustivel.fatorEmissaoN2O
      };

      if (this.existingCombustivel.escopo === EscopoEnum.ESCOPO1) {
        this.scopeFuelFormData.escopo1 = { ...fuelData };
        this.setActiveScope('escopo1');
      } else {
        this.scopeFuelFormData.escopo3Producao = { ...fuelData };
        this.setActiveScope('escopo3-producao');
      }

      this.loadScopeFuelData();
    }

    this.showUpdateConfirmation = false;
    this.existingCombustivel = null;
  }

  private updateReplicationMessage(): void {
    if (!this.enableScopes) {
      this.showReplicationMessage = false;
      return;
    }
    const escopo1Data = this.scopeFuelFormData.escopo1;
    const escopo3Data = this.scopeFuelFormData.escopo3Producao;

    const hasS1 = escopo1Data && (escopo1Data.co2 > 0 || escopo1Data.ch4 > 0 || escopo1Data.n2o > 0);
    const hasS3 = escopo3Data && (escopo3Data.co2 > 0 || escopo3Data.ch4 > 0 || escopo3Data.n2o > 0);

    if (hasS1 && !hasS3) {
      this.showReplicationMessage = true;
    } else if (hasS1 && hasS3) {
      const factorsDifferent =
        escopo1Data!.co2 !== escopo3Data!.co2 ||
        escopo1Data!.ch4 !== escopo3Data!.ch4 ||
        escopo1Data!.n2o !== escopo3Data!.n2o;
      this.showReplicationMessage = factorsDifferent;
    } else {
      this.showReplicationMessage = false;
    }
  }

  private loadInitialDataIntoScopes(): void {
    if (!this.initialData || !this.enableScopes) return;

    // In edit mode, fetch data for both scopes using the fuel name
    if (this.isEditMode && this.initialData.nome) {
      this.combustivelService.buscarPorNome(this.initialData.nome).pipe(
        takeUntil(this.destroy$)
      ).subscribe(fuels => {
        // Initialize with empty data
        this.scopeFuelFormData.escopo1 = { ...this.emptyScope };
        this.scopeFuelFormData.escopo3Producao = { ...this.emptyScope };

        // Load data for each scope found
        fuels.forEach(fuel => {
          const fuelData = {
            nome: fuel.nome,
            unidade: fuel.unidade,
            co2: fuel.fatorEmissaoCO2,
            ch4: fuel.fatorEmissaoCH4,
            n2o: fuel.fatorEmissaoN2O
          };

          if (fuel.escopo === EscopoEnum.ESCOPO1) {
            this.scopeFuelFormData.escopo1 = { ...fuelData };
            this.currentCombustivelIdEscopo1 = fuel.id;
          } else if (fuel.escopo === EscopoEnum.ESCOPO3) {
            this.scopeFuelFormData.escopo3Producao = { ...fuelData };
            this.currentCombustivelIdEscopo3 = fuel.id;
          }
        });

        // Set active scope based on the initial data
        this.activeScope = this.initialData!.escopo === EscopoEnum.ESCOPO3 ? 'escopo3-producao' : 'escopo1';
        this.loadScopeFuelData();
      });
      return;
    }

    // For non-edit mode, use the original logic
    const fuelData = {
      nome: this.initialData.nome ?? '',
      unidade: this.initialData.unidade ?? '',
      co2: this.initialData.co2 ?? 0,
      ch4: this.initialData.ch4 ?? 0,
      n2o: this.initialData.n2o ?? 0
    };

    if (this.initialData.escopo === EscopoEnum.ESCOPO3) {
      this.scopeFuelFormData.escopo3Producao = { ...fuelData };
      this.scopeFuelFormData.escopo1 = {
        ...(this.scopeFuelFormData.escopo1 ?? this.emptyScope),
        nome: fuelData.nome,
        unidade: fuelData.unidade,
        co2: this.scopeFuelFormData.escopo1?.co2 ?? 0,
        ch4: this.scopeFuelFormData.escopo1?.ch4 ?? 0,
        n2o: this.scopeFuelFormData.escopo1?.n2o ?? 0
      };
      this.activeScope = 'escopo3-producao';
    } else {
      this.scopeFuelFormData.escopo1 = { ...fuelData };
      this.scopeFuelFormData.escopo3Producao = {
        ...(this.scopeFuelFormData.escopo3Producao ?? this.emptyScope),
        nome: fuelData.nome,
        unidade: fuelData.unidade,
        co2: this.scopeFuelFormData.escopo3Producao?.co2 ?? 0,
        ch4: this.scopeFuelFormData.escopo3Producao?.ch4 ?? 0,
        n2o: this.scopeFuelFormData.escopo3Producao?.n2o ?? 0
      };
      this.activeScope = 'escopo1';
    }
  }

  private markAllFieldsAsTouched(): void {
    Object.keys(this.fuelForm.controls).forEach(key => {
      this.fuelForm.get(key)?.markAsTouched();
    });
  }

  hasError(fieldName: string): boolean {
    const field = this.fuelForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getErrorMessage(fieldName: string): string {
    const field = this.fuelForm.get(fieldName);
    if (!field || !field.errors) return '';

    const errors = field.errors;

    if (errors['required']) return 'Este campo é obrigatório';
    if (errors['minlength']) return `Mínimo de ${errors['minlength'].requiredLength} caracteres`;
    if (errors['invalidDecimal']) return 'Valor deve ser um número válido maior ou igual a zero';
    if (errors['combustivelExists']) return errors['combustivelExists'].message || 'Combustível já cadastrado';
    if (errors['unidadeInvalida']) return `Unidade inválida. Escolha uma unidade válida: ${errors['unidadeInvalida'].validUnits.join(', ')}`;

    return 'Campo inválido';
  }

  getSliderStyle(): any {
    if (!this.enableScopes) return {};
    const tabCount = 2;
    const tabWidth = 100 / tabCount;
    const activeIndex = this.activeScope === 'escopo1' ? 0 : 1;
    return { width: `${tabWidth}%`, transform: `translateX(${activeIndex * 100}%)` };
  }

  resetForm(): void {
    this.fuelForm.reset();
    this.initializeScopeFuelData(true);
    this.activeScope = 'escopo1';
    this.showReplicationMessage = false;
    this.existingCombustivel = null;
    this.showUpdateConfirmation = false;
    this.currentCombustivelIdEscopo1 = undefined;
    this.currentCombustivelIdEscopo3 = undefined;
    this.clearSearch();
    // Trava de segurança para garantir que o spinner não fique ativo
    this.isValidatingName = false;
  }

  verificarNomeDuplicadoAntesSalvar(): void {
    const formValue = this.fuelForm.value;
    const nome = formValue.nome?.trim();
    
    if (!nome) {
      this.procederComSalvamento();
      return;
    }

    const nomeNormalizado = nome.toLowerCase().replace(/\s+/g, ' ');
    const escopo = this.getCurrentEscopo();

    this.combustivelService.buscarPorNomeEEscopo(nome, escopo).subscribe({
      next: (combustivelExistente) => {
        if (combustivelExistente) {
          // Se estamos editando e é o mesmo registro do escopo ativo, prossegue
          if (this.isEditMode && this.getCurrentCombustivelId() === combustivelExistente.id) {
            this.procederComSalvamento();
            return;
          }
          this.duplicateNameMessage = `O combustível "${nome}" já existe neste escopo.`;
          this.showDuplicateNameModal = true;
          this.pendingFormData = this.prepararDadosParaSalvar();
        } else {
          this.procederComSalvamento();
        }
      },
      error: (error) => {
        console.error('Erro ao verificar nome duplicado:', error);
        this.procederComSalvamento(); // Em caso de erro, prossegue
      }
    });
  }

  closeDuplicateNameModal(): void {
    this.showDuplicateNameModal = false;
    this.duplicateNameMessage = '';
    this.pendingFormData = null;
  }

  confirmDuplicateName(): void {
    this.closeDuplicateNameModal();
    if (this.pendingFormData) {
      this.executarSalvamento(this.pendingFormData);
    }
  }

  private prepararDadosParaSalvar(): any {
    if (this.enableScopes) {
        const escopo1Data = this.scopeFuelFormData.escopo1;
        const escopo3Data = this.scopeFuelFormData.escopo3Producao;
  
        const hasValidEscopo1 = escopo1Data && escopo1Data.unidade !== '';
        const hasValidEscopo3 = escopo3Data && escopo3Data.unidade !== '';
  
        const finalPayload: any = {};
  
        if (hasValidEscopo1) {
            finalPayload.escopo1 = {
                nome: escopo1Data.nome,
                unidade: escopo1Data.unidade,
                co2: Number(escopo1Data.co2),
                ch4: Number(escopo1Data.ch4),
                n2o: Number(escopo1Data.n2o),
                escopo: EscopoEnum.ESCOPO1
            };
        }
  
        if (hasValidEscopo3) {
            finalPayload.escopo3Producao = {
                nome: escopo3Data.nome,
                unidade: escopo3Data.unidade,
                co2: Number(escopo3Data.co2),
                ch4: Number(escopo3Data.ch4),
                n2o: Number(escopo3Data.n2o),
                escopo: EscopoEnum.ESCOPO3
            };
        }
  
        // Edit ID e Escopo baseados no escopo ativo
        const editId = this.getCurrentCombustivelId();
        if (this.isEditMode && typeof editId === 'number') {
            finalPayload.editId = editId;
            finalPayload.editEscopo = this.getCurrentEscopo(); // ⬅️ sempre do tab ativo
        }
        return finalPayload;
    } else {
        const formValue = this.fuelForm.value;
        const payload: any = {
            nome: formValue.nome,
            unidade: formValue.unidade,
            co2: Number(formValue.co2),
            ch4: Number(formValue.ch4),
            n2o: Number(formValue.n2o),
            escopo: this.getCurrentEscopo()
        };
  
        // ⬇️ Também aqui, quando em edição
        if (this.isEditMode && typeof this.currentCombustivelId === 'number') {
            payload.editId = this.currentCombustivelId;
            payload.editEscopo = this.initialData?.escopo ?? this.getCurrentEscopo();
        }
  
        return payload;
    }
  }

  private procederComSalvamento(): void {
    const payload = this.prepararDadosParaSalvar();
    this.executarSalvamento(payload);
  }

  private executarSalvamento(payload: any): void {
    console.log('✅ Executando salvamento:', payload);
    this.confirm.emit(payload);
    this.onClose();
  }
}