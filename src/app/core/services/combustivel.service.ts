import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { EscopoEnum } from '../models/escopo.enum';

// Interfaces baseadas na estrutura da API do Postman
export interface CombustivelRequest {
  nome: string;
  tipo: string;
  fatorEmissaoCO2: number;
  fatorEmissaoCH4: number;
  fatorEmissaoN2O: number;
  unidade: string;
  escopo: EscopoEnum; // Campo obrigatório para escopo
}

export interface CombustivelResponse {
  id: number;
  nome: string;
  tipo: string;
  fatorEmissaoCO2: number;
  fatorEmissaoCH4: number;
  fatorEmissaoN2O: number;
  unidade: string;
  escopo: EscopoEnum;
  dataCriacao?: string;
  dataAtualizacao?: string;
}

export interface CombustivelComFatores extends CombustivelResponse {
  fatorEmissaoTotal?: number;
  co2Equivalente?: number;
}

// Enum para tipos de combustível
export enum TipoCombustivel {
  COMBUSTIVEL_LIQUIDO = 'Combustível Líquido',
  COMBUSTIVEL_GASOSO = 'Combustível Gasoso',
  COMBUSTIVEL_SOLIDO = 'Combustível Sólido',
  BIOCOMBUSTIVEL = 'Biocombustível'
}

@Injectable({
  providedIn: 'root'
})
export class CombustivelService {
  private readonly baseUrl = `${environment.apiUrl}/combustiveis`;

  constructor(private http: HttpClient) { }

  /** Util: garante que o escopo vai como string (ex: "ESCOPO1") */
  private escopoToParam(escopo: EscopoEnum): string {
    // se for numérico, converte para o nome; se já for string, retorna
    return typeof escopo === 'number'
      ? (EscopoEnum as any)[escopo]
      : String(escopo);
  }

  /** Normaliza nome para busca consistente */
  private normalizeName(nome: string): string {
    return (nome || '')
        .toLowerCase()
        .normalize('NFD')               // separa acentos
        .replace(/[\u0300-\u036f]/g, '')// remove acentos (reuso do padrão visto em mut/producao-agricola)
        .replace(/\s+/g, ' ')           // colapsa espaços
        .trim();
  }

  /**
   * Lista todos os combustíveis
   * GET /combustiveis
   */
  listar(): Observable<CombustivelResponse[]> {
    console.log('🔥 CombustivelService: Listando todos os combustíveis');

    return this.http.get<CombustivelResponse[]>(this.baseUrl, {
      withCredentials: true
    }).pipe(
      map(response => {
        console.log('✅ Combustíveis listados com sucesso:', response.length, 'itens');
        return response;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Busca combustível por ID
   * GET /combustiveis/{id}
   */
  buscarPorId(id: number): Observable<CombustivelResponse> {
    console.log('🔍 CombustivelService: Buscando combustível por ID:', id);

    return this.http.get<CombustivelResponse>(`${this.baseUrl}/${id}`, {
      withCredentials: true
    }).pipe(
      map(response => {
        console.log('✅ Combustível encontrado:', response.nome);
        return response;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Cria novo combustível
   * POST /combustiveis
   */
  criar(combustivel: CombustivelRequest): Observable<CombustivelResponse> {
    console.log('➕ CombustivelService: Criando novo combustível:', combustivel.nome, '-', combustivel.escopo);
    console.log('📋 Dados para criação:', JSON.stringify(combustivel, null, 2));

    // Validar dados antes de enviar
    if (!this.validarCombustivel(combustivel)) {
      console.error('❌ Dados inválidos para criação:', combustivel);
      return throwError(() => new Error('Dados inválidos fornecidos'));
    }

    // Garantir que os campos numéricos são válidos
    const combustivelValidado: CombustivelRequest = {
      ...combustivel,
      nome: combustivel.nome?.trim() || '',
      tipo: combustivel.tipo?.trim() || 'FOSSIL',
      unidade: combustivel.unidade?.trim() || '',
      fatorEmissaoCO2: Number(combustivel.fatorEmissaoCO2) || 0,
      fatorEmissaoCH4: Number(combustivel.fatorEmissaoCH4) || 0,
      fatorEmissaoN2O: Number(combustivel.fatorEmissaoN2O) || 0,
      escopo: combustivel.escopo
    };

    console.log('📋 Dados validados para envio:', JSON.stringify(combustivelValidado, null, 2));

    return this.http.post<CombustivelResponse>(this.baseUrl, combustivelValidado, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    }).pipe(
      map(response => {
        console.log('✅ Combustível criado com sucesso:', response.id, '-', response.nome, '-', response.escopo);
        return response;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Atualiza combustível existente
   * PUT /combustiveis/{id}
   */
  atualizar(id: number, combustivel: CombustivelRequest): Observable<CombustivelResponse> {
    console.log('📝 CombustivelService: Atualizando combustível ID:', id, '-', combustivel.nome, '-', combustivel.escopo);
    console.log('📋 Dados para atualização:', JSON.stringify(combustivel, null, 2));

    // Validar dados antes de enviar
    if (!this.validarCombustivel(combustivel)) {
      console.error('❌ Dados inválidos para atualização:', combustivel);
      return throwError(() => new Error('Dados inválidos fornecidos'));
    }

    // Garantir que os campos numéricos são válidos
    const combustivelValidado: CombustivelRequest = {
      ...combustivel,
      nome: combustivel.nome?.trim() || '',
      tipo: combustivel.tipo?.trim() || 'FOSSIL',
      unidade: combustivel.unidade?.trim() || '',
      fatorEmissaoCO2: Number(combustivel.fatorEmissaoCO2) || 0,
      fatorEmissaoCH4: Number(combustivel.fatorEmissaoCH4) || 0,
      fatorEmissaoN2O: Number(combustivel.fatorEmissaoN2O) || 0,
      escopo: combustivel.escopo
    };

    console.log('📋 Dados validados para envio:', JSON.stringify(combustivelValidado, null, 2));

    return this.http.put<CombustivelResponse>(`${this.baseUrl}/${id}`, combustivelValidado, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    }).pipe(
      map(response => {
        console.log('✅ Combustível atualizado com sucesso:', response.nome, '-', response.escopo);
        return response;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Remove combustível
   * DELETE /combustiveis/{id}
   */
  deletar(id: number): Observable<void> {
    console.log('🗑️ CombustivelService: Removendo combustível ID:', id);

    return this.http.delete<void>(`${this.baseUrl}/${id}`, {
      withCredentials: true
    }).pipe(
      map(() => {
        console.log('✅ Combustível removido com sucesso');
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Lista combustíveis por tipo
   * GET /combustiveis/tipo/{tipo}
   */
  listarPorTipo(tipo: string): Observable<CombustivelResponse[]> {
    console.log('🔍 CombustivelService: Listando combustíveis por tipo:', tipo);

    const tipoEncoded = encodeURIComponent(tipo);
    return this.http.get<CombustivelResponse[]>(`${this.baseUrl}/tipo/${tipoEncoded}`, {
      withCredentials: true
    }).pipe(
      map(response => {
        console.log('✅ Combustíveis encontrados por tipo:', response.length, 'itens');
        return response;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Lista todos os tipos de combustível disponíveis
   * GET /combustiveis/tipos
   */
  listarTipos(): Observable<string[]> {
    console.log('📋 CombustivelService: Listando tipos de combustível');

    return this.http.get<string[]>(`${this.baseUrl}/tipos`, {
      withCredentials: true
    }).pipe(
      map(response => {
        console.log('✅ Tipos de combustível listados:', response.length, 'tipos');
        return response;
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Busca combustíveis por nome
   * GET /combustiveis/buscar?nome={nome}
   */
  buscarPorNome(nome: string): Observable<CombustivelResponse[]> {
    const params = new HttpParams().set('nome', nome);
    return this.http.get<CombustivelResponse[]>(`${this.baseUrl}/buscar`, {
      params,
      withCredentials: true
    }).pipe(
      catchError(this.handleError)
    );
  }

  verificarExistenciaPorNomeEEscopo(nome: string, escopo: EscopoEnum): Observable<boolean> {
    const normalizedNome = this.normalizeName(nome);
    const params = new HttpParams()
      .set('nome', nome)
      .set('escopo', this.escopoToParam(escopo));
    
    console.log('🔍 Verificando existência:', normalizedNome, '-', escopo);
    
    return this.http.get<CombustivelResponse[]>(`${this.baseUrl}/buscar`, {
      params,
      withCredentials: true
    }).pipe(
      map(list => {
        const exists = list.some(c =>
          this.normalizeName(c.nome) === normalizedNome && c.escopo === escopo
        );
        console.log(`✅ Combustível "${nome}" - ${escopo} ${exists ? 'existe' : 'não existe'}`);
        return exists;
      }),
      catchError(() => {
        console.log(`❌ Erro ao verificar existência de "${nome}" - ${escopo}`);
        return of(false);
      })
    );
  }

  buscarPorNomeEEscopo(nome: string, escopo: EscopoEnum): Observable<CombustivelResponse | null> {
    const normalizedNome = this.normalizeName(nome);
    const params = new HttpParams()
      .set('nome', nome)
      .set('escopo', this.escopoToParam(escopo));
    
    console.log('🔍 Buscando por nome e escopo:', normalizedNome, '-', escopo);
    
    return this.http.get<CombustivelResponse[]>(`${this.baseUrl}/buscar`, {
      params,
      withCredentials: true
    }).pipe(
      map(list => {
        const found = list.find(c =>
          this.normalizeName(c.nome) === normalizedNome && c.escopo === escopo
        ) || null;
        console.log(`✅ Busca resultado para "${nome}" - ${escopo}:`, found ? `ID ${found.id}` : 'não encontrado');
        return found;
      }),
      catchError((error) => {
        console.log(`❌ Erro ao buscar "${nome}" - ${escopo}:`, error.message);
        return of(null);
      })
    );
  }

  /**
   * Lista combustíveis com fatores de emissão calculados
   */
  listarComFatores(): Observable<CombustivelComFatores[]> {
    console.log('🧮 CombustivelService: Listando combustíveis com fatores calculados');

    return this.listar().pipe(
      map(combustiveis => {
        return combustiveis.map(combustivel => {
          const fatorEmissaoTotal = combustivel.fatorEmissaoCO2 +
            (combustivel.fatorEmissaoCH4 * 25) +
            (combustivel.fatorEmissaoN2O * 298);

          return {
            ...combustivel,
            fatorEmissaoTotal,
            co2Equivalente: fatorEmissaoTotal
          } as CombustivelComFatores;
        });
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Valida dados do combustível antes do envio
   */
  validarCombustivel(combustivel: CombustivelRequest): boolean {
    console.log('🔍 Validando combustível:', JSON.stringify(combustivel, null, 2));

    if (!combustivel) {
      console.error('❌ Objeto combustível é nulo ou indefinido');
      return false;
    }

    if (!combustivel.nome || combustivel.nome.trim().length === 0) {
      console.error('❌ Nome do combustível é obrigatório');
      return false;
    }

    if (!combustivel.tipo || combustivel.tipo.trim().length === 0) {
      console.error('❌ Tipo do combustível é obrigatório');
      return false;
    }

    if (!combustivel.unidade || combustivel.unidade.trim().length === 0) {
      console.error('❌ Unidade é obrigatória');
      return false;
    }

    if (combustivel.escopo === null || combustivel.escopo === undefined) {
      console.error('❌ Escopo é obrigatório');
      return false;
    }

    // Validar se o escopo é um valor válido do enum
    const validEscopos = [EscopoEnum.ESCOPO1, EscopoEnum.ESCOPO3];
    if (!validEscopos.includes(combustivel.escopo)) {
      console.error('❌ Escopo inválido:', combustivel.escopo, 'Valores válidos:', validEscopos);
      return false;
    }

    // Validar fatores de emissão
    const fatorCO2 = Number(combustivel.fatorEmissaoCO2);
    const fatorCH4 = Number(combustivel.fatorEmissaoCH4);
    const fatorN2O = Number(combustivel.fatorEmissaoN2O);

    if (isNaN(fatorCO2) || fatorCO2 < 0) {
      console.error('❌ Fator de emissão CO2 inválido:', combustivel.fatorEmissaoCO2);
      return false;
    }

    if (isNaN(fatorCH4) || fatorCH4 < 0) {
      console.error('❌ Fator de emissão CH4 inválido:', combustivel.fatorEmissaoCH4);
      return false;
    }

    if (isNaN(fatorN2O) || fatorN2O < 0) {
      console.error('❌ Fator de emissão N2O inválido:', combustivel.fatorEmissaoN2O);
      return false;
    }

    console.log('✅ Combustível validado com sucesso');
    return true;
  }

  /**
   * Formata dados do combustível para exibição
   */
  formatarCombustivel(combustivel: CombustivelResponse): string {
    return `${combustivel.nome} (${combustivel.tipo}) - ${combustivel.unidade}`;
  }

  /**
   * Converte data para formato brasileiro
   */
  private formatarData(data: string): string {
    if (!data) return '';

    try {
      const date = new Date(data);
      return date.toLocaleDateString('pt-BR');
    } catch (error) {
      console.warn('⚠️ Erro ao formatar data:', error);
      return data;
    }
  }

  /**
   * Verifica se um combustível existe pelo nome exato
   */
  verificarExistenciaPorNome(nome: string): Observable<boolean> {
    console.log('🔍 Verificando existência do combustível:', nome);

    return this.http.get<CombustivelResponse[]>(this.baseUrl, {
      withCredentials: true
    }).pipe(
      map(combustiveis => {
        const normalizedNome = this.normalizeName(nome);
        const existe = combustiveis.some(c =>
          this.normalizeName(c.nome) === normalizedNome
        );
        console.log(`✅ Combustível "${nome}" ${existe ? 'existe' : 'não existe'}`);
        return existe;
      }),
      catchError(error => {
        console.error('❌ Erro ao verificar existência:', error);
        return of(false);
      })
    );
  }

  /**
   * Busca um combustível pelo nome exato
   */
  buscarPorNomeExato(nome: string): Observable<CombustivelResponse | null> {
    console.log('🔍 Buscando combustível por nome exato:', nome);

    return this.http.get<CombustivelResponse[]>(this.baseUrl, {
      withCredentials: true
    }).pipe(
      map(combustiveis => {
        const normalizedNome = this.normalizeName(nome);
        const combustivel = combustiveis.find(c =>
          this.normalizeName(c.nome) === normalizedNome
        );
        console.log(`✅ Combustível encontrado:`, combustivel || 'Nenhum');
        return combustivel || null;
      }),
      catchError(error => {
        console.error('❌ Erro ao buscar por nome:', error);
        return of(null);
      })
    );
  }

  /**
   * Tratamento centralizado de erros HTTP
   */
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'Erro desconhecido';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Erro: ${error.error.message}`;
    } else {
      switch (error.status) {
        case 400:
          errorMessage = 'Dados inválidos fornecidos';
          break;
        case 401:
          errorMessage = 'Não autorizado. Faça login novamente';
          break;
        case 403:
          errorMessage = 'Acesso negado';
          break;
        case 404:
          errorMessage = 'Combustível não encontrado';
          break;
        case 409:
          errorMessage = 'Combustível já existe';
          break;
        case 422:
          errorMessage = 'Dados de combustível inválidos';
          break;
        case 500:
          errorMessage = 'Erro interno do servidor';
          break;
        default:
          errorMessage = `Erro ${error.status}: ${error.message}`;
      }
    }

    console.error('❌ CombustivelService Error:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }
}