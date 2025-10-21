import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';

export interface UsuarioIndustriaRequest {
  cpf: string;
  nome: string;
  dataCadastro?: string;
  ativo?: boolean;
}

export interface IndustriaRequest {
  nome: string;
  cnpj: string;
  estado: string;
  tipo: TipoIndustria;
  ativo?: boolean;
  usuarios?: UsuarioIndustriaRequest[];
  inventariosTratados?: number;
}

export interface IndustriaResponse {
  id: number;
  nome: string;
  cnpj: string;
  dataCadastro: string;
  inventariosTratados: number;
  estado: string;
  tipo: TipoIndustria;
  ativo: boolean;
}

export enum TipoIndustria {
  INDUSTRIA = 'INDUSTRIA'
}

export interface UsuarioAtivoInfo {
  tipo: string; // "industria" ou "certificadora"
  nome: string;
  id?: number;
}

@Injectable({
  providedIn: 'root'
})
export class IndustriaService {
  private readonly apiUrl = `${environment.apiUrl}/industrias`;

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

  // GET /industrias - Lista com filtros opcionais
  listar(estado?: string, ativo?: boolean): Observable<IndustriaResponse[]> {
    let params = new HttpParams();
    
    if (estado) {
      params = params.set('estado', estado);
    }
    if (ativo !== undefined) {
      params = params.set('ativo', ativo.toString());
    }

    return this.http.get<IndustriaResponse[]>(this.apiUrl, { 
      params, 
      withCredentials: true 
    }).pipe(
      tap(response => console.log('Indústrias loaded:', response.length)),
      catchError(this.handleError)
    );
  }

  // GET /industrias/{id} - Busca por ID
  buscarPorId(id: number): Observable<IndustriaResponse> {
    return this.http.get<IndustriaResponse>(`${this.apiUrl}/${id}`, {
      withCredentials: true
    }).pipe(
      tap(response => console.log('Indústria found:', response)),
      catchError(this.handleError)
    );
  }

  // POST /industrias - Criar nova indústria
  criar(industria: IndustriaRequest): Observable<IndustriaResponse> {
    return this.http.post<IndustriaResponse>(this.apiUrl, industria, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    }).pipe(
      tap(response => console.log('Indústria created:', response)),
      catchError(this.handleError)
    );
  }

  // PUT /industrias/{id} - Atualizar indústria
  atualizar(id: number, industria: IndustriaRequest): Observable<IndustriaResponse> {
    return this.http.put<IndustriaResponse>(`${this.apiUrl}/${id}`, industria, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    }).pipe(
      tap(response => console.log('Indústria updated:', response)),
      catchError(this.handleError)
    );
  }

  // DELETE /industrias/{id} - Deletar indústria
  deletar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, {
      withCredentials: true
    }).pipe(
      tap(() => console.log('Indústria deleted:', id)),
      catchError(this.handleError)
    );
  }

  // PATCH /industrias/{id}/ativar - Ativar indústria
  ativar(id: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/ativar`, {}, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    }).pipe(
      tap(() => console.log('Indústria activated:', id)),
      catchError(this.handleError)
    );
  }

  // PATCH /industrias/{id}/desativar - Desativar indústria
  desativar(id: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/desativar`, {}, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    }).pipe(
      tap(() => console.log('Indústria deactivated:', id)),
      catchError(this.handleError)
    );
  }

  buscarUsuarios(industriaId: number): Observable<UsuarioIndustriaRequest[]> {
    return this.http.get<UsuarioIndustriaRequest[]>(`${this.apiUrl}/${industriaId}/usuarios`, {
      withCredentials: true
    }).pipe(
      tap(usuarios => console.log('Usuários da indústria carregados:', usuarios)),
      catchError(this.handleError)
    );
  }

  buscarUsuarioPorCpf(cpf: string): Observable<any> {
    const cpfLimpo = cpf.replace(/\D/g, '');
    return this.http.get<any>(`${environment.apiUrl}/usuarios/cpf/${cpfLimpo}`, {
      withCredentials: true
    }).pipe(
      tap(usuario => console.log('Usuário encontrado por CPF:', usuario)),
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
    return this.http.get<boolean>(`${this.apiUrl}/verificar-cnpj/${cnpj}`, {
      withCredentials: true
    }).pipe(
      tap(existe => console.log('CNPJ existe:', existe)),
      catchError(this.handleError)
    );
  }

  verificarCpfExisteEmOutraIndustria(cpf: string, industriaId?: number): Observable<boolean> {
    let params = new HttpParams();
    if (industriaId) {
      params = params.set('industriaId', industriaId.toString());
    }
    
    return this.http.get<boolean>(`${this.apiUrl}/verificar-cpf/${cpf}`, { 
      params,
      withCredentials: true
    }).pipe(
      tap(existe => console.log('CPF existe em outra indústria:', existe)),
      catchError(this.handleError)
    );
  }

  verificarCnpjExisteEmCertificadora(cnpj: string): Observable<boolean> {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    return this.http.get<boolean>(`${environment.apiUrl}/certificadoras/cnpj/${cnpjLimpo}/existe`, {
      withCredentials: true
    }).pipe(
      tap(existe => console.log('CNPJ existe em certificadora:', existe)),
      catchError(this.handleError)
    );
  }

  verificarCpfExisteEmCertificadora(cpf: string): Observable<boolean> {
    const cpfLimpo = cpf.replace(/\D/g, '');
    return this.http.get<boolean>(`${environment.apiUrl}/certificadoras/cpf/${cpfLimpo}/existe`, {
      withCredentials: true
    }).pipe(
      tap(existe => console.log('CPF existe em certificadora:', existe)),
      catchError(this.handleError)
    );
  }

  verificarUsuarioAtivoEmOutroLocal(cpf: string, industriaId?: number): Observable<UsuarioAtivoInfo | null> {
    let params = new HttpParams();
    if (industriaId) {
      params = params.set('industriaId', industriaId.toString());
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