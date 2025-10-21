import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CategoriaLoteRequest {
  loteId: number;
  quantidadeAnimais: number;
  pesoMedio: number;
  categoriaCorteId?: number;
  categoriaLeiteId?: number;
  observacoes?: string;
  animaisComprados?: number;
  pesoMedioComprados?: number;
  animaisVendidos?: number;
  pesoMedioVendidos?: number;
  permanenciaMeses?: number;
  idadeDesmame?: number;
  femeasPrenhasPercentual?: number;
  producaoLeiteAno?: number;
  teorGorduraLeite?: number;
  teorProteinaLeite?: number;
}

export interface CategoriaLoteResponse {
  id: number;
  loteId: number;
  quantidadeAnimais: number;
  pesoMedio: number;
  categoriaCorteId?: number;
  categoriaLeiteId?: number;
  observacoes?: string;
  animaisComprados?: number;
  pesoMedioComprados?: number;
  animaisVendidos?: number;
  pesoMedioVendidos?: number;
  permanenciaMeses?: number;
  idadeDesmame?: number;
  femeasPrenhasPercentual?: number;
  producaoLeiteAno?: number;
  teorGorduraLeite?: number;
  teorProteinaLeite?: number;
  dataCriacao: string;
  dataAtualizacao: string;
}

@Injectable({
  providedIn: 'root'
})
export class CategoriaLoteService {
  private readonly baseUrl = `${environment.apiUrl}/categoria-lote`;

  constructor(private http: HttpClient) {}

  criar(request: CategoriaLoteRequest): Observable<CategoriaLoteResponse> {
    return this.http.post<CategoriaLoteResponse>(this.baseUrl, request);
  }

  listarPorLote(loteId: number): Observable<CategoriaLoteResponse[]> {
    return this.http.get<CategoriaLoteResponse[]>(`${this.baseUrl}/lote/${loteId}`);
  }

  buscarPorId(id: number): Observable<CategoriaLoteResponse> {
    return this.http.get<CategoriaLoteResponse>(`${this.baseUrl}/${id}`);
  }

  atualizar(id: number, request: CategoriaLoteRequest): Observable<CategoriaLoteResponse> {
    return this.http.put<CategoriaLoteResponse>(`${this.baseUrl}/${id}`, request);
  }

  deletar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}