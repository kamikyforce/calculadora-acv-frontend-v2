import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import {
  InsumoRebanhoRequest,
  InsumoRebanhoResponse,
  InsumoRebanhoFiltros,
  InsumoRebanhoStats,
  InsumoRebanhoExistencia,
  EscopoEnum,
  TipoInsumo,
  GrupoIngredienteAlimentar,
  FazParteDieta
} from '../models/insumo-rebanho.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class InsumoRebanhoService {
  private readonly baseUrl = `${environment.apiUrl}/insumos-rebanho`;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  private handleError = (error: HttpErrorResponse): Observable<never> => {
    console.error('API Error:', error);
    
    if (error.status === 401) {
      console.log('Authentication required, redirecting to login...');
      this.router.navigate(['/login']);
    } else if (error.status === 403) {
      console.error('Access forbidden');
    } else if (error.status === 404) {
      console.error('Resource not found');
    } else if (error.status === 400) {
      console.error('Bad request - validation error:', error.error);
    }
    
    return throwError(() => error);
  }

  /**
   * Lista todos os insumos do rebanho com filtros opcionais
   */
  listar(filtros?: InsumoRebanhoFiltros): Observable<InsumoRebanhoResponse[]> {
    let params = new HttpParams();
    
    if (filtros) {
      if (filtros.usuarioId) {
        params = params.set('usuarioId', filtros.usuarioId.toString());
      }
      if (filtros.tipo) {
        params = params.set('tipo', filtros.tipo);
      }
      if (filtros.escopo) {
        params = params.set('escopo', filtros.escopo);
      }
      if (filtros.grupoIngrediente) {
        params = params.set('grupoIngrediente', filtros.grupoIngrediente);
      }
      if (filtros.fazParteDieta) {
        params = params.set('fazParteDieta', filtros.fazParteDieta);
      }
    }

    return this.http.get<InsumoRebanhoResponse[]>(this.baseUrl, { 
      params, 
      withCredentials: true 
    }).pipe(
      tap(response => console.log('Insumos rebanho loaded:', response.length)),
      catchError(this.handleError)
    );
  }

  /**
   * Busca um insumo do rebanho por ID
   */
  buscarPorId(id: number): Observable<InsumoRebanhoResponse> {
    return this.http.get<InsumoRebanhoResponse>(`${this.baseUrl}/${id}`, {
      withCredentials: true
    }).pipe(
      tap(response => console.log('Insumo rebanho found:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Cria um novo insumo do rebanho
   */
  criar(insumo: InsumoRebanhoRequest): Observable<InsumoRebanhoResponse> {
    return this.http.post<InsumoRebanhoResponse>(this.baseUrl, insumo, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    }).pipe(
      tap(response => console.log('Insumo rebanho created:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Atualiza um insumo do rebanho existente
   */
  atualizar(id: number, insumo: InsumoRebanhoRequest): Observable<InsumoRebanhoResponse> {
    return this.http.put<InsumoRebanhoResponse>(`${this.baseUrl}/${id}`, insumo, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    }).pipe(
      tap(response => console.log('Insumo rebanho updated:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Remove um insumo do rebanho (soft delete)
   */
  remover(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, {
      withCredentials: true
    }).pipe(
      tap(() => console.log('Insumo rebanho removed:', id)),
      catchError(this.handleError)
    );
  }

  /**
   * Busca insumos por escopo
   */
  buscarPorEscopo(escopo: EscopoEnum): Observable<InsumoRebanhoResponse[]> {
    return this.http.get<InsumoRebanhoResponse[]>(`${this.baseUrl}/escopo/${escopo}`, {
      withCredentials: true
    }).pipe(
      tap(response => console.log('Insumos por escopo loaded:', response.length)),
      catchError(this.handleError)
    );
  }

  /**
   * Lista escopos distintos disponíveis
   */
  listarEscoposDistintos(): Observable<EscopoEnum[]> {
    return this.http.get<EscopoEnum[]>(`${this.baseUrl}/escopos`, {
      withCredentials: true
    }).pipe(
      tap(response => console.log('Escopos distintos loaded:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Busca avançada com múltiplos critérios
   */
  buscarAvancada(criterios: any): Observable<InsumoRebanhoResponse[]> {
    return this.http.post<InsumoRebanhoResponse[]>(`${this.baseUrl}/buscar`, criterios, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    }).pipe(
      tap(response => console.log('Busca avançada completed:', response.length)),
      catchError(this.handleError)
    );
  }

  /**
   * Obtém estatísticas dos insumos
   */
  obterEstatisticas(): Observable<InsumoRebanhoStats> {
    return this.http.get<InsumoRebanhoStats>(`${this.baseUrl}/stats`, {
      withCredentials: true
    }).pipe(
      tap(response => console.log('Estatísticas loaded:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Verifica se um insumo existe
   */
  verificarExistenciaProduto(identificacao: string, usuarioId: number): Observable<{ exists: boolean }> {
    const params = new HttpParams()
      .set('identificacao', identificacao)
      .set('usuarioId', usuarioId.toString());
    return this.http.get<{ exists: boolean }>(`${this.baseUrl}/produto/exists`, { 
      params, 
      withCredentials: true 
    }).pipe(
      tap(response => console.log('Existência do produto verificada:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Obtém todos os tipos de insumo disponíveis
   */
  obterTiposInsumo(): TipoInsumo[] {
    return Object.values(TipoInsumo);
  }

  /**
   * Obtém todos os escopos disponíveis
   */
  obterEscopos(): EscopoEnum[] {
    return Object.values(EscopoEnum);
  }

  /**
   * Obtém todos os grupos de ingredientes alimentares
   */
  obterGruposIngredientes(): GrupoIngredienteAlimentar[] {
    return Object.values(GrupoIngredienteAlimentar);
  }

  /**
   * Obtém opções de "faz parte da dieta"
   */
  obterOpcoesFazParteDieta(): FazParteDieta[] {
    return Object.values(FazParteDieta);
  }

  /**
   * Converte enum para label legível
   */
  obterLabelEscopo(escopo: EscopoEnum): string {
    const labels: { [key in EscopoEnum]: string } = {
      [EscopoEnum.ESCOPO_1]: 'Escopo 1 - Emissões diretas',
      [EscopoEnum.ESCOPO_2]: 'Escopo 2 - Emissões indiretas de energia',
      [EscopoEnum.ESCOPO_3_PRODUCAO]: 'Escopo 3 - Outras emissões indiretas (Produção)',
      [EscopoEnum.ESCOPO_3_TRANSPORTE]: 'Escopo 3 - Outras emissões indiretas (Transporte)'
    };
    return labels[escopo] || escopo;
  }

  /**
   * Converte enum para label legível
   */
  obterLabelTipoInsumo(tipo: TipoInsumo): string {
    const labels: { [key in TipoInsumo]: string } = {
      [TipoInsumo.INGREDIENTES_ALIMENTARES]: 'Ingredientes Alimentares',
      [TipoInsumo.ANIMAIS_COMPRADOS]: 'Animais Comprados',
      [TipoInsumo.FERTILIZANTES]: 'Fertilizantes',
      [TipoInsumo.COMBUSTIVEIS]: 'Combustíveis',
      [TipoInsumo.ENERGIA]: 'Energia'
    };
    return labels[tipo] || tipo;
  }

  /**
   * Converte enum para label legível
   */
  obterLabelGrupoIngrediente(grupo: GrupoIngredienteAlimentar): string {
    const labels: { [key in GrupoIngredienteAlimentar]: string } = {
      [GrupoIngredienteAlimentar.CEREAIS_E_GRAOS]: 'Cereais e grãos',
      [GrupoIngredienteAlimentar.LEGUMINOSAS]: 'Leguminosas',
      [GrupoIngredienteAlimentar.OLEAGINOSAS]: 'Oleaginosas'
    };
    return labels[grupo] || grupo;
  }
}