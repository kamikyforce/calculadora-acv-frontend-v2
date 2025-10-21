import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';

export interface CarStatus {
  numero: string;
  status: 'ATIVO' | 'PENDENTE' | 'SUSPENSO' | 'CANCELADO';
  descricao: string;
  detalhes?: string;
  estado?: string;
  municipio?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CarConsultaService {
  
  // CARs mockados para teste - baseados no formato do print
  private carsMockados: CarStatus[] = [
    {
      numero: 'UF-1302405-E6D3.395B.6D27.4F42.AE22.DD56.987C.DD52',
      status: 'ATIVO',
      descricao: 'O cadastro do imóvel rural será considerado Ativo após concluída a inscrição no CAR.',
      detalhes: 'Cadastro ativo e regular',
      estado: 'MG',
      municipio: 'Belo Horizonte'
    },
    {
      numero: 'SP-1234567-E6D3.395B.6D27.4F42.AE22.DD56.987C.DD52',
      status: 'PENDENTE',
      descricao: 'O cadastro do imóvel rural será considerado Pendente quando constatada declaração incorreta.',
      detalhes: 'Aguardando regularização de documentos',
      estado: 'SP',
      municipio: 'São Paulo'
    },
    {
      numero: 'MG-9876543-FEDC.BA98.7654.3210.FEDC.BA98.7654.3210',
      status: 'SUSPENSO',
      descricao: 'O cadastro do imóvel rural será considerado Suspenso por decisão judicial ou decisão administrativa.',
      detalhes: 'Suspenso por decisão administrativa',
      estado: 'MG',
      municipio: 'Uberlândia'
    },
    {
      numero: 'RJ-5555555-1111.2222.3333.4444.5555.6666.7777.8888',
      status: 'CANCELADO',
      descricao: 'O cadastro do imóvel rural será considerado Cancelado quando constatado que as informações são falsas.',
      detalhes: 'Cancelado por informações incorretas',
      estado: 'RJ',
      municipio: 'Rio de Janeiro'
    }
  ];

  constructor() { }

  /**
   * Consulta o status de um CAR
   * @param numeroCAR Número do CAR no formato UF-1234567-XXXX.XXXX.XXXX.XXXX.XXXX.XXXX.XXXX.XXXX
   * @returns Observable com o status do CAR ou null se não encontrado
   */
  consultarCAR(numeroCAR: string): Observable<CarStatus | null> {
    // Simula delay de consulta na API
    const carEncontrado = this.carsMockados.find(car => car.numero === numeroCAR);
    
    return of(carEncontrado || null).pipe(
      delay(800) // Simula tempo de resposta da API
    );
  }

  /**
   * Verifica se o formato do CAR está correto
   * @param numeroCAR Número do CAR
   * @returns true se o formato estiver correto
   */
  validarFormatoCAR(numeroCAR: string): boolean {
    const carRegex = /^[A-Z]{2}-\d{7}-[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}$/;
    return carRegex.test(numeroCAR);
  }

  /**
   * Retorna a classe CSS para o status
   * @param status Status do CAR
   * @returns Classe CSS correspondente
   */
  getStatusClass(status: string): string {
    switch (status) {
      case 'ATIVO':
        return 'text-success';
      case 'PENDENTE':
        return 'text-warning-dark';
      case 'SUSPENSO':
        return 'text-secondary';
      case 'CANCELADO':
        return 'text-danger';
      default:
        return '';
    }
  }

  /**
   * Retorna o ícone para o status
   * @param status Status do CAR
   * @returns Classe do ícone FontAwesome
   */
  getStatusIcon(status: string): string {
    switch (status) {
      case 'ATIVO':
        return 'fas fa-check-circle';
      case 'PENDENTE':
        return 'fas fa-exclamation-triangle';
      case 'SUSPENSO':
        return 'fas fa-pause-circle';
      case 'CANCELADO':
        return 'fas fa-times-circle';
      default:
        return 'fas fa-question-circle';
    }
  }
}