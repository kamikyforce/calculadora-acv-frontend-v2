import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CategoriaLeite {
  id: number;
  categoria: string;
  idade: string;
  dataCriacao?: string;
  dataAtualizacao?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CategoriaLeiteService {
  private readonly baseUrl = `${environment.apiUrl}/api/categoria-leite`;

  constructor(private http: HttpClient) {}

  listar(): Observable<CategoriaLeite[]> {
    return this.http.get<CategoriaLeite[]>(this.baseUrl);
  }

  buscarPorId(id: number): Observable<CategoriaLeite> {
    return this.http.get<CategoriaLeite>(`${this.baseUrl}/${id}`);
  }
}