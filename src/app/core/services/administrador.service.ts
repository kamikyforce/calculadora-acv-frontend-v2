import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AdministradorResponse,
  AdministradorCreateRequest,
  AdministradorUpdateRequest,
  AdministradorRequest,
  UsuarioResponse,
  UsuarioCreateRequest
} from '../models/administrador.model';

@Injectable({
  providedIn: 'root'
})
export class AdministradorService {
  private apiUrl = `${environment.apiUrl}`;
  
  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor(private http: HttpClient) {}

  // Bypass authentication for development
  verificarAutenticacao(): Observable<any> {
    return of({
      authenticated: true,
      user: {
        id: "1",
        nome: "Administrador",
        email: "admin@bndes.gov.br",
        cpf: "00000000000",
        tipo: "ADMINISTRADOR",
        perfis: ["ADMIN"]
      }
    });
  }

  loginPublico(credentials: { username: string; password: string }): Observable<any> {
    return this.verificarAutenticacao();
  }

  criar(administradorData: AdministradorCreateRequest): Observable<AdministradorResponse> {
    console.log('Criando administrador com dados completos:', administradorData);
    console.log('URL da API:', `${this.apiUrl}/administradores`);
    
    const cpfLimpo = administradorData.cpf.replace(/\D/g, '');
    
    return this.http.get<UsuarioResponse>(`${this.apiUrl}/usuarios/cpf/${cpfLimpo}`, this.httpOptions)
      .pipe(
        switchMap((usuarioExistente: UsuarioResponse) => {
          console.log('Usuário encontrado com CPF:', usuarioExistente);
          
          return this.http.get<AdministradorResponse[]>(`${this.apiUrl}/administradores`, this.httpOptions)
            .pipe(
              switchMap((administradores: AdministradorResponse[]) => {
                const jaEhAdmin = administradores.some(admin => admin.usuario.cpf === cpfLimpo);
                
                if (jaEhAdmin) {
                  throw new Error('Este CPF já está cadastrado como administrador.');
                }
                
                const adminRequest: AdministradorRequest = {
                  usuarioId: parseInt(usuarioExistente.id, 10),
                  orgao: administradorData.orgao,
                  perfilId: administradorData.perfilId || 1
                };
                
                console.log('Criando administrador com usuário existente:', adminRequest);
                
                return this.http.post<AdministradorResponse>(
                  `${this.apiUrl}/administradores`,
                  adminRequest,
                  this.httpOptions
                );
              })
            );
        }),
        catchError((error) => {
          if (error.status === 404) {
            console.log('Usuário não encontrado, criando novo usuário');
            
            const userRequest: UsuarioCreateRequest = {
              nome: administradorData.nome,
              email: administradorData.email,
              cpf: cpfLimpo,
              tipo: 'ADMINISTRADOR'
            };

            console.log('Criando usuário primeiro:', userRequest);

            return this.http.post<UsuarioResponse>(`${this.apiUrl}/usuarios`, userRequest, this.httpOptions)
              .pipe(
                switchMap((userResponse: UsuarioResponse) => {
                  console.log('Usuário criado, resposta:', userResponse);
                  
                  // Depois, criar o administrador com o ID do usuário
                  const adminRequest: AdministradorRequest = {
                    usuarioId: parseInt(userResponse.id, 10),
                    orgao: administradorData.orgao,
                    perfilId: administradorData.perfilId || 1
                  };
                  
                  console.log('Criando administrador:', adminRequest);
                  
                  return this.http.post<AdministradorResponse>(
                    `${this.apiUrl}/administradores`,
                    adminRequest,
                    this.httpOptions
                  );
                }),
                catchError(this.handleError)
              );
          }
          
          return throwError(() => error);
        })
      );
  }

  // List administrators
  listar(): Observable<AdministradorResponse[]> {
    console.log('Listando administradores da URL:', `${this.apiUrl}/administradores`);
    
    return this.http.get<AdministradorResponse[]>(
      `${this.apiUrl}/administradores`,
      this.httpOptions
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Update administrator partially - only orgao and perfilId
  atualizarParcial(id: number, updateData: AdministradorUpdateRequest): Observable<AdministradorResponse> {
    console.log('Atualizando administrador ID:', id, 'com dados parciais:', updateData);
    console.log('URL da API:', `${this.apiUrl}/administradores/${id}`);
    
    // First, get the administrator to extract the correct user ID
    return this.http.get<AdministradorResponse>(`${this.apiUrl}/administradores/${id}`, this.httpOptions)
      .pipe(
        switchMap((adminResponse: AdministradorResponse) => {
          console.log('Administrador encontrado:', adminResponse);
          
          const userId = parseInt(adminResponse.usuario.id, 10);
          console.log('ID do usuário extraído:', userId);
          
          // Create the administrator request with existing user ID
          const adminRequest: AdministradorRequest = {
            usuarioId: userId,
            orgao: updateData.orgao,
            perfilId: updateData.perfilId
          };
          
          console.log('Atualizando administrador com dados:', adminRequest);
          
          return this.http.put<AdministradorResponse>(
            `${this.apiUrl}/administradores/${id}`,
            adminRequest,
            this.httpOptions
          );
        }),
        catchError(this.handleError)
      );
  }

  // Update administrator - FIXED to use correct user ID from administrator record
  atualizar(id: number, administradorData: AdministradorCreateRequest): Observable<AdministradorResponse> {
    console.log('Atualizando administrador ID:', id, 'com dados completos:', administradorData);
    console.log('URL da API:', `${this.apiUrl}/administradores/${id}`);
    
    // First, get the administrator to extract the correct user ID
    return this.http.get<AdministradorResponse>(`${this.apiUrl}/administradores/${id}`, this.httpOptions)
      .pipe(
        switchMap((adminResponse: AdministradorResponse) => {
          console.log('Administrador encontrado:', adminResponse);
          
          const userId = parseInt(adminResponse.usuario.id, 10);
          console.log('ID do usuário extraído:', userId);
          
          // Update the user with the correct user ID
          const userRequest: UsuarioCreateRequest = {
            nome: administradorData.nome,
            email: administradorData.email,
            cpf: administradorData.cpf.replace(/\D/g, ''),
            tipo: 'ADMINISTRADOR'
          };
  
          console.log('Atualizando usuário ID:', userId, 'com dados:', userRequest);
  
          return this.http.put<UsuarioResponse>(`${this.apiUrl}/usuarios/${userId}`, userRequest, this.httpOptions)
            .pipe(
              switchMap((userResponse: UsuarioResponse) => {
                console.log('Usuário atualizado:', userResponse);
                
                // Then update the administrator
                const adminRequest: AdministradorRequest = {
                  usuarioId: parseInt(userResponse.id, 10),
                  orgao: administradorData.orgao,
                  perfilId: administradorData.perfilId || 1
                };
                
                console.log('Atualizando administrador com dados:', adminRequest);
                
                return this.http.put<AdministradorResponse>(
                  `${this.apiUrl}/administradores/${id}`,
                  adminRequest,
                  this.httpOptions
                );
              })
            );
        }),
        catchError(this.handleError)
      );
  }

  // Delete administrator
  deletar(id: number): Observable<void> {
    console.log('Deletando administrador ID:', id);
    console.log('URL da API:', `${this.apiUrl}/administradores/${id}`);
    
    return this.http.delete<void>(
      `${this.apiUrl}/administradores/${id}`,
      this.httpOptions
    ).pipe(
      catchError(this.handleError)
    );
  }

  ativar(id: number): Observable<void> {
    console.log('Ativando administrador ID:', id);
    
    return this.http.patch<void>(`${this.apiUrl}/administradores/${id}/ativar`, {}, {
      ...this.httpOptions,
      withCredentials: true
    }).pipe(
      catchError(this.handleError)
    );
  }

  desativar(id: number): Observable<void> {
    console.log('Desativando administrador ID:', id);
    
    return this.http.patch<void>(`${this.apiUrl}/administradores/${id}/desativar`, {}, {
      ...this.httpOptions,
      withCredentials: true
    }).pipe(
      catchError(this.handleError)
    );
  }

  // List users
  listarUsuarios(): Observable<UsuarioResponse[]> {
    console.log('Listando usuários');
    console.log('URL da API:', `${this.apiUrl}/usuarios`);
    
    return this.http.get<UsuarioResponse[]>(`${this.apiUrl}/usuarios`, this.httpOptions)
      .pipe(catchError(this.handleError));
  }
  
  // Verificar se usuário está inativo no administrador
  verificarUsuarioInativoAdministrador(cpf: string): Observable<boolean> {
    const cpfLimpo = cpf.replace(/\D/g, '');
    console.log('Verificando se usuário está inativo no administrador:', cpfLimpo);
    
    return this.http.get<boolean>(`${this.apiUrl}/administradores/verificar-usuario-inativo/${cpfLimpo}`, this.httpOptions)
      .pipe(catchError(this.handleError));
  }

  // Verificar se CPF está vinculado a indústrias ou certificadoras
  verificarCpfVinculado(cpf: string): Observable<{vinculado: boolean, entidades: Array<{tipo: string, nome: string}>}> {
    const cpfLimpo = cpf.replace(/\D/g, '');
    console.log('Verificando CPF vinculado:', cpfLimpo);
    
    return this.http.get<{vinculado: boolean, entidades: Array<{tipo: string, nome: string}>}>(
      `${this.apiUrl}/administradores/verificar-cpf-vinculado/${cpfLimpo}`,
      { withCredentials: true }
    ).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('Erro detalhado da API:', {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      message: error.message,
      error: error.error
    });
    
    if (error.status === 0) {
      console.error('❌ ERRO DE CONEXÃO: Backend não está rodando ou proxy não está funcionando');
      console.error('🔧 Verifique se:');
      console.error('   1. Backend está rodando na porta 8080');
      console.error('   2. Frontend foi iniciado com: npm start (que usa o proxy)');
      console.error('   3. Proxy está configurado corretamente');
    }
    
    const errorMessage = error.error?.message || error.message || `HTTP ${error.status}: ${error.statusText}`;
    return throwError(() => new Error(errorMessage));
  }
}