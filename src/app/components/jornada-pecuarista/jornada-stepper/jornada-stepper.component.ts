import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface FaseJornada {
  numero: number;
  nome: string;
  descricao: string;
  concluida: boolean;
  ativa: boolean;
}

@Component({
  selector: 'app-jornada-stepper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './jornada-stepper.component.html',
  styleUrls: ['./jornada-stepper.component.scss']
})
export class JornadaStepperComponent implements OnInit, OnChanges {
  @Input() faseAtual: number = 1;
  @Input() fasesConcluidas: { [key: number]: boolean } = {};
  @Output() faseChange = new EventEmitter<number>();

  fases: FaseJornada[] = [
    {
      numero: 1,
      nome: 'Rebanho',
      descricao: 'Informações sobre o rebanho, nutrição animal e manejo de dejetos',
      concluida: false,
      ativa: true
    },
    {
      numero: 2,
      nome: 'Produção Agrícola',
      descricao: 'Dados sobre produção agrícola e insumos utilizados',
      concluida: false,
      ativa: false
    },
    {
      numero: 3,
      nome: 'MUT',
      descricao: 'Mudança de Uso da Terra',
      concluida: false,
      ativa: false
    },
    {
      numero: 4,
      nome: 'Energia',
      descricao: 'Consumo de energia e combustíveis',
      concluida: false,
      ativa: false
    }
  ];

  ngOnInit() {
    this.atualizarStatusFases();
  }

  ngOnChanges() {
    this.atualizarStatusFases();
  }

  private atualizarStatusFases() {
    this.fases.forEach(fase => {
      fase.concluida = this.fasesConcluidas[fase.numero] || false;
      fase.ativa = fase.numero === this.faseAtual;
    });
  }

  onFaseClick(numeroFase: number) {
    // Só permite navegar para fases anteriores ou a atual
    if (numeroFase <= this.faseAtual) {
      this.faseChange.emit(numeroFase);
    }
  }

  getStepClass(fase: FaseJornada): string {
    let classes = ['br-step-item'];
    
    if (fase.concluida) {
      classes.push('done');
    }
    
    if (fase.ativa) {
      classes.push('active');
    }
    
    // Desabilita fases futuras
    if (fase.numero > this.faseAtual) {
      classes.push('disabled');
    }
    
    return classes.join(' ');
  }

  getStepIcon(fase: FaseJornada): string {
    if (fase.concluida) {
      return 'fas fa-check';
    } else if (fase.ativa) {
      return 'fas fa-play';
    } else {
      return 'fas fa-circle';
    }
  }

  // Métodos auxiliares para o template
  getFasesConcluidas(): number {
    return Object.keys(this.fasesConcluidas).filter(key => this.fasesConcluidas[+key]).length;
  }

  getProgressPercentage(): number {
    return (this.getFasesConcluidas() / this.fases.length) * 100;
  }
}