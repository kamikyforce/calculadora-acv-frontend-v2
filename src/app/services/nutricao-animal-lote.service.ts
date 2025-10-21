import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// Alinha os DTOs do frontend com o backend (NutricaoAnimalLote)
export type SistemaProducao = 'PASTO' | 'SEMI_CONFINADO' | 'CONFINADO';
export type OrigemProducao = 'INTERNA' | 'EXTERNA';

export interface IngredienteDietaLoteItem {
  id?: number;
  nutricaoLoteId?: number;
  nomeIngrediente: string;
  quantidadeKgCabDia: number;
  ofertaDiasAno: number;
  producao: string;
  dataCriacao?: Date;
}

export interface ConcentradoDietaLoteItem {
  id?: number;
  nutricaoLoteId?: number;
  nomeConcentrado?: string;
  proteinaBrutaPercentual: number;
  ureia: string;
  subproduto: string;
  quantidade: number;
  oferta: number;
  dataCriacao?: Date;
}

export interface AditivoDietaLoteItem {
  id?: number;
  nutricaoLoteId?: number;
  nomeAditivo?: string;
  tipo: string;
  dose: number;
  oferta: number;
  percentualAdicional: number;
  dataCriacao?: Date;
}

export interface NutricaoAnimalLoteRequest {
  loteId: number;
  inserirDadosDieta: boolean;
  sistemaProducao?: SistemaProducao;
  tempoPastoHorasDia?: number; // BigDecimal no backend
  tempoPastoDiasAno?: number;
  ingredientes?: IngredienteDietaLoteItem[];
  concentrados?: ConcentradoDietaLoteItem[];
  aditivos?: AditivoDietaLoteItem[];
}

export interface NutricaoAnimalLoteResponse {
  id: number;
  loteId: number;
  inserirDadosDieta: boolean;
  sistemaProducao?: SistemaProducao;
  tempoPastoHorasDia?: number;
  tempoPastoDiasAno?: number;
  dataCriacao: string;
  dataAtualizacao: string;
  ingredientes?: IngredienteDietaLoteItem[];
  concentrados?: ConcentradoDietaLoteItem[];
  aditivos?: AditivoDietaLoteItem[];
}

@Injectable({
  providedIn: 'root'
})
export class NutricaoAnimalLoteService {
  private readonly baseUrl = `${environment.apiUrl}/nutricao-animal-lote`;

  constructor(private http: HttpClient) {}

  criar(request: NutricaoAnimalLoteRequest): Observable<NutricaoAnimalLoteResponse> {
    return this.http.post<NutricaoAnimalLoteResponse>(this.baseUrl, request);
  }

  listarPorLote(loteId: number): Observable<NutricaoAnimalLoteResponse[]> {
    return this.http.get<NutricaoAnimalLoteResponse[]>(`${this.baseUrl}/lote/${loteId}`);
  }

  buscarPorId(id: number): Observable<NutricaoAnimalLoteResponse> {
    return this.http.get<NutricaoAnimalLoteResponse>(`${this.baseUrl}/${id}`);
  }

  atualizar(id: number, request: NutricaoAnimalLoteRequest): Observable<NutricaoAnimalLoteResponse> {
    return this.http.put<NutricaoAnimalLoteResponse>(`${this.baseUrl}/${id}`, request);
  }

  deletar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}