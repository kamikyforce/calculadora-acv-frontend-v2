import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface IngredienteResponse {
  id: number;
  nome: string;
  tipo: string;
  fonte: string;
  ndtPercentual?: number;
  energiaBruta?: number;
  materiaSeca?: number;
  proteinaBruta?: number;
  fibraDetrgenteNeutro?: number;
  representatividadeCorte?: string;
  representatividadeLeite?: string;
  extratoEtereo?: number;
  materiaMineral?: number;
  fatoresEmissoesCalculados?: number;
  observacoes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BancoIngredientesService {
  private readonly apiUrl = `${environment.apiUrl}/insumos-rebanho`;

  constructor(private http: HttpClient) {}

  /**
   * Lista todos os ingredientes alimentares disponíveis
   */
  listarTodosIngredientes(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/ingredientes-alimentares`)
      .pipe(
        tap(ingredientes => console.log(`Carregados ${ingredientes.length} ingredientes alimentares`)),
        catchError(this.handleError)
      );
  }

  /**
   * Filtra ingredientes com base nos critérios fornecidos
   */
  filtrarIngredientes(filtros: {
    nome?: string;
    tipo?: string;
    fonte?: string;
  }): Observable<string[]> {
    // Como agora trabalhamos apenas com nomes de ingredientes (strings),
    // filtramos apenas por nome se fornecido
    return this.listarTodosIngredientes().pipe(
      tap(ingredientes => {
        let filtrados = ingredientes;
        
        if (filtros.nome) {
          filtrados = filtrados.filter(ing => 
            ing.toLowerCase().includes(filtros.nome!.toLowerCase())
          );
        }
        
        console.log(`Filtrados ${filtrados.length} ingredientes com critérios:`, filtros);
        return filtrados;
      })
    );
  }

  /**
   * Obtém ingredientes únicos por nome (remove duplicatas)
   */
  obterIngredientesUnicos(): Observable<string[]> {
    return this.listarTodosIngredientes().pipe(
      tap(ingredientes => {
        const nomes = new Set();
        const unicos = ingredientes.filter(ing => {
          if (nomes.has(ing.toLowerCase())) {
            return false;
          }
          nomes.add(ing.toLowerCase());
          return true;
        });
        console.log(`${unicos.length} ingredientes únicos de ${ingredientes.length} total`);
        return unicos;
      })
    );
  }

  /**
   * Tratamento de erros HTTP
   */
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'Erro desconhecido';
    
    if (error.error instanceof ErrorEvent) {
      // Erro do lado do cliente
      errorMessage = `Erro: ${error.error.message}`;
    } else {
      // Erro do lado do servidor
      switch (error.status) {
        case 400:
          errorMessage = 'Requisição inválida';
          break;
        case 401:
          errorMessage = 'Não autorizado';
          break;
        case 403:
          errorMessage = 'Acesso negado';
          break;
        case 404:
          errorMessage = 'Ingredientes não encontrados';
          break;
        case 500:
          errorMessage = 'Erro interno do servidor';
          break;
        default:
          errorMessage = `Erro ${error.status}: ${error.message}`;
      }
    }
    
    console.error('Erro no BancoIngredientesService:', errorMessage);
    return throwError(() => new Error(errorMessage));
  };
}