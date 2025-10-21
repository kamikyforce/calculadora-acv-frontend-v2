import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { TipoDado } from '../models/tipo-dado.enum';

/** ===== Tipos comuns ===== */
export type StatusCalculo = 'PENDENTE' | 'PARCIAL' | 'COMPLETO';
export type TipoDadoAPI = 'CONSOLIDADO_ANUAL' | 'MENSAL';
export type EscopoCodigo = 'ESCOPO1' | 'ESCOPO2' | 'ESCOPO3';

export interface DadoMensalDTO {
  mes: number;      // 1..12
  valor: number;    // 6 casas
}

/** ===== DTOs alinhados ao backend ===== */
export interface EnergiaECombustivelRequest {
  usuarioId: number;
  tipoEnergia: string;     // "ELETRICA" | "COMBUSTIVEL" | ...
  fonteEnergia: string;    // "REDE_ELETRICA", "GASOLINA", "DIESEL", etc
  consumoAnual?: number | null;     // só para CONSOLIDADO_ANUAL (se aplicável)
  unidade: string;         // "kWh" | "L" | ...
  fatorEmissao?: number | null;
  fatorMedioAnual?: number | null;  // consolidado: valor manual do gov
  escopo: EscopoCodigo;    // normalizado
  anoReferencia: number;
  tipoDado: TipoDadoAPI;   // 'CONSOLIDADO_ANUAL' | 'MENSAL'
  versao?: number;
  observacoesAuditoria?: string;
  dadosMensais?: DadoMensalDTO[];   // mensal
}

export interface EnergiaComFatorResponse {
  id: number;
  usuarioId: number;
  tipoEnergia: string;
  fonteEnergia: string;
  consumoAnual: number | null;
  unidade: string;
  escopo: string;
  anoReferencia: number | null;
  fatorMedioAnual: number | null;   // sempre 6 casas quando presente
  dadosMensais?: DadoMensalDTO[];
  tipoDado?: TipoDadoAPI;

  statusCalculo?: StatusCalculo;
  versao?: number;
  observacoesAuditoria?: string;
  mediaAnualCalculada?: number | null;
  mesesPreenchidos?: number | null;

  dataCriacao?: string;
  dataAtualizacao?: string;
}

export interface FatorMedioAnualResponse {
  id: number;
  ano: number;
  fator_medio_anual: number; // 6 casas
  fonte?: string;
  observacoes?: string;
  ativo?: boolean;
}

@Injectable({ providedIn: 'root' })
export class EnergiaDadosService {
  private readonly apiUrl = `${environment.apiUrl}/energia-combustiveis`;
  private readonly fatoresApiUrl = `${environment.apiUrl}/fatores-energia`;

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

  /** ================= Helpers numéricos ================= */
  private to6(n: unknown): number {
    const v = Number(n ?? 0);
    return Number.isFinite(v) ? Number(v.toFixed(6)) : 0;
  }
  private to6OrNull(n: unknown): number | null {
    if (n === null || n === undefined) return null;
    const v = Number(n);
    if (!Number.isFinite(v)) return null;
    return Number(v.toFixed(6));
  }

  /** ================= Normalização de escopo =================
   *  Energia (ELETRICA): força ESCOPO2
   *  Combustível (COMBUSTIVEL): permite apenas ESCOPO1 ou ESCOPO3 (default ESCOPO3)
   */
  private normalizeEscopo(tipoEnergia: string, escopo: string | undefined): EscopoCodigo {
    const t = (tipoEnergia || '').toUpperCase();
    const e = (escopo || '').toUpperCase();

    if (t.includes('ELET') || t === 'ENERGIA' || t.includes('ENERGIA')) {
      return 'ESCOPO2';
    }
    // Combustível
    if (e === 'ESCOPO1') return 'ESCOPO1';
    return 'ESCOPO3';
  }

  /** ================= Parser defensivo de dados mensais ================= */
  private parseMensais(r: any): DadoMensalDTO[] {
    let dados: DadoMensalDTO[] = [];
    try {
      if (Array.isArray(r?.dadosMensais)) {
        dados = r.dadosMensais as DadoMensalDTO[];
      } else if (typeof r?.dadosMensais === 'string') {
        dados = JSON.parse(r.dadosMensais) as DadoMensalDTO[];
      } else if (typeof r?.dadosMensaisJson === 'string') {
        dados = JSON.parse(r.dadosMensaisJson) as DadoMensalDTO[];
      }
    } catch {
      dados = [];
    }
    // garantir 6 casas
    return (dados || []).map(d => ({ mes: d.mes, valor: this.to6(d.valor) }));
  }

  /** ================= Map do backend → Front ================= */
  private mapResponse = (r: any): EnergiaComFatorResponse => ({
    ...r,
    consumoAnual: r?.consumoAnual != null ? this.to6(r.consumoAnual) : null,
    fatorMedioAnual: this.to6OrNull(r?.fatorMedioAnual),
    mediaAnualCalculada: this.to6OrNull(r?.mediaAnualCalculada),
    dadosMensais: this.parseMensais(r)
  });

  /** ================= GETs ================= */
  listarTodosComFatores(): Observable<EnergiaComFatorResponse[]> {
    return this.http.get<any[]>(`${this.apiUrl}/todos/com-fatores`, { withCredentials: true })
      .pipe(map(rs => rs.map(this.mapResponse)), catchError(this.handleError));
  }

  listarPorUsuarioComFatores(usuarioId: number): Observable<EnergiaComFatorResponse[]> {
    return this.http.get<any[]>(`${this.apiUrl}/usuario/${usuarioId}/com-fatores`, { withCredentials: true })
      .pipe(map(rs => rs.map(this.mapResponse)), catchError(this.handleError));
  }

  listarPorUsuario(usuarioId: number): Observable<EnergiaComFatorResponse[]> {
    return this.http.get<any[]>(`${this.apiUrl}/usuario/${usuarioId}`, { withCredentials: true })
      .pipe(map(rs => rs.map(this.mapResponse)), catchError(this.handleError));
  }

  listarPorEscopo(escopo: EscopoCodigo): Observable<EnergiaComFatorResponse[]> {
    return this.http.get<any[]>(`${this.apiUrl}/escopo/${escopo}`, { withCredentials: true })
      .pipe(map(rs => rs.map(this.mapResponse)), catchError(this.handleError));
  }

  listarPorUsuarioEEscopo(usuarioId: number, escopo: EscopoCodigo): Observable<EnergiaComFatorResponse[]> {
    return this.http.get<any[]>(`${this.apiUrl}/usuario/${usuarioId}/escopo/${escopo}`, { withCredentials: true })
      .pipe(map(rs => rs.map(this.mapResponse)), catchError(this.handleError));
  }

  buscarPorId(id: number): Observable<EnergiaComFatorResponse> {
    return this.http.get<any>(`${this.apiUrl}/${id}`, { withCredentials: true })
      .pipe(map(this.mapResponse), catchError(this.handleError));
  }

  listarPorUsuarioEAno(usuarioId: number, ano: number): Observable<EnergiaComFatorResponse[]> {
    const params = new HttpParams().set('anoReferencia', String(ano));
    return this.http.get<any[]>(`${this.apiUrl}/usuario/${usuarioId}/com-fatores`, { params, withCredentials: true })
      .pipe(map(rs => rs.map(this.mapResponse)), catchError(this.handleError));
  }

  listarAnosDisponiveis(): Observable<number[]> {
    return this.http.get<number[]>(`${this.fatoresApiUrl}/anos`, { withCredentials: true })
      .pipe(catchError(this.handleError));
  }

  buscarFatorMedioAnualPorAno(ano: number): Observable<FatorMedioAnualResponse> {
    return this.http.get<FatorMedioAnualResponse>(`${this.fatoresApiUrl}/ano/${ano}`, { withCredentials: true })
      .pipe(
        map(r => ({ ...r, fator_medio_anual: this.to6(r.fator_medio_anual) })),
        catchError(this.handleError)
      );
  }

  buscarDadosMensaisPorAno(ano: number): Observable<DadoMensalDTO[]> {
    return this.http.get<any[]>(`${this.fatoresApiUrl}/lista-fatores/ano/${ano}`, { withCredentials: true })
      .pipe(
        map(list => (list || []).map((d: any) => ({ mes: d.mes ?? d.month ?? 0, valor: this.to6(d.valor ?? d.fatorEmissao ?? d.fator ?? 0) }))),
        catchError(this.handleError)
      );
  }

  buscarDadosMensaisPorAnoEMes(ano: number, mes: number): Observable<DadoMensalDTO> {
    return this.http.get<any>(`${this.fatoresApiUrl}/ano/${ano}/mes/${mes}`, { withCredentials: true })
      .pipe(map(d => ({ mes, valor: this.to6(d?.valor ?? d?.fatorEmissao ?? d?.fator ?? 0) })), catchError(this.handleError));
  }

  atualizarAnoReferencia(id: number, anoReferencia: number): Observable<EnergiaComFatorResponse> {
    const params = new HttpParams().set('anoReferencia', String(anoReferencia));
    return this.http.put<any>(`${this.apiUrl}/${id}/ano-referencia`, null, { withCredentials: true, params })
      .pipe(map(this.mapResponse), catchError(this.handleError));
  }

  /** ================= POST/PUT nativos ================= */
  criar(raw: EnergiaECombustivelRequest): Observable<EnergiaComFatorResponse> {
    const body = this.buildPayload(raw);
    return this.http.post<any>(this.apiUrl, body, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' }
    }).pipe(map(this.mapResponse), catchError(this.handleError));
  }

  atualizar(id: number, raw: EnergiaECombustivelRequest): Observable<EnergiaComFatorResponse> {
    const body = this.buildPayload(raw);
    return this.http.put<any>(`${this.apiUrl}/${id}`, body, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' }
    }).pipe(map(this.mapResponse), catchError(this.handleError));
  }

  /** ================= Builder de payload =================
   *  - Normaliza escopo por tipo de energia
   *  - Aplica 6 casas
   *  - Remove campos irrelevantes conforme tipoDado
   */
  private buildPayload(raw: EnergiaECombustivelRequest): EnergiaECombustivelRequest {
    const tipoEnergiaUp = (raw.tipoEnergia || '').toUpperCase();

    const escopo = this.normalizeEscopo(tipoEnergiaUp, raw.escopo);
    const tipoDado: TipoDadoAPI = raw.tipoDado;

    // Ajustes de números (6 casas)
    const fatorMedioAnual = this.to6OrNull(raw.fatorMedioAnual);
    const fatorEmissao = this.to6OrNull(raw.fatorEmissao);
    const consumoAnual = raw.consumoAnual != null ? this.to6(raw.consumoAnual) : null;

    let dadosMensais: DadoMensalDTO[] | undefined = undefined;

    if (tipoDado === 'MENSAL') {
      dadosMensais = (raw.dadosMensais || [])
        .filter(m => m && m.mes >= 1 && m.mes <= 12)
        .map(m => ({ mes: m.mes, valor: this.to6(m.valor) }));

      // Para MENSAL, normalmente não enviamos consumoAnual/fatorMedioAnual — backend calcula média quando 12/12
      return {
        usuarioId: raw.usuarioId,
        tipoEnergia: tipoEnergiaUp,
        fonteEnergia: raw.fonteEnergia,
        unidade: raw.unidade,
        escopo,
        anoReferencia: raw.anoReferencia!,
        tipoDado,
        versao: raw.versao,
        observacoesAuditoria: raw.observacoesAuditoria,
        dadosMensais,
        consumoAnual: null,
        fatorEmissao: fatorEmissao ?? null,
        fatorMedioAnual: null
      };
    }

    // CONSOLIDADO_ANUAL: valor manual do governo → enviar em fatorMedioAnual
    return {
      usuarioId: raw.usuarioId,
      tipoEnergia: tipoEnergiaUp,
      fonteEnergia: raw.fonteEnergia,
      unidade: raw.unidade,
      escopo,
      anoReferencia: raw.anoReferencia!,
      tipoDado,
      versao: raw.versao,
      observacoesAuditoria: raw.observacoesAuditoria,
      dadosMensais: undefined,
      consumoAnual,                     // se usar consumo agregado
      fatorEmissao: fatorEmissao ?? null,
      fatorMedioAnual                  : fatorMedioAnual // valor manual com 6 casas
    };
  }

  /** ================= Erros ================= */
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    if (error.status === 401) {
      this.router.navigate(['/login']);
    }
    return throwError(() => error);
  };
}
