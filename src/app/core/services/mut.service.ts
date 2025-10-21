import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { MutRequest, MutResponse, MutFiltros, MutStats, MutPagedResponse, TipoMudanca } from '../models/mut.model';

@Injectable({
  providedIn: 'root'
})
export class MutService {
  private readonly API_URL = `${environment.apiUrl}/mut`;

  constructor(
    private http: HttpClient,
    private router: Router
  ) { }

  listar(filtros?: MutFiltros): Observable<MutPagedResponse> {
    let params = new HttpParams();
    
    // Adicionar parâmetros de filtro apenas se tiverem valores válidos
    if (filtros?.tipoMudanca) {
      params = params.set('tipoMudanca', filtros.tipoMudanca);
    }
    if (filtros?.escopo && filtros.escopo.trim() !== '') {
      params = params.set('escopo', filtros.escopo);
    }
    if (filtros?.bioma && filtros.bioma.trim() !== '') {
      params = params.set('bioma', filtros.bioma);
    }
    
    // Adicionar parâmetros de busca por texto - FIXED: usar 'nome' em vez de 'search'
    if (filtros?.termoBusca && filtros.termoBusca.trim() !== '') {
      params = params.set('nome', filtros.termoBusca.trim());
    }
    
    // Adicionar parâmetros de paginação
    if (filtros?.page !== undefined && filtros.page >= 0) {
      params = params.set('page', filtros.page.toString());
    }
    if (filtros?.size !== undefined && filtros.size > 0) {
      params = params.set('size', filtros.size.toString());
    }
    
    // Adicionar parâmetros de ordenação
    if (filtros?.sort && filtros.sort.trim() !== '') {
      params = params.set('sort', filtros.sort);
      if (filtros.direction && filtros.direction.trim() !== '') {
        params = params.set('direction', filtros.direction);
      }
    }
    
    return this.http.get<MutPagedResponse>(`${this.API_URL}`, { params })
      .pipe(
        catchError(this.handleError.bind(this))
      );
  }

  buscarPorId(id: number): Observable<MutResponse> {
    // Validar ID antes de fazer a requisição
    if (!id || id <= 0) {
      console.error('ID inválido para busca:', id);
      return throwError(() => new Error('ID inválido para busca'));
    }
    
    console.log(`🔍 MutService: Buscando fator MUT por ID: ${id}`);
    console.log(`📡 URL da requisição: ${this.API_URL}/${id}`);
    console.log(`🌐 URL completa esperada: http://localhost:8080${this.API_URL}/${id}`);
    
    return this.http.get<MutResponse>(`${this.API_URL}/${id}`, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }).pipe(
      tap(response => {
        console.log(`✅ Fator MUT encontrado:`, response);
      }),
      catchError((error) => {
        console.error(`❌ Erro ao buscar fator MUT ID ${id}:`, {
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          message: error.message,
          error: error.error
        });
        
        // Personalizar mensagem de erro baseada no status
        if (error.status === 400) {
          error.userMessage = 'Requisição inválida. Verifique se o ID é válido.';
        } else if (error.status === 404) {
          error.userMessage = 'Item não encontrado.';
        } else if (error.status === 0) {
          error.userMessage = 'Erro de conexão. Verifique se o servidor está rodando.';
        }
        
        return this.handleError(error);
      })
    );
  }

  criar(mut: MutRequest): Observable<MutResponse> {
    // Validar dados antes de enviar
    const validacao = this.validarDadosMut(mut);
    if (!validacao.valido) {
      return throwError(() => new Error(validacao.erro));
    }

    return this.http.post<MutResponse>(this.API_URL, mut)
      .pipe(
        catchError(this.handleError.bind(this))
      );
  }

  atualizar(id: number, mut: MutRequest): Observable<MutResponse> {
    // Validar dados antes de enviar
    const validacao = this.validarDadosMut(mut);
    if (!validacao.valido) {
      return throwError(() => new Error(validacao.erro));
    }
    
    return this.http.put<MutResponse>(`${this.API_URL}/${id}`, mut)
      .pipe(
        catchError(this.handleError.bind(this))
      );
  }

  private validarDadosMut(mut: MutRequest): { valido: boolean; erro?: string } {
    // Validação básica dos dados obrigatórios

    // Usar propriedades corretas do modelo
    if (mut.tipoMudanca === TipoMudanca.DESMATAMENTO) {
      if (!mut.dadosDesmatamento || mut.dadosDesmatamento.length === 0 || !mut.dadosDesmatamento[0]?.bioma) {
        return { valido: false, erro: 'Selecione um bioma para desmatamento.' };
      }
    }

    if (mut.tipoMudanca === TipoMudanca.VEGETACAO) {
      if (!mut.dadosVegetacao || mut.dadosVegetacao.length === 0) {
        return { valido: false, erro: 'Dados de vegetação são obrigatórios.' };
      }
      if (!mut.dadosVegetacao[0]?.parametro) {
        return { valido: false, erro: 'Selecione um parâmetro para vegetação.' };
      }
      // Removido: bioma não é mais obrigatório para vegetação
      // if (!mut.dadosVegetacao[0]?.bioma) {
      //   return { valido: false, erro: 'Selecione um bioma para vegetação.' };
      // }
    }

    if (mut.tipoMudanca === TipoMudanca.SOLO) {
      if (!mut.dadosSolo || mut.dadosSolo.length === 0 || !mut.dadosSolo[0]?.tipoFatorSolo) {
        return { valido: false, erro: 'Selecione o tipo de fator para solo.' };
      }
    }

    return { valido: true };
  }

  remover(id: number): Observable<void> {
    if (!id || id <= 0) {
      return throwError(() => new Error('ID inválido para remoção'));
    }
    
    return this.http.delete<void>(`${this.API_URL}/${id}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    }).pipe(
      catchError((error) => {
        // Personalizar mensagem de erro baseada no status
        if (error.status === 400) {
          error.userMessage = 'Requisição inválida. Verifique os dados enviados.';
        } else if (error.status === 404) {
          error.userMessage = 'Este item não existe mais ou já foi removido.';
        } else if (error.status === 403) {
          error.userMessage = 'Você não tem permissão para remover este item.';
        } else if (error.status === 409) {
          error.userMessage = 'Este item não pode ser removido pois está sendo usado em outros cálculos.';
        } else if (error.status === 500) {
          error.userMessage = 'Erro interno do servidor. Tente novamente em alguns instantes.';
        }
        
        return this.handleError(error);
      })
    );
  }

  obterEstatisticas(): Observable<MutStats> {
    return this.http.get<MutStats>(`${this.API_URL}/estatisticas`)
      .pipe(catchError(this.handleError.bind(this)));
  }

  verificarExistencia(nome: string, tipoMudanca: string, escopo: string, id?: number): Observable<boolean> {
    let params = new HttpParams()
      .set('nome', nome.trim())
      .set('tipoMudanca', tipoMudanca)
      .set('escopo', escopo);
    
    if (id) {
      params = params.set('id', id.toString());
    }

    return this.http.get<boolean>(`${this.API_URL}/verificar-existencia`, { params })
      .pipe(catchError(this.handleError.bind(this)));
  }

  // Método específico para verificar apenas por tipoMudanca e escopo
  verificarExistenciaPorTipoEscopo(tipoMudanca: string, escopo: string): Observable<boolean> {
    let params = new HttpParams()
      .set('tipoMudanca', tipoMudanca)
      .set('escopo', escopo);

    return this.http.get<boolean>(`${this.API_URL}/verificar-existencia`, { params })
      .pipe(catchError(this.handleError.bind(this)));
  }

  validarNome(nome: string): { valido: boolean; erro?: string } {
    if (!nome || nome.trim().length === 0) {
      return { valido: false, erro: 'O nome do fator MUT é obrigatório.' };
    }

    if (nome.trim().length < 3) {
      return { valido: false, erro: 'O nome deve ter pelo menos 3 caracteres.' };
    }

    if (nome.trim().length > 100) {
      return { valido: false, erro: 'O nome deve ter no máximo 100 caracteres.' };
    }

    return { valido: true };
  }

  importarExcel(file: File): Observable<any> {
    console.log('📤 [MUT-SERVICE] Iniciando importação Excel');
    console.log('📋 [MUT-SERVICE] Arquivo details:', {
      nome: file.name,
      tipo: file.type,
      tamanho: file.size,
      tamanhoMB: (file.size / 1024 / 1024).toFixed(2) + 'MB',
      ultimaModificacao: new Date(file.lastModified).toISOString()
    });
    
    console.log('🔧 [MUT-SERVICE] Expected backend endpoint structure:');
    console.log('  📡 URL:', `${this.API_URL}/importar`);
    console.log('  📋 Method: POST');
    console.log('  📋 Content-Type: multipart/form-data');
    console.log('  📋 Form field name: "arquivo"');
    
    console.log('📊 [MUT-SERVICE] Expected response format:');
    console.log('  {');
    console.log('    success: boolean,');
    console.log('    message: string,');
    console.log('    data: MutResponse[],');
    console.log('    processedCount: number,');
    console.log('    totalCount: number,');
    console.log('    errors?: ValidationError[]');
    console.log('  }');
    
    const formData = new FormData();
    formData.append('arquivo', file);
    // Adicionar headers específicos para upload de arquivo
    const headers = new HttpHeaders();
    // Não definir Content-Type para permitir que o browser defina automaticamente com boundary
    
    return this.http.post<any>(`${this.API_URL}/importar`, formData, {
      headers: headers,
      reportProgress: true,
      observe: 'response'
    }).pipe(
      tap((response: HttpResponse<any>) => {
        console.log('📥 [MUT-SERVICE] Raw HTTP Response received:');
        console.log('  📊 Status:', response.status, response.statusText);
        console.log('  📊 Headers:', response.headers.keys().map(key => `${key}: ${response.headers.get(key)}`));
        console.log('  📊 Body type:', typeof response.body);
        console.log('  📊 Body structure:', response.body);
        
        if (response.body) {
          console.log('🔍 [MUT-SERVICE] Detailed response analysis:');
          console.log('  ✅ Success flag:', response.body.success);
          console.log('  📝 Message:', response.body.message);
          console.log('  📊 Processed count:', response.body.processedCount);
          console.log('  📊 Total count:', response.body.totalCount);
          console.log('  📊 Data array length:', response.body.data?.length || 0);
          
          if (response.body.data && Array.isArray(response.body.data)) {
            console.log('📋 [MUT-SERVICE] Imported items structure validation:');
            response.body.data.forEach((item: any, index: number) => {
              console.log(`  📋 Item ${index + 1} validation:`);
              console.log(`    ✓ ID: ${item.id}`);
              console.log(`    ✓ Tipo Mudança: ${item.tipoMudanca}`);
              console.log(`    ✓ Escopo: ${item.escopo}`);
              console.log(`    ✓ Categoria Desmatamento (if applicable): ${item.dadosDesmatamento?.[0]?.categoriaDesmatamento}`);
              console.log(`    ✓ Has Dados Desmatamento: ${!!item.dadosDesmatamento?.length}`);
              console.log(`    ✓ Has Dados Vegetacao: ${!!item.dadosVegetacao?.length}`);
              console.log(`    ✓ Has Dados Solo: ${!!item.dadosSolo?.length}`);
              
              // Validate CategoriaDesmatamento values
              if (item.dadosDesmatamento?.length > 0) {
                item.dadosDesmatamento.forEach((dd: any, ddIndex: number) => {
                  const validCategories = ['O', 'F', 'OFL', 'G'];
                  const isValidCategory = validCategories.includes(dd.categoriaDesmatamento);
                  console.log(`    ${isValidCategory ? '✅' : '❌'} Desmatamento ${ddIndex + 1} - Categoria: ${dd.categoriaDesmatamento} (Valid: ${isValidCategory})`);
                });
              }
            });
          }
          
          if (response.body.errors && Array.isArray(response.body.errors)) {
            console.log('❌ [MUT-SERVICE] Import errors detected:');
            response.body.errors.forEach((error: any, index: number) => {
              console.log(`  ❌ Error ${index + 1}:`, error);
            });
          }
        }
      }),
      map((response: HttpResponse<any>) => response.body),
      catchError((error) => {
        console.log('❌ [MUT-SERVICE] Import error details:');
        console.log('  📊 Status:', error.status);
        console.log('  📊 Status Text:', error.statusText);
        console.log('  📊 URL:', error.url);
        console.log('  📊 Error Body:', error.error);
        console.log('  📊 Full Error Object:', error);
        
        if (error.error?.message) {
          console.log('  📝 Backend Error Message:', error.error.message);
        }
        
        if (error.error?.validationErrors) {
          console.log('  📋 Validation Errors:', error.error.validationErrors);
        }
        
        return this.handleError(error);
      })
    );
  }

  // Método para busca avançada com múltiplos critérios
  buscarAvancado(filtros: MutFiltros): Observable<MutPagedResponse> {
    return this.listar(filtros);
  }

  // Método para obter sugestões de busca
  obterSugestoesBusca(termo: string): Observable<string[]> {
    if (!termo || termo.trim().length < 2) {
      return new Observable<string[]>(observer => {
        observer.next([]);
        observer.complete();
      });
    }

    const params = new HttpParams().set('q', termo.trim());
    return this.http.get<string[]>(`${this.API_URL}/suggestions`, { params })
      .pipe(catchError(() => new Observable<string[]>(observer => {
        observer.next([]);
        observer.complete();
      })));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('Erro no serviço MUT:', error);

    // Log detalhado do erro para debug
    console.error('Status:', error.status);
    console.error('Status Text:', error.statusText);
    console.error('Error Body:', error.error);
    
    if (error.error?.message) {
      console.error('Backend Message:', error.error.message);
    }

    // Tratamento específico por status code
    let userMessage = 'Erro interno do servidor';
    
    switch (error.status) {
      case 400:
        userMessage = 'Dados inválidos fornecidos';
        break;
      case 401:
        userMessage = 'Não autorizado - faça login novamente';
        this.router.navigate(['/login']);
        break;
      case 403:
        userMessage = 'Acesso negado';
        break;
      case 404:
        userMessage = 'Recurso não encontrado';
        break;
      case 409:
        // Erro de conflito - geralmente duplicata
        if (error.error?.mensagem) {
          // Usar mensagem do backend em português
          userMessage = error.error.mensagem;
        } else if (error.error?.message) {
          // Fallback para message em inglês
          userMessage = error.error.message;
        } else {
          // Mensagem padrão mais específica baseada no código
          if (error.error?.codigo === 'INTEGRIDADE_DADOS') {
            userMessage = 'Já existe um fator MUT com o mesmo tipo e escopo. Escolha um escopo diferente ou edite o registro existente.';
          } else {
            userMessage = 'Já existe um registro com essas informações. Verifique os dados e tente novamente.';
          }
        }
        break;
      case 422:
        userMessage = 'Dados de entrada inválidos';
        break;
      case 500:
        userMessage = 'Erro interno do servidor. Tente novamente em alguns instantes.';
        break;
      case 0:
        userMessage = 'Erro de conexão. Verifique se o servidor está rodando.';
        break;
      default:
        if (error.error?.message) {
          userMessage = error.error.message;
        } else {
          userMessage = `Erro ${error.status}: ${error.statusText || 'Erro desconhecido'}`;
        }
    }

    // Criar um erro customizado com a mensagem para o usuário
    const customError = new Error(userMessage);
    (customError as any).originalError = error;
    (customError as any).userMessage = userMessage;
    // Preservar status e detalhes do backend para consumidores (ex.: modal)
    (customError as any).status = error.status;
    (customError as any).error = error.error;
    (customError as any).codigo = error.error?.codigo;
    (customError as any).mensagem = error.error?.mensagem ?? userMessage;

    return throwError(() => customError);
  }
}