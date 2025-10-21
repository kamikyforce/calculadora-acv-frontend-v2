import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { 
  InsumoProducaoAgricola, 
  InsumoProducaoAgricolaRequest, 
  InsumoProducaoAgricolaResponse 
} from '../models/insumo-producao-agricola.model';

@Injectable({
  providedIn: 'root'
})
export class InsumoProducaoAgricolaService {
  private readonly apiUrl = `${environment.apiUrl}/insumos-producao-agricola`;

  constructor(private http: HttpClient) {}

  private getHttpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    };
  }

  listarTodos(): Observable<InsumoProducaoAgricola[]> {
    return this.http.get<InsumoProducaoAgricolaResponse[]>(
      this.apiUrl, 
      this.getHttpOptions()
    ).pipe(
      map(responses => responses.map(this.mapResponseToModel)),
      catchError(this.handleError)
    );
  }

  buscarPorId(id: number): Observable<InsumoProducaoAgricola> {
    return this.http.get<InsumoProducaoAgricolaResponse>(
      `${this.apiUrl}/${id}`, 
      this.getHttpOptions()
    ).pipe(
      map(this.mapResponseToModel),
      catchError(this.handleError)
    );
  }

  criar(request: InsumoProducaoAgricolaRequest): Observable<InsumoProducaoAgricola> {
    return this.http.post<InsumoProducaoAgricolaResponse>(
      this.apiUrl, 
      request, 
      this.getHttpOptions()
    ).pipe(
      map(this.mapResponseToModel),
      catchError(this.handleError)
    );
  }

  atualizar(id: number, request: InsumoProducaoAgricolaRequest): Observable<InsumoProducaoAgricola> {
    return this.http.put<InsumoProducaoAgricolaResponse>(
      `${this.apiUrl}/${id}`, 
      request, 
      this.getHttpOptions()
    ).pipe(
      map(this.mapResponseToModel),
      catchError(this.handleError)
    );
  }

  excluir(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${id}`, 
      this.getHttpOptions()
    ).pipe(
      catchError(this.handleError)
    );
  }

  buscarPorTipo(tipo: string): Observable<InsumoProducaoAgricola[]> {
    return this.http.get<InsumoProducaoAgricolaResponse[]>(
      `${this.apiUrl}/tipo/${tipo}`, 
      this.getHttpOptions()
    ).pipe(
      map(responses => responses.map(this.mapResponseToModel)),
      catchError(this.handleError)
    );
  }

  buscarPorClasse(classe: string): Observable<InsumoProducaoAgricola[]> {
    return this.http.get<InsumoProducaoAgricolaResponse[]>(
      `${this.apiUrl}/classe/${classe}`, 
      this.getHttpOptions()
    ).pipe(
      map(responses => responses.map(this.mapResponseToModel)),
      catchError(this.handleError)
    );
  }

  buscarPorEscopo(escopo: number): Observable<InsumoProducaoAgricola[]> {
    return this.http.get<InsumoProducaoAgricolaResponse[]>(
      `${this.apiUrl}/escopo/${escopo}`, 
      this.getHttpOptions()
    ).pipe(
      map(responses => responses.map(this.mapResponseToModel)),
      catchError(this.handleError)
    );
  }

  verificarNomeExistente(nome: string, usuarioId: number, classe?: string, id?: number): Observable<boolean> {
    let params = `?usuarioId=${usuarioId}`;
    if (classe) {
      params += `&classe=${encodeURIComponent(classe)}`;
    }
    if (id) {
      params += `&id=${id}`;
    }
    return this.http.get<boolean>(
      `${this.apiUrl}/verificar-nome/${encodeURIComponent(nome)}${params}`, 
      this.getHttpOptions()
    ).pipe(
      catchError(this.handleError)
    );
  }

  private mapResponseToModel(response: InsumoProducaoAgricolaResponse): InsumoProducaoAgricola {
    return {
      // Campos de controle
      id: response.id,
      usuarioId: response.usuarioId,
      nomeProduto: response.nomeProduto || '',
      dataCriacao: response.dataCriacao || '',
      ultimaAtualizacao: response.ultimaAtualizacao || '',
      
      versao: response.versao || 'v1',
      
      // ESCOPO 1 - Classificação
      classe: response.classe || '',
      especificacao: response.especificacao || '',
      
      // ESCOPO 1 - Teor de macronutrientes
      teorNitrogenio: response.teorNitrogenio || 0,
      teorFosforo: response.teorFosforo || 0,
      teorPotassio: response.teorPotassio || 0,
      
      // ESCOPO 1 - Fator de conversão
      fatorConversao: response.fatorConversao || 0,
      fatorConversaoUnidade: response.fatorConversaoUnidade || '',
      
      // ESCOPO 1 - Quantidade e unidade de referência
      quantidade: response.quantidade || 0,
      unidadeReferencia: response.unidadeReferencia || '',
      
      // ESCOPO 1 - Fatores de emissão
      feCo2Biogenico: response.feCo2Biogenico || 0,
      refFeCo2Biogenico: response.refFeCo2Biogenico || '',
      feCo2: response.feCo2 || 0,
      refFeCo2: response.refFeCo2 || '',
      feCh4: response.feCh4 || 0,
      refFeCh4: response.refFeCh4 || '',
      feN2oDireto: response.feN2oDireto || 0,
      refFeN2oDireto: response.refFeN2oDireto || '',

      fracN2oVolatilizacao: response.fracN2oVolatilizacao || 0,
      refFracN2oVolatilizacao: response.refFracN2oVolatilizacao || '',
      fracN2oLixiviacao: response.fracN2oLixiviacao || 0,
      refFracN2oLixiviacao: response.refFracN2oLixiviacao || '',
      feN2oComposto: response.feN2oComposto || 0,
      refFeN2oComposto: response.refFeN2oComposto || '',
      feCo: response.feCo || 0,
      refFeCo: response.refFeCo || '',
      feNox: response.feNox || 0,
      refFeNox: response.refFeNox || '',
      geeTotal: response.geeTotal || 0,
      dioxidoCarbonoMetanoTransformacao: response.dioxidoCarbonoMetanoTransformacao || 0,
      ativo: response.ativo ?? true,
      
      // ESCOPO 3 - Identificação e classificação
      grupoIngrediente: response.grupoIngrediente || '',
      tipoProduto: response.tipoProduto || '',
      
      // ESCOPO 3 - Quantidade e unidade de referência
      qtdProdutoReferencia: response.quantidadeProdutoReferencia || 0,
      unidadeProdutoReferencia: response.unidadeProdutoReferencia || '',
      
      // ESCOPO 3 - Quantidade e unidade
      unidadeProduto: response.unidadeProduto || '',
      quantidadeProduto: response.quantidadeProduto || 0,
      
      // ESCOPO 3 - Valores de emissões (GEE)
      gwp100Total: response.gwp100Total || 0,
      gwp100Fossil: response.gwp100Fossil || 0,
      gwp100Biogenico: response.gwp100Biogenico || 0,
      gwp100Transformacao: response.gwp100Transformacao || 0,
      dioxidoCarbonoFossil: response.dioxidoCarbonoFossil || 0,
      co2Ch4Transformacao: response.co2Ch4Transformacao || 0,
      metanoFossil: response.metanoFossil || 0,
      metanoBiogenico: response.metanoBiogenico || 0,
      oxidoNitroso: response.oxidoNitroso || 0,
      outrasSubstancias: response.outrasSubstanciasEscopo3 || 0,
      
      // ESCOPO 3 - Observações
      comentarios: response.comentarios || ''
    };
  }

  private handleError(error: any): Observable<never> {
    console.error('Erro no serviço InsumoProducaoAgricolaService:', error);
    
    let errorMessage = 'Erro interno do servidor';
    
    if (error.error instanceof ErrorEvent) {
      // Erro do lado do cliente
      errorMessage = `Erro: ${error.error.message}`;
    } else {
      // Erro do lado do servidor
      switch (error.status) {
        case 400:
          errorMessage = 'Dados inválidos';
          break;
        case 401:
          errorMessage = 'Não autorizado';
          break;
        case 403:
          errorMessage = 'Acesso negado';
          break;
        case 404:
          errorMessage = 'Recurso não encontrado';
          break;
        case 409:
          errorMessage = 'Conflito - recurso já existe';
          break;
        case 500:
          errorMessage = 'Erro interno do servidor';
          break;
        default:
          errorMessage = `Erro ${error.status}: ${error.message}`;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }
}