import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface InventarioJornadaRequest {
  usuarioId: number;
  nome: string;
  descricao?: string;
  tipoRebanho: string;
  faseAtual?: number;
  status?: 'RASCUNHO' | 'EM_ANDAMENTO' | 'CONCLUIDO';
  fasesConcluidas?: { [key: number]: boolean };
}

export interface InventarioJornadaResponse {
  id: number;
  usuarioId: number;
  nome: string;
  descricao?: string;
  tipoRebanho: string;
  faseAtual: number;
  status: 'RASCUNHO' | 'EM_ANDAMENTO' | 'CONCLUIDO';
  fasesConcluidas: { [key: number]: boolean };
  dataCriacao: Date;
  dataAtualizacao: Date;
}

@Injectable({
  providedIn: 'root'
})
export class InventarioJornadaService {
  private readonly apiUrl = `${environment.apiUrl}/inventarios-jornada`;

  constructor(private readonly http: HttpClient) {}

  criar(usuarioId: number, request: InventarioJornadaRequest): Observable<InventarioJornadaResponse> {
    return this.http.post<InventarioJornadaResponse>(`${this.apiUrl}/usuario/${usuarioId}`, request, { withCredentials: true });
  }

  listarPorUsuario(usuarioId: number): Observable<InventarioJornadaResponse[]> {
    return this.http.get<InventarioJornadaResponse[]>(`${this.apiUrl}/usuario/${usuarioId}`, { withCredentials: true });
  }

  listarPorUsuarioEStatus(usuarioId: number, status: string): Observable<InventarioJornadaResponse[]> {
    const params = new HttpParams().set('status', status);
    return this.http.get<InventarioJornadaResponse[]>(`${this.apiUrl}/usuario/${usuarioId}`, { params, withCredentials: true });
  }

  buscarPorId(id: number): Observable<InventarioJornadaResponse> {
    return this.http.get<InventarioJornadaResponse>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  atualizar(id: number, usuarioId: number, request: InventarioJornadaRequest): Observable<InventarioJornadaResponse> {
    return this.http.put<InventarioJornadaResponse>(`${this.apiUrl}/${id}/usuario/${usuarioId}`, request, { withCredentials: true });
  }

  deletar(id: number, usuarioId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/usuario/${usuarioId}`, { withCredentials: true });
  }

  avancarFase(id: number, usuarioId: number): Observable<InventarioJornadaResponse> {
    return this.http.patch<InventarioJornadaResponse>(`${this.apiUrl}/${id}/usuario/${usuarioId}/avancar-fase`, {}, { withCredentials: true });
  }

  marcarFaseConcluida(id: number, usuarioId: number, fase: number): Observable<InventarioJornadaResponse> {
    return this.http.patch<InventarioJornadaResponse>(`${this.apiUrl}/${id}/usuario/${usuarioId}/fase/${fase}/concluir`, {}, { withCredentials: true });
  }
}