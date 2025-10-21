import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { EnergiaDadosService, EnergiaComFatorResponse, EnergiaECombustivelRequest } from './energia-dados.service';
import { CombustivelService } from './combustivel.service';

@Injectable({ providedIn: 'root' })
export class EnergiaECombustivelService {
  constructor(
    private readonly energiaDados: EnergiaDadosService,
    private readonly combustivel: CombustivelService
  ) {}

  // Delegações diretas (para evitar imports múltiplos na UI)
  listarDadosEnergia(usuarioId: number): Observable<EnergiaComFatorResponse[]> {
    return this.energiaDados.listarPorUsuario(usuarioId);
  }

  listarDadosEnergiaComFatores(usuarioId: number): Observable<EnergiaComFatorResponse[]> {
    return this.energiaDados.listarPorUsuarioComFatores(usuarioId);
  }

  criar(req: EnergiaECombustivelRequest) {
    return this.energiaDados.criar(req);
  }

  atualizar(id: number, req: EnergiaECombustivelRequest) {
    return this.energiaDados.atualizar(id, req);
  }

  buscarPorId(id: number) {
    return this.energiaDados.buscarPorId(id);
  }

  deletar(id: number) {
    // seu backend usa DELETE /energia-combustiveis/{id}
    // se quiser delegar, pode criar um método deletar no EnergiaDadosService
    // aqui apenas mostro a existência
    throw new Error('Use EnergiaDadosService diretamente para deletar.');
  }

  // catálogo de combustíveis (caso use)
  listarCombustiveis() {
    return this.combustivel.listar();
  }
}
