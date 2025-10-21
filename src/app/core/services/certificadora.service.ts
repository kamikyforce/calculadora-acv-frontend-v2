import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';

export interface UsuarioCertificadoraRequest {
  cpf: string;
  nome: string;
  dataCadastro?: string;
  ativo?: boolean;
}

export interface CertificadoraRequest {
  nome: string;
  cnpj: string;
  estado: string;
  tipo: TipoCertificadora;
  ativo: boolean;
  usuarios?: UsuarioCertificadoraRequest[];
}

export interface CertificadoraResponse {
  id: number;
  nome: string;
  cnpj: string;
  estado: string;
  tipo: TipoCertificadora;
  ativo: boolean;
  dataCadastro?: string;
  inventariosTratados?: number;
}

export enum TipoCertificadora {
  FRIGORIFICO = 'FRIGORIFICO',
  LATICINIO = 'LATICINIO',
  AMBOS = 'AMBOS'
}

export interface UsuarioAtivoInfo {
  tipo: string;
  nome: string;
  id?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CertificadoraService {
  private readonly apiUrl = `${environment.apiUrl}/certificadoras`;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  private handleError = (error: HttpErrorResponse): Observable<never> => {
    console.error('API Error:', error);
    
    if (error.status === 401) {
      console.log('Authentication required, redirecting to login...');
      this.router.navigate(['/login']);
    } else if (error.status === 403) {
      console.error('Access forbidden');
    } else if (error.status === 404) {
      console.error('Resource not found');
    } else if (error.status === 400) {
      console.error('Bad request - validation error:', error.error);
    }
    
    return throwError(() => error);
  }

  // GET /certificadoras - Lista com filtros opcionais
  listar(estado?: string, tipo?: TipoCertificadora, ativo?: boolean): Observable<CertificadoraResponse[]> {
    let params = new HttpParams();
    
    if (estado) {
      params = params.set('estado', estado);
    }
    if (tipo) {
      params = params.set('tipo', tipo);
    }
    if (ativo !== undefined) {
      params = params.set('ativo', ativo.toString());
    }

    return this.http.get<CertificadoraResponse[]>(this.apiUrl, { 
      params, 
      withCredentials: true 
    }).pipe(
      tap(response => console.log('Certificadoras loaded:', response.length)),
      catchError(this.handleError)
    );
  }

  // GET /certificadoras/{id} - Busca por ID
  buscarPorId(id: number): Observable<CertificadoraResponse> {
    return this.http.get<CertificadoraResponse>(`${this.apiUrl}/${id}`, {
      withCredentials: true
    }).pipe(
      tap(response => console.log('Certificadora found:', response)),
      catchError(this.handleError)
    );
  }

  // POST /certificadoras - Criar nova certificadora
  criar(certificadora: CertificadoraRequest): Observable<CertificadoraResponse> {
    return this.http.post<CertificadoraResponse>(this.apiUrl, certificadora, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    }).pipe(
      tap(response => console.log('Certificadora created:', response)),
      catchError(this.handleError)
    );
  }

  // PUT /certificadoras/{id} - Atualizar certificadora
  atualizar(id: number, certificadora: CertificadoraRequest): Observable<CertificadoraResponse> {
    return this.http.put<CertificadoraResponse>(`${this.apiUrl}/${id}`, certificadora, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    }).pipe(
      tap(response => console.log('Certificadora updated:', response)),
      catchError(this.handleError)
    );
  }

  // DELETE /certificadoras/{id} - Deletar certificadora
  deletar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, {
      withCredentials: true
    }).pipe(
      tap(() => console.log('Certificadora deleted:', id)),
      catchError(this.handleError)
    );
  }

  // PATCH /certificadoras/{id}/ativar - Ativar certificadora
  ativar(id: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/ativar`, {}, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    }).pipe(
      tap(() => console.log('Certificadora activated:', id)),
      catchError(this.handleError)
    );
  }

  // PATCH /certificadoras/{id}/desativar - Desativar certificadora
  desativar(id: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/desativar`, {}, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    }).pipe(
      tap(() => console.log('Certificadora deactivated:', id)),
      catchError(this.handleError)
    );
  }
  
  buscarUsuarios(certificadoraId: number): Observable<UsuarioCertificadoraRequest[]> {
    return this.http.get<UsuarioCertificadoraRequest[]>(`${this.apiUrl}/${certificadoraId}/usuarios`, {
      withCredentials: true
    }).pipe(
      tap(response => console.log('Usuarios da certificadora loaded:', response)),
      catchError(this.handleError)
    );
  }
  
  buscarUsuarioPorCpf(cpf: string): Observable<any> {
    const cpfLimpo = cpf.replace(/\D/g, '');
    return this.http.get<any>(`${environment.apiUrl}/usuarios/cpf/${cpfLimpo}`, {
      withCredentials: true
    }).pipe(
      tap(response => console.log('Usuario encontrado por CPF:', response)),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          console.log('CPF não encontrado na base de dados');
          return of(null);
        }
        return this.handleError(error);
      })
    );
  }
  
  verificarCnpjExiste(cnpj: string): Observable<boolean> {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    return this.http.get<boolean>(`${this.apiUrl}/cnpj/${cnpjLimpo}/existe`, {
      withCredentials: true
    }).pipe(
      tap(response => console.log('CNPJ existe:', response)),
      catchError(this.handleError)
    );
  }
  
  verificarCpfExisteEmOutraCertificadora(cpf: string, certificadoraId?: number): Observable<boolean> {
    const cpfLimpo = cpf.replace(/\D/g, '');
    let url = `${this.apiUrl}/cpf/${cpfLimpo}/existe`;
    
    if (certificadoraId !== undefined) {
      url += `?certificadoraId=${certificadoraId}`;
    }
    
    return this.http.get<boolean>(url, {
      withCredentials: true
    }).pipe(
      tap(response => console.log('CPF existe em outra certificadora:', response)),
      catchError(this.handleError)
    );
  }

  verificarCnpjExisteEmIndustria(cnpj: string): Observable<boolean> {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    return this.http.get<boolean>(`${environment.apiUrl}/industrias/cnpj/${cnpjLimpo}/existe`, {
      withCredentials: true
    }).pipe(
      tap(existe => console.log('CNPJ existe em indústria:', existe)),
      catchError(this.handleError)
    );
  }

  verificarCpfExisteEmIndustria(cpf: string): Observable<boolean> {
    const cpfLimpo = cpf.replace(/\D/g, '');
    return this.http.get<boolean>(`${environment.apiUrl}/industrias/verificar-cpf/${cpfLimpo}`, {
      withCredentials: true
    }).pipe(
      tap(existe => console.log('CPF existe em indústria:', existe)),
      catchError(this.handleError)
    );
  }
  
  verificarUsuarioAtivoEmOutroLocal(cpf: string, certificadoraId?: number): Observable<UsuarioAtivoInfo | null> {
    let params = new HttpParams();
    if (certificadoraId) {
      params = params.set('certificadoraId', certificadoraId.toString());
    }

    return this.http.get<UsuarioAtivoInfo | null>(`${this.apiUrl}/verificar-usuario-ativo/${cpf}`, {
      params,
      withCredentials: true
    }).pipe(
      tap(response => console.log('Usuario ativo info:', response)),
      catchError(this.handleError)
    );
  }
}