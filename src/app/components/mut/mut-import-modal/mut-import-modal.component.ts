import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MutService } from '../../../core/services/mut.service';
import { NotificationService } from '../../../core/services/notification.service';
import { MESSAGES } from '../../../shared/constants/messages';

@Component({
  selector: 'app-mut-import-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mut-import-modal.component.html',
  styleUrls: ['./mut-import-modal.component.scss']
})
export class MutImportModalComponent {
  @Input() isVisible = false;
  @Output() close = new EventEmitter<void>();
  @Output() imported = new EventEmitter<void>();

  isLoading = false;
  selectedFile: File | null = null;

  constructor(
    private mutService: MutService,
    private notificationService: NotificationService
  ) {}

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length ? input.files[0] : null;
    
    if (file) {
      // Validar tipo de arquivo
      const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
      
      if (!allowedTypes.includes(file.type)) {
        this.notificationService.error(MESSAGES.MUT.ERRO.ARQUIVO_INVALIDO);
        this.selectedFile = null;
        return;
      }
      
      // Validar tamanho do arquivo (5MB máximo)
      const maxSize = 5 * 1024 * 1024; // 5MB em bytes
      
      if (file.size > maxSize) {
        this.notificationService.error(MESSAGES.MUT.ERRO.ARQUIVO_MUITO_GRANDE);
        this.selectedFile = null;
        return;
      }
    }
    
    this.selectedFile = file;
  }

  onCancel(): void {
    if (this.isLoading) return;
    this.close.emit();
  }

  onImport(): void {
    if (!this.selectedFile) {
      this.notificationService.warning(MESSAGES.MUT.ERRO.SELECIONAR_ARQUIVO);
      return;
    }
    
    this.isLoading = true;
    const startTime = Date.now();
    
    this.mutService.importarExcel(this.selectedFile).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        
        if (response && response.success) {
          this.notificationService.success('Dados importados com sucesso! Formato UF simplificado aplicado automaticamente.');
          this.imported.emit();
        } else {
          this.notificationService.error(response?.message || MESSAGES.MUT.ERRO.IMPORTACAO);
        }
      },
      error: (err: any) => {
        this.isLoading = false;
        
        let errorMessage = MESSAGES.MUT.ERRO.IMPORTACAO;
        
        if (err.error && err.error.message) {
          if (err.error.message.includes('categoriaDesmatamento')) {
            errorMessage = 'Erro nos valores de Categoria Desmatamento. Use apenas: O, F, OFL, G';
          } else if (err.error.message.includes('formato')) {
            errorMessage = 'Formato do arquivo Excel inválido. Verifique a estrutura das abas e colunas.';
          } else if (err.error.message.includes('TipoFatorSolo')) {
            errorMessage = 'Erro nos valores de Tipo Fator Solo. Use apenas: SOLO_LAC, SOLO_ARENOSO';
          } else if (err.error.message.includes('bioma')) {
            errorMessage = 'Erro nos valores de Bioma. Verifique se estão corretos.';
          } else if (err.error.message.includes('UF')) {
            errorMessage = 'Erro nos códigos de UF. Use códigos válidos de 2 letras (ex: SP, RJ, MG).';
          } else if (err.error.message.includes('tamanho')) {
            errorMessage = MESSAGES.MUT.ERRO.ARQUIVO_MUITO_GRANDE;
          } else {
            errorMessage = err.error.message;
          }
        } else if (err.status === 413) {
          errorMessage = 'Arquivo muito grande. Reduza o tamanho do arquivo Excel.';
        } else if (err.status === 415) {
          errorMessage = 'Tipo de arquivo não suportado. Use apenas arquivos .xlsx ou .xls.';
        } else if (err.status === 500) {
          errorMessage = 'Erro interno do servidor. Tente novamente mais tarde.';
        } else if (err.status === 0) {
          errorMessage = 'Erro de conexão. Verifique sua conexão com a internet.';
        }
        
        this.notificationService.error(errorMessage);
      }
    });
  }
}