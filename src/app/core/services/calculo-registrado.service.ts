import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

// Interfaces baseadas na estrutura do backend
export interface CalculoRegistradoRequest {
  car: string;
  fazenda: string;
  tipo?: string;
  estado?: string;
  municipio?: string;
  tamanho?: number;
  ano?: number;
  versao?: string;
  status: StatusCalculoRegistrado;
  emissaoTotal?: number;
  certificacao: TipoCertificacao;
}

export interface CalculoRegistradoResponse {
  id: number;
  car: string;
  fazenda: string;
  tipo?: string;
  estado?: string;
  municipio?: string;
  tamanho?: number;
  ano?: number;
  versao?: string;
  status: StatusCalculoRegistrado;
  emissaoTotal?: number;
  certificacao: TipoCertificacao;
  dataCriacao: string;
  dataAtualizacao: string;
}

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export enum StatusCalculoRegistrado {
  CONCLUIDO = 'CONCLUIDO',
  RASCUNHO = 'RASCUNHO',
  AJUSTAR = 'AJUSTAR'
}

export enum TipoCertificacao {
  CERTIFICADO = 'CERTIFICADO',
  EM_CERTIFICACAO = 'EM_CERTIFICACAO',
  NAO_INICIADO = 'NAO_INICIADO',
  NAO_CERTIFICADO = 'NAO_CERTIFICADO'
}

export interface CalculoRegistradoFiltros {
  car?: string;
  fazenda?: string;
  tipo?: string;
  estado?: string;
  status?: StatusCalculoRegistrado;
  certificacao?: TipoCertificacao;
  page?: number;
  size?: number;
  sort?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CalculoRegistradoService {
  private readonly baseUrl = `${environment.apiUrl}/calculos-registrados`;

  constructor(private http: HttpClient) {}

  /**
   * Lista todos os cálculos registrados com filtros e paginação
   */
  listar(filtros?: CalculoRegistradoFiltros): Observable<PagedResponse<CalculoRegistradoResponse>> {
    let params = new HttpParams();
    
    if (filtros) {
      if (filtros.car) params = params.set('car', filtros.car);
      if (filtros.fazenda) params = params.set('fazenda', filtros.fazenda);
      if (filtros.tipo) params = params.set('tipo', filtros.tipo);
      if (filtros.estado) params = params.set('estado', filtros.estado);
      if (filtros.status) params = params.set('status', filtros.status);
      if (filtros.certificacao) params = params.set('certificacao', filtros.certificacao);
      if (filtros.page !== undefined) params = params.set('page', filtros.page.toString());
      if (filtros.size !== undefined) params = params.set('size', filtros.size.toString());
      if (filtros.sort) params = params.set('sort', filtros.sort);
    }

    return this.http.get<PagedResponse<CalculoRegistradoResponse>>(this.baseUrl, { params })
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Busca um cálculo registrado por ID
   */
  buscarPorId(id: number): Observable<CalculoRegistradoResponse> {
    return this.http.get<CalculoRegistradoResponse>(`${this.baseUrl}/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Cria um novo cálculo registrado
   */
  criar(calculo: CalculoRegistradoRequest): Observable<CalculoRegistradoResponse> {
    const params = new HttpParams().set('usuarioId', '1');
    return this.http.post<CalculoRegistradoResponse>(this.baseUrl, calculo, { params })
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Atualiza um cálculo registrado existente
   */
  atualizar(id: number, calculo: CalculoRegistradoRequest): Observable<CalculoRegistradoResponse> {
    const params = new HttpParams().set('usuarioId', '1');
    return this.http.put<CalculoRegistradoResponse>(`${this.baseUrl}/${id}`, calculo, { params })
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Exclui um cálculo registrado
   */
  excluir(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Verifica se já existe uma fazenda com o mesmo nome e ano para o usuário
   */
  verificarFazendaExistente(fazenda: string, ano: number, usuarioId: number, id?: number): Observable<boolean> {
    let params = `?ano=${ano}&usuarioId=${usuarioId}`;
    if (id) {
      params += `&id=${id}`;
    }
    return this.http.get<boolean>(
      `${this.baseUrl}/verificar-fazenda/${encodeURIComponent(fazenda)}${params}`
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Lista todos os status disponíveis
   */
  listarStatus(): Observable<StatusCalculoRegistrado[]> {
    return this.http.get<StatusCalculoRegistrado[]>(`${this.baseUrl}/status`)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Lista todos os tipos de certificação disponíveis
   */
  listarCertificacoes(): Observable<TipoCertificacao[]> {
    return this.http.get<TipoCertificacao[]>(`${this.baseUrl}/certificacoes`)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Obtém estatísticas dos cálculos registrados
   */
  obterEstatisticas(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/estatisticas`)
      .pipe(
        catchError(this.handleError)
      );
  }

  /**
   * Converte enum para string amigável para exibição
   */
  getStatusLabel(status: StatusCalculoRegistrado): string {
    switch (status) {
      case StatusCalculoRegistrado.CONCLUIDO:
        return 'Concluído';
      case StatusCalculoRegistrado.RASCUNHO:
        return 'Rascunho';
      case StatusCalculoRegistrado.AJUSTAR:
        return 'Ajustar';
      default:
        return status;
    }
  }

  /**
   * Converte enum para string amigável para exibição
   */
  getCertificacaoLabel(certificacao: TipoCertificacao): string {
    switch (certificacao) {
      case TipoCertificacao.CERTIFICADO:
        return 'Certificado';
      case TipoCertificacao.EM_CERTIFICACAO:
        return 'Em certificação';
      case TipoCertificacao.NAO_INICIADO:
        return 'Não iniciado';
      case TipoCertificacao.NAO_CERTIFICADO:
        return 'Não certificado';
      default:
        return certificacao;
    }
  }

  /**
   * Converte string para enum de status
   */
  parseStatus(status: string): StatusCalculoRegistrado {
    switch (status.toLowerCase()) {
      case 'concluído':
      case 'concluido':
        return StatusCalculoRegistrado.CONCLUIDO;
      case 'rascunho':
        return StatusCalculoRegistrado.RASCUNHO;
      case 'ajustar':
        return StatusCalculoRegistrado.AJUSTAR;
      default:
        return StatusCalculoRegistrado.RASCUNHO;
    }
  }

  /**
   * Converte string para enum de certificação
   */
  parseCertificacao(certificacao: string): TipoCertificacao {
    switch (certificacao.toLowerCase()) {
      case 'certificado':
        return TipoCertificacao.CERTIFICADO;
      case 'em certificação':
      case 'em certificacao':
        return TipoCertificacao.EM_CERTIFICACAO;
      case 'não iniciado':
      case 'nao iniciado':
        return TipoCertificacao.NAO_INICIADO;
      case 'não certificado':
      case 'nao certificado':
        return TipoCertificacao.NAO_CERTIFICADO;
      default:
        return TipoCertificacao.NAO_INICIADO;
    }
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
          errorMessage = 'Dados inválidos fornecidos';
          break;
        case 401:
          errorMessage = 'Não autorizado. Faça login novamente';
          break;
        case 403:
          errorMessage = 'Acesso negado';
          break;
        case 404:
          errorMessage = 'Cálculo não encontrado';
          break;
        case 409:
          errorMessage = 'Conflito: CAR já existe';
          break;
        case 500:
          errorMessage = 'Erro interno do servidor';
          break;
        default:
          errorMessage = `Erro ${error.status}: ${error.message}`;
      }
    }
    
    console.error('Erro no CalculoRegistradoService:', error);
    return throwError(() => new Error(errorMessage));
  };
}