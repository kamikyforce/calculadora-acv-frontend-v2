import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CategoriaCorte {
  id: number;
  categoria: string;
  idade: string;
  dataCriacao?: string;
  dataAtualizacao?: string;
}

@Injectable({ providedIn: 'root' })
export class CategoriaCorteService {
  private readonly baseUrl = `${environment.apiUrl}/bd-categorias-corte`;

  constructor(private http: HttpClient) {}

  listar(): Observable<CategoriaCorte[]> {
    return this.http.get<CategoriaCorte[]>(this.baseUrl);
  }
}