import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LoteRebanhoRequest {
  inventarioId: number;
  nome: string;
  ordem: number;
  observacoes?: string;
}

export interface LoteRebanhoResponse {
  id: number;
  inventarioId: number;
  nome: string;
  ordem: number;
  observacoes?: string;
  dataCriacao: Date;
  dataAtualizacao: Date;
}

export interface ReordenarLotesRequest {
  loteIds: number[];
}

@Injectable({
  providedIn: 'root'
})
export class LoteRebanhoService {
  private readonly apiUrl = `${environment.apiUrl}/lotes-rebanho`;

  constructor(private readonly http: HttpClient) {}

  criar(request: LoteRebanhoRequest): Observable<LoteRebanhoResponse> {
    return this.http.post<LoteRebanhoResponse>(this.apiUrl, request);
  }

  listarPorInventario(inventarioId: number): Observable<LoteRebanhoResponse[]> {
    return this.http.get<LoteRebanhoResponse[]>(`${this.apiUrl}/inventario/${inventarioId}`);
  }

  buscarPorId(id: number): Observable<LoteRebanhoResponse> {
    return this.http.get<LoteRebanhoResponse>(`${this.apiUrl}/${id}`);
  }

  atualizar(id: number, request: LoteRebanhoRequest): Observable<LoteRebanhoResponse> {
    return this.http.put<LoteRebanhoResponse>(`${this.apiUrl}/${id}`, request);
  }

  deletar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  deletarTodosPorInventario(inventarioId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/inventario/${inventarioId}`);
  }

  reordenarLotes(inventarioId: number, request: ReordenarLotesRequest): Observable<LoteRebanhoResponse[]> {
    return this.http.patch<LoteRebanhoResponse[]>(`${this.apiUrl}/inventario/${inventarioId}/reordenar`, request);
  }
}