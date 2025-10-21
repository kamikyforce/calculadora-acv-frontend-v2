import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

export interface ProcuracaoData {
  cpf: string;
  aceitoTermos: boolean;
}

@Component({
  selector: 'app-procuracao-modal',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './procuracao-modal.component.html',
  styleUrls: ['./procuracao-modal.component.scss']
})
export class ProcuracaoModalComponent {
  @Input() isVisible: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<ProcuracaoData>();
  @Output() success = new EventEmitter<void>();
  
  showCpf: boolean = true;
  showCancelConfirmModal: boolean = false;
  showSaveConfirmModal: boolean = false;
  showRequiredFieldsModal: boolean = false;
  showCpfInvalidModal: boolean = false;
  requiredFieldsErrors: string[] = [];
  originalData: ProcuracaoData = { cpf: '', aceitoTermos: false };

  constructor() {
    // Componente inicializado
  }
  
  procuracaoData: ProcuracaoData = {
    cpf: '',
    aceitoTermos: false
  };

  closeProcuracaoModal(): void {
    if (this.hasUnsavedChanges()) {
      this.showCancelConfirmModal = true;
    } else {
      this.close.emit();
    }
  }

  confirmCloseModal(): void {
    if (this.hasUnsavedChanges()) {
      this.showCancelConfirmModal = true;
    } else {
      this.close.emit();
    }
  }

  closeCancelConfirmModal(): void {
    this.showCancelConfirmModal = false;
  }

  confirmCancel(): void {
    this.showCancelConfirmModal = false;
    this.resetForm();
    this.close.emit();
  }

  closeSaveConfirmModal(): void {
    this.showSaveConfirmModal = false;
  }

  closeRequiredFieldsModal(): void {
    this.showRequiredFieldsModal = false;
  }

  closeCpfInvalidModal(): void {
    this.showCpfInvalidModal = false;
  }

  confirmSave(): void {
    this.closeSaveConfirmModal();
    // Aqui você pode adicionar a lógica para salvar a procuração
    console.log('Procuração criada:', this.procuracaoData);
    this.submit.emit(this.procuracaoData);
    this.success.emit();
    this.resetForm();
    this.isVisible = false;
    this.close.emit();
  }

  confirmSubmitProcuracao(): void {
    if (!this.validateRequiredFields()) {
      this.showRequiredFieldsModal = true;
      return;
    }
    this.showSaveConfirmModal = true;
  }

  hasUnsavedChanges(): boolean {
    return !!(this.procuracaoData.cpf || this.procuracaoData.aceitoTermos);
  }

  validateRequiredFields(): boolean {
    this.requiredFieldsErrors = [];
    
    if (!this.procuracaoData.cpf || this.procuracaoData.cpf.trim() === '') {
      this.requiredFieldsErrors.push('CPF do procurador');
    } else if (!this.isValidCPF(this.procuracaoData.cpf)) {
      this.requiredFieldsErrors.push('CPF deve ser válido');
    }
    
    if (!this.procuracaoData.aceitoTermos) {
      this.requiredFieldsErrors.push('Aceitar os termos de uso');
    }
    
    return this.requiredFieldsErrors.length === 0;
  }

  resetForm(): void {
    this.procuracaoData = {
      cpf: '',
      aceitoTermos: false
    };
    this.showCpf = true;
  }

  formatCPF(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    
    if (value.length <= 11) {
      value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      event.target.value = value;
      this.procuracaoData.cpf = value;
      
      // Validar CPF quando estiver completo
      if (value.length === 14 && !this.isValidCPF(value)) {
        this.showCpfInvalidModal = true;
      }
    }
  }

  onSubmitProcuracao(): void {
    this.confirmSubmitProcuracao();
  }
  
  isValidForm(): boolean {
    const cpfValid = this.procuracaoData.cpf.length === 14 && this.isValidCPF(this.procuracaoData.cpf);
    return cpfValid && this.procuracaoData.aceitoTermos;
  }
  
  toggleCpfVisibility(): void {
    this.showCpf = !this.showCpf;
  }

  // Validação de CPF
  private isValidCPF(cpf: string): boolean {
    const cpfNumerico = cpf.replace(/\D/g, '');
    
    if (cpfNumerico.length !== 11) {
      return false;
    }
    
    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cpfNumerico)) {
      return false;
    }
    
    // Validar dígitos verificadores
    let soma = 0;
    for (let i = 0; i < 9; i++) {
      soma += parseInt(cpfNumerico.charAt(i)) * (10 - i);
    }
    let resto = 11 - (soma % 11);
    let digito1 = resto < 2 ? 0 : resto;
    
    if (parseInt(cpfNumerico.charAt(9)) !== digito1) {
      return false;
    }
    
    soma = 0;
    for (let i = 0; i < 10; i++) {
      soma += parseInt(cpfNumerico.charAt(i)) * (11 - i);
    }
    resto = 11 - (soma % 11);
    let digito2 = resto < 2 ? 0 : resto;
    
    return parseInt(cpfNumerico.charAt(10)) === digito2;
  }
}