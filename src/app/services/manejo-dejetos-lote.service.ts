import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ManejoDejetosLoteRequest {
  loteId: number;
  categoriaAnimal: string;
  tipoManejo: string;
  percentualRebanho: number;
}

export interface ManejoDejetosLoteResponse {
  id: number;
  loteId: number;
  categoriaAnimal: string;
  tipoManejo: string;
  percentualRebanho: number;
  dataCriacao: string;
  dataAtualizacao: string;
}

@Injectable({
  providedIn: 'root'
})
export class ManejoDejetosLoteService {
  private readonly baseUrl = `${environment.apiUrl}/manejo-dejetos-lote`;

  constructor(private http: HttpClient) {}

  criar(request: ManejoDejetosLoteRequest): Observable<ManejoDejetosLoteResponse> {
    return this.http.post<ManejoDejetosLoteResponse>(this.baseUrl, request);
  }

  listarPorLote(loteId: number): Observable<ManejoDejetosLoteResponse[]> {
    return this.http.get<ManejoDejetosLoteResponse[]>(`${this.baseUrl}/lote/${loteId}`);
  }

  buscarPorId(id: number): Observable<ManejoDejetosLoteResponse> {
    return this.http.get<ManejoDejetosLoteResponse>(`${this.baseUrl}/${id}`);
  }

  atualizar(id: number, request: ManejoDejetosLoteRequest): Observable<ManejoDejetosLoteResponse> {
    return this.http.put<ManejoDejetosLoteResponse>(`${this.baseUrl}/${id}`, request);
  }

  deletar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  listarTipos(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/tipos`);
  }
}