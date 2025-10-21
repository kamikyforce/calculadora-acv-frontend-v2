import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AccessibilityService } from '../../core/services/accessibility.service';
import { InventarioJornadaService, InventarioJornadaResponse } from '../../core/services/inventario-jornada.service';
import { LoteRebanhoService } from '../../core/services/lote-rebanho.service';
import { CategoriaLoteService } from '../../services/categoria-lote.service';
import { NutricaoAnimalLoteService } from '../../services/nutricao-animal-lote.service';
import { ManejoDejetosLoteService } from '../../services/manejo-dejetos-lote.service';
import { HamburgerMenuComponent, MenuItem } from '../../shared/components/hamburger-menu/hamburger-menu.component';
import { BrLoadingComponent } from '../../shared/components/br-loading/br-loading.component';
import { STANDARD_MENU_ITEMS } from '../../shared/constants/menu-items';
import { JornadaStepperComponent } from './jornada-stepper/jornada-stepper.component';
import { FaseRebanhoComponent } from './fase-rebanho/fase-rebanho.component';

export interface InventarioJornada {
  id?: number;
  usuarioId: number;
  nome: string;
  descricao?: string;
  tipoRebanho: string;
  faseAtual: number;
  status: 'RASCUNHO' | 'EM_ANDAMENTO' | 'CONCLUIDO';
  fasesConcluidas: { [key: number]: boolean };
  dataCriacao?: Date;
  dataAtualizacao?: Date;
}

@Component({
  selector: 'app-jornada-pecuarista',
  standalone: true,
  imports: [
    CommonModule,
    HamburgerMenuComponent,
    BrLoadingComponent,
    JornadaStepperComponent,
    FaseRebanhoComponent
  ],
  templateUrl: './jornada-pecuarista.component.html',
  styleUrls: ['./jornada-pecuarista.component.scss']
})
export class JornadaPecuaristaComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  // Menu e navegação
  menuItems: MenuItem[] = STANDARD_MENU_ITEMS;
  isMenuOpen = false;

  // Loading
  isLoading = false;
  loadingMessage = '';

  // Acessibilidade
  isHighContrast = false;
  isVLibrasActive = false;

  // Modais de erro
  showErrorModal = false;
  errorMessage = '';

  // Inventário
  inventario: InventarioJornada = {
    usuarioId: 0,
    nome: '',
    tipoRebanho: 'BOVINO',
    faseAtual: 1,
    status: 'RASCUNHO',
    fasesConcluidas: {}
  };

  inventarioId: number | null = null;

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly authService: AuthService,
    private readonly inventarioJornadaService: InventarioJornadaService,
    private readonly accessibilityService: AccessibilityService,
    // Serviços da fase Rebanho para verificação automática de conclusão
    private readonly loteRebanhoService: LoteRebanhoService,
    private readonly categoriaLoteService: CategoriaLoteService,
    private readonly nutricaoAnimalLoteService: NutricaoAnimalLoteService,
    private readonly manejoDejetosLoteService: ManejoDejetosLoteService
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['id']) {
        this.inventarioId = +params['id'];
        this.carregarInventario();
      } else {
        this.iniciarNovaJornada();
      }
    });

    // Inicializa acessibilidade
    this.accessibilityService.isHighContrast$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isActive => { this.isHighContrast = isActive; });

    this.accessibilityService.isVLibrasActive$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isActive => { this.isVLibrasActive = isActive; });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setLoading(loading: boolean, message: string = ''): void {
    this.isLoading = loading;
    this.loadingMessage = message;
  }

  private async carregarInventario(): Promise<void> {
    if (!this.inventarioId) return;

    try {
      this.setLoading(true, 'Carregando jornada...');
      
      const response = await firstValueFrom(this.inventarioJornadaService.buscarPorId(this.inventarioId));
      
      if (response) {
        this.inventario = {
          id: response.id,
          usuarioId: response.usuarioId,
          nome: response.nome,
          descricao: response.descricao,
          tipoRebanho: response.tipoRebanho,
          faseAtual: response.faseAtual,
          status: response.status,
          fasesConcluidas: response.fasesConcluidas || {},
          dataCriacao: response.dataCriacao,
          dataAtualizacao: response.dataAtualizacao
        };

        // Após carregar, verificar automaticamente se a fase Rebanho está completa.
        // Se sim, marcar concluída e abrir diretamente na fase 2.
        try {
          const rebanhoCompleto = await this.verificarRebanhoCompleto(this.inventario.id!);
          if (rebanhoCompleto) {
            this.inventario.fasesConcluidas = { ...this.inventario.fasesConcluidas, 1: true };
            if (this.inventario.faseAtual === 1) {
              this.inventario.faseAtual = 2;
            }
            if (this.inventario.status === 'RASCUNHO') {
              this.inventario.status = 'EM_ANDAMENTO';
            }
            await this.salvarProgresso();
          }
        } catch (e) {
          console.warn('Falha ao verificar conclusão automática da fase Rebanho:', e);
        }
      }

    } catch (error) {
      console.error('Erro ao carregar inventário:', error);
      this.showError('Erro ao carregar inventário. Tente novamente.');
      this.router.navigate(['/calculos-registrados']);
    } finally {
      this.setLoading(false);
    }
  }

  private iniciarNovaJornada(): void {
    // Criar novo inventário com dados padrão
    this.inventario = {
      usuarioId: Number(this.authService.getCurrentUser()?.id) || 0,
      nome: `Nova Jornada - ${new Date().toLocaleDateString('pt-BR')}`,
      descricao: 'Cálculo ACV para jornada pecuarista',
      tipoRebanho: 'BOVINO',
      faseAtual: 1,
      status: 'RASCUNHO',
      fasesConcluidas: {}
    };
  }

  onFaseChange(novaFase: number): void {
    if (novaFase <= this.inventario.faseAtual) {
      this.inventario.faseAtual = novaFase;
      this.salvarProgresso();
    }
  }

  onFaseConcluida(numeroFase: number): void {
    this.inventario.fasesConcluidas[numeroFase] = true;
    
    // Avança para próxima fase se não estiver na última
    if (numeroFase < 4 && numeroFase === this.inventario.faseAtual) {
      this.inventario.faseAtual = numeroFase + 1;
    }

    // Atualiza status se todas as fases estiverem concluídas
    const todasFasesConcluidas = Object.keys(this.inventario.fasesConcluidas)
      .filter(key => this.inventario.fasesConcluidas[+key])
      .length === 4;

    if (todasFasesConcluidas) {
      this.inventario.status = 'CONCLUIDO';
    } else if (this.inventario.status === 'RASCUNHO') {
      this.inventario.status = 'EM_ANDAMENTO';
    }

    this.salvarProgresso();
  }

  private async salvarProgresso(): Promise<void> {
    try {
      if (!this.inventario) return;

      const usuarioId = Number(this.authService.getCurrentUser()?.id) || 0;
      const request = {
        usuarioId: this.inventario.usuarioId,
        nome: this.inventario.nome,
        descricao: this.inventario.descricao,
        tipoRebanho: this.inventario.tipoRebanho,
        faseAtual: this.inventario.faseAtual,
        status: this.inventario.status,
        fasesConcluidas: this.inventario.fasesConcluidas
      };

      if (this.inventario.id) {
        // Atualizar inventário existente
        const response = await firstValueFrom(this.inventarioJornadaService.atualizar(this.inventario.id, usuarioId, request));
        if (response) {
          this.inventario = { ...this.inventario, ...response };
        }
      } else {
        // Criar novo inventário
        const response = await firstValueFrom(this.inventarioJornadaService.criar(usuarioId, request));
        if (response) {
          this.inventario = { ...this.inventario, ...response };
          this.inventarioId = response.id;
          // Atualizar URL para incluir o ID do inventário
          this.router.navigate(['/jornada-pecuarista', response.id], { replaceUrl: true });
        }
      }
    } catch (error) {
      console.error('Erro ao salvar progresso:', error);
      this.showError('Erro ao salvar progresso. Tente novamente.');
    }
  }

  onMenuToggle(isOpen: boolean): void {
    this.isMenuOpen = isOpen;
  }

  onMenuItemClick(item: MenuItem): void {
    if (item.route) {
      this.router.navigate([item.route]);
    }
  }

  logout(): void {
    this.authService.logout().pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Erro no logout:', error);
        this.router.navigate(['/login']);
      }
    });
  }

  // Acessibilidade
  toggleHighContrast(): void {
    this.isHighContrast = !this.isHighContrast;
    this.accessibilityService.toggleHighContrast();
  }

  toggleVLibras(): void {
    this.isVLibrasActive = !this.isVLibrasActive;
    this.accessibilityService.toggleVLibras();
  }

  // Títulos/Subtítulos das fases conforme especificações
  getFaseTitulo(n: number): string {
    switch (n) {
      case 1: return 'Rebanho';
      case 2: return 'Pastoreio';
      case 3: return 'MUT';
      case 4: return 'Energia';
      default: return '';
    }
  }

  getFaseSubtitulo(n: number): string {
    switch (n) {
      case 1:
        return 'Informe dados referentes ao seu rebanho quando ele estiver na fase 1 de rebanho';
      case 2:
        return 'Informe dados referentes ao pastoreio';
      case 3:
        return 'Informe dados referentes à mudança de uso da terra';
      case 4:
        return 'Informe dados referentes ao uso de energia e gás';
      default:
        return '';
    }
  }

  // Resumo das abas exibido no subtítulo do header principal
  getAbaResumo(): string {
    switch (this.inventario.faseAtual) {
      case 1: return 'Informações gerais, nutrição e manejo';
      case 2: return 'Dados de pastoreio';
      case 3: return 'Mudança de uso da terra';
      case 4: return 'Uso de energia e gás';
      default: return '';
    }
  }

  voltarDashboard(): void {
    this.router.navigate(['/calculos-registrados']);
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'RASCUNHO':
        return 'Rascunho';
      case 'EM_ANDAMENTO':
        return 'Em andamento';
      case 'CONCLUIDO':
        return 'Concluído';
      default:
        return status;
    }
  }

  // Métodos para modais de erro
  showError(message: string): void {
    this.errorMessage = message;
    this.showErrorModal = true;
  }

  closeErrorModal(): void {
    this.showErrorModal = false;
    this.errorMessage = '';
  }

  // Verifica se a fase 1 (Rebanho) está completa com base em registros nas três abas
  private async verificarRebanhoCompleto(inventarioId: number): Promise<boolean> {
    try {
      const lotes = await firstValueFrom(this.loteRebanhoService.listarPorInventario(inventarioId)).catch(() => []);
      if (!lotes || lotes.length === 0) return false;

      for (const lote of lotes) {
        const loteId = Number((lote as any).id);
        if (!loteId) return false;

        // Categorias: ao menos uma categoria com quantidade e peso preenchidos
        const categorias = await firstValueFrom(this.categoriaLoteService.listarPorLote(loteId)).catch(() => []);
        const hasCategoriaValida = (categorias || []).some((c: any) =>
          c && c.quantidadeAnimais != null && c.pesoMedio != null
        );
        if (!hasCategoriaValida) return false;

        // Nutrição: registro existente com campos base ou algum item nas listas
        const nutricaoRegs = await firstValueFrom(this.nutricaoAnimalLoteService.listarPorLote(loteId)).catch(() => []);
        const hasNutricaoValida = (nutricaoRegs || []).some((n: any) => {
          const baseOk = n && (n.inserirDadosDieta !== undefined || n.sistemaProducao ||
            (n.tempoPastoHorasDia != null && n.tempoPastoDiasAno != null));
          const ingOk = Array.isArray(n?.ingredientes) && n.ingredientes.some((it: any) =>
            ((it?.nomeIngrediente || '').trim()) || it?.quantidadeKgCabDia != null || it?.ofertaDiasAno != null
          );
          const concOk = Array.isArray(n?.concentrados) && n.concentrados.some((it: any) =>
            ((it?.nomeConcentrado || '').trim()) || it?.quantidadeKgCabDia != null || it?.ofertaDiasAno != null
          );
          const aditOk = Array.isArray(n?.aditivos) && n.aditivos.some((it: any) =>
            ((it?.nomeAditivo || '').trim()) || it?.quantidadeKgCabDia != null || it?.ofertaDiasAno != null
          );
          return baseOk || ingOk || concOk || aditOk;
        });
        if (!hasNutricaoValida) return false;

        // Manejo: ao menos um registro com tipo e percentual
        const manejos = await firstValueFrom(this.manejoDejetosLoteService.listarPorLote(loteId)).catch(() => []);
        const hasManejoValido = (manejos || []).some((m: any) => m && m.tipoManejo && m.percentualRebanho != null);
        if (!hasManejoValido) return false;
      }

      return true;
    } catch (err) {
      console.warn('Erro ao verificar completude do Rebanho:', err);
      return false;
    }
  }
}