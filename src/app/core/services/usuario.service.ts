import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { UsuarioResponse, UsuarioCreateRequest } from '../models/administrador.model';

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Create a new user
  criar(usuario: UsuarioCreateRequest): Observable<UsuarioResponse> {
    return this.http.post<UsuarioResponse>(
      `${this.apiUrl}/usuarios`,
      usuario,
      { withCredentials: true }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // List all users
  listar(): Observable<UsuarioResponse[]> {
    return this.http.get<UsuarioResponse[]>(
      `${this.apiUrl}/usuarios`,
      { withCredentials: true }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Get user by ID
  buscarPorId(id: number): Observable<UsuarioResponse> {
    return this.http.get<UsuarioResponse>(
      `${this.apiUrl}/usuarios/${id}`,
      { withCredentials: true }
    ).pipe(
      catchError(this.handleError)
    );
  }

  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'Erro desconhecido';
    
    if (error.status === 0) {
      errorMessage = 'Erro de rede - verifique se o backend está rodando';
    } else if (error.status === 401) {
      errorMessage = 'Não autorizado - faça login novamente';
    } else if (error.status === 403) {
      errorMessage = 'Acesso negado';
    } else if (error.status === 404) {
      errorMessage = 'Usuário não encontrado';
    } else if (error.status >= 500) {
      errorMessage = 'Erro interno do servidor';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }
    
    console.error('Erro na API de Usuários:', error);
    return throwError(() => new Error(errorMessage));
  }
}