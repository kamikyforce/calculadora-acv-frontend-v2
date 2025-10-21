import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrLoadingComponent } from '../br-loading/br-loading.component';
import { FuelRegistrationModalComponent } from '../fuel-registration-modal/fuel-registration-modal.component';
import { CombustivelService, CombustivelResponse, CombustivelRequest } from '../../../core/services/combustivel.service';
import { NotificationService } from '../../../core/services/notification.service';
import { takeUntil, switchMap, delay, retryWhen, take } from 'rxjs/operators';
import { Observable, Subject, of, throwError, timer } from 'rxjs';
import { NumberFormatPipe } from "../../pipes/number-format.pipe";
import { EscopoEnum } from '../../../core/models/escopo.enum';

interface Combustivel {
  id: number;
  nome: string;
  unidade: string;
  co2: number;
  ch4: number;
  n2o: number;
  escopo: EscopoEnum;
  hasEscopo1?: boolean;
  hasEscopo3?: boolean;
}

interface PaginationConfig {
  currentPage: number;
  itemsPerPage: number;
  totalPages: number;
}

@Component({
  selector: 'app-combustivel-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BrLoadingComponent,
    FuelRegistrationModalComponent,
    NumberFormatPipe
  ],
  templateUrl: './combustivel-table.component.html',
  styleUrls: ['./combustivel-table.component.scss']
})
export class CombustivelTableComponent implements OnInit, OnChanges, OnDestroy {
  @Input() searchTerm: string = '';
  @Input() refreshTrigger: number = 0;
  @Output() editCombustivel = new EventEmitter<Combustivel>();
  @Output() createCombustivel = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  combustiveis: Combustivel[] = [];
  filteredCombustiveis: Combustivel[] = [];

  isLoading = false;
  loadingMessage = '';

  showCreateModal = false;
  isEditMode = false;
  currentCombustivel: any = null;

  // ✅ Add dedupe state
  private lastNotificationMessage: string | null = null;
  private lastNotificationTime: number = 0;
  private readonly NOTIFICATION_DEBOUNCE_TIME: number = 2000;
  pagination: PaginationConfig = {
    currentPage: 1,
    itemsPerPage: 10,
    totalPages: 1
  };

  readonly Math = Math;

  constructor(
    private readonly combustivelService: CombustivelService,
    private readonly notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.loadCombustiveis();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['searchTerm']) {
      this.filterCombustiveis();
    }
    if (changes['refreshTrigger'] && !changes['refreshTrigger'].firstChange) {
      this.loadCombustiveis();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get paginatedCombustiveis(): Combustivel[] {
    const startIndex = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage;
    const endIndex = startIndex + this.pagination.itemsPerPage;
    return this.filteredCombustiveis.slice(startIndex, endIndex);
  }

  get totalItems(): number {
    return this.filteredCombustiveis.length;
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pagination.itemsPerPage);
  }

  get currentPage(): number {
    return this.pagination.currentPage;
  }
  set currentPage(page: number) {
    this.changePage(page);
  }

  get itemsPerPage(): number {
    return this.pagination.itemsPerPage;
  }
  set itemsPerPage(items: number) {
    this.changeItemsPerPage(items);
  }

  private loadCombustiveis(): void {
    this.isLoading = true;

    this.combustivelService.listar().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response: CombustivelResponse[]) => {
        this.combustiveis = this.mapResponseToCombustivel(response);
        this.filterCombustiveis();
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Erro ao carregar combustíveis:', error);
        this.showNotificationSafe('error', 'Erro ao carregar combustíveis');
        this.isLoading = false;
      }
    });
  }

  private filterCombustiveis(): void {
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      this.filteredCombustiveis = [...this.combustiveis];
    } else {
      const searchLower = this.searchTerm.toLowerCase().trim();
      this.filteredCombustiveis = this.combustiveis.filter(combustivel => {
        const matchesNome = combustivel.nome.toLowerCase().includes(searchLower);
        const matchesUnidade = combustivel.unidade.toLowerCase().includes(searchLower);
        return matchesNome || matchesUnidade;
      });
    }
    this.updatePagination();
    this.pagination.currentPage = 1;
  }

  private mapResponseToCombustivel(responses: CombustivelResponse[]): Combustivel[] {
    // Agrupa ESTRITAMENTE por nome, colapsando Escopo 1 e 3 numa única linha
    const groupedByName = new Map<string, {
      escopo1?: CombustivelResponse;
      escopo3?: CombustivelResponse;
    }>();
  
    responses.forEach(r => {
      const key = r.nome.toLowerCase().trim();
      if (!groupedByName.has(key)) {
        groupedByName.set(key, {});
      }
  
      const group = groupedByName.get(key)!;
      if (r.escopo === EscopoEnum.ESCOPO1) {
        group.escopo1 = r;
      } else if (r.escopo === EscopoEnum.ESCOPO3) {
        group.escopo3 = r;
      }
    });
  
    // Para exibição, prioriza Escopo 3 (se existir); senão Escopo 1
    return Array.from(groupedByName.values()).map(group => {
      const primaryData = group.escopo3 || group.escopo1!;
      return {
        id: primaryData.id,
        nome: primaryData.nome,
        unidade: primaryData.unidade,
        co2: primaryData.fatorEmissaoCO2,
        ch4: primaryData.fatorEmissaoCH4,
        n2o: primaryData.fatorEmissaoN2O,
        escopo: primaryData.escopo,
        // indicadores de escopo (já existem no tipo)
        hasEscopo1: !!group.escopo1,
        hasEscopo3: !!group.escopo3
      };
    });
  }
  changePage(newPage: number): void {
    if (newPage >= 1 && newPage <= this.totalPages) {
      this.pagination.currentPage = newPage;
    }
  }

  changeItemsPerPage(newItemsPerPage: number): void {
    this.pagination.itemsPerPage = newItemsPerPage;
    this.pagination.currentPage = 1;
    this.updatePagination();
  }

  private updatePagination(): void {
    this.pagination.totalPages = Math.ceil(this.totalItems / this.pagination.itemsPerPage);
    if (this.pagination.currentPage > this.pagination.totalPages && this.pagination.totalPages > 0) {
      this.pagination.currentPage = this.pagination.totalPages;
    }
  }

  onCreateCombustivel(): void {
    this.showCreateModal = true;
    this.isEditMode = false;
    this.currentCombustivel = null;
  }

  onEditCombustivel(combustivel: Combustivel): void {
    this.showCreateModal = true;
    this.isEditMode = true;
    // Se houver ambos, preferir abrir no Escopo 1 (como você quer)
    const preferredEscopo = combustivel.hasEscopo1 ? EscopoEnum.ESCOPO1 : combustivel.escopo;
    this.currentCombustivel = { ...combustivel, escopo: preferredEscopo };
  }

  /**
   * Upsert por escopo (nome + escopo) com retry logic:
   * - Busca por nome+escopo
   * - Se existe → atualizar
   * - Senão → criar
   * - Retry em caso de 409 Conflict
   */
  private upsertByNomeEscopo(payload: CombustivelRequest): Observable<CombustivelResponse> {
    return this.combustivelService.buscarPorNomeEEscopo(payload.nome, payload.escopo).pipe(
      switchMap((found: CombustivelResponse | null) => {
        if (found) {
          return this.combustivelService.atualizar(found.id, payload);
        }
        return this.combustivelService.criar(payload);
      }),
      retryWhen(errors => 
        errors.pipe(
          switchMap((error, index) => {
            // Retry only on 409 Conflict errors, max 3 attempts
            if (error.message?.includes('409') || error.message?.includes('já existe')) {
              if (index < 2) { // Max 3 attempts (0, 1, 2)
                console.log(`Retry attempt ${index + 1} for ${payload.nome} - ${payload.escopo}`);
                return timer(500 * (index + 1)); // Exponential backoff: 500ms, 1000ms, 1500ms
              }
            }
            return throwError(() => error);
          }),
          take(3)
        )
      )
    );
  }

  onFuelRegistrationConfirm(data: any): void {
      // Espera payload como:
      // { escopo1: {...}, escopo3Producao: {...}, editId?: number, editEscopo?: EscopoEnum }
      this.setLoading(true, 'Salvando combustível...');
  
      const s1 = data?.escopo1 ?? null;
      const s3 = data?.escopo3Producao ?? null;
  
      const nome = (s1?.nome || s3?.nome || '').toString().trim();
      const unidadeEscopo1 = (s1?.unidade || '').toString().trim();
      const unidadeEscopo3 = (s3?.unidade || '').toString().trim();
  
      const requests: { data: CombustivelRequest; label: string }[] = [];
  
      if (s1 && nome && unidadeEscopo1) {
          const escopo1Data: CombustivelRequest = {
              nome,
              tipo: 'FOSSIL',
              unidade: unidadeEscopo1,
              fatorEmissaoCO2: this.parseNumericValue(s1.co2),
              fatorEmissaoCH4: this.parseNumericValue(s1.ch4),
              fatorEmissaoN2O: this.parseNumericValue(s1.n2o),
              escopo: EscopoEnum.ESCOPO1
          };
          requests.push({ data: escopo1Data, label: 'Escopo 1' });
      }
  
      if (s3 && nome && unidadeEscopo3) {
          const escopo3Data: CombustivelRequest = {
              nome,
              tipo: 'FOSSIL',
              unidade: unidadeEscopo3,
              fatorEmissaoCO2: this.parseNumericValue(s3.co2),
              fatorEmissaoCH4: this.parseNumericValue(s3.ch4),
              fatorEmissaoN2O: this.parseNumericValue(s3.n2o),
              escopo: EscopoEnum.ESCOPO3
          };
          requests.push({ data: escopo3Data, label: 'Escopo 3' });
      }
  
      if (requests.length === 0) {
          this.setLoading(false);
          this.showNotificationSafe('warning', 'Fill name and unit per scope to save.');
          return;
      }
  
      this.processRequestsSequentially(requests, 0, []);
  }

  private processRequestsSequentially(
    requests: { data: CombustivelRequest; label: string }[],
    index: number,
    results: CombustivelResponse[]
  ): void {
    if (index >= requests.length) {
      this.showNotificationSafe('success', `Combustível salvo/atualizado para ${results.length} escopo(s)!`);
      this.closeCreateModal();
      this.loadCombustiveis();
      return;
    }

    const currentRequest = requests[index];
    console.log(`Processing ${currentRequest.label}: ${currentRequest.data.nome}`);

    this.upsertByNomeEscopo(currentRequest.data).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response: CombustivelResponse) => {
        console.log(`✅ ${currentRequest.label} processed successfully:`, response.id);
        results.push(response);
        this.processRequestsSequentially(requests, index + 1, results);
      },
      error: (error: any) => {
        console.error(`❌ Error processing ${currentRequest.label}:`, error);
        this.setLoading(false);
        this.showNotificationSafe('error', `Erro ao salvar combustível para ${currentRequest.label}. Tente novamente.`);
      }
    });
  }

  onUpdateExistingFuel(data: any): void {
    // Mantido para compatibilidade, mas o fluxo principal agora usa o upsert acima
    this.setLoading(true, 'Atualizando combustível...');
    const combustivelData: CombustivelRequest = {
      nome: data.nome,
      tipo: 'FOSSIL',
      unidade: data.unidade,
      fatorEmissaoCO2: data.co2,
      fatorEmissaoCH4: data.ch4,
      fatorEmissaoN2O: data.n2o,
      escopo: data.escopo
    };

    this.combustivelService.atualizar(data.id, combustivelData).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.showNotificationSafe('success', 'Combustível atualizado com sucesso!');
        this.closeCreateModal();
        this.loadCombustiveis();
      },
      error: (error: any) => {
        console.error('Erro ao atualizar combustível:', error);
        this.showNotificationSafe('error', 'Erro ao atualizar combustível. Tente novamente.');
      },
      complete: () => this.setLoading(false)
    });
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.isEditMode = false;
    this.currentCombustivel = null;
  }

  refresh(): void {
    this.loadCombustiveis();
  }

  private setLoading(loading: boolean, message: string = ''): void {
    this.isLoading = loading;
    this.loadingMessage = message;
  }

  /**
   * Converte valor para número de forma segura
   */
  private parseNumericValue(value: any): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const parsed = Number(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  private showNotificationSafe(
    type: 'success' | 'warning' | 'error' | 'info',
    message: string
  ): void {
    const now = Date.now();
    const isSameMessage = this.lastNotificationMessage === message;
    const isWithinDebounceTime = (now - this.lastNotificationTime) < this.NOTIFICATION_DEBOUNCE_TIME;

    if (isSameMessage && isWithinDebounceTime) return;

    this.lastNotificationMessage = message;
    this.lastNotificationTime = now;

    switch (type) {
      case 'success': this.notificationService.success(message); break;
      case 'warning': this.notificationService.warning(message); break;
      case 'error': this.notificationService.error(message); break;
      case 'info': this.notificationService.info(message); break;
    }
  }
}