import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'numberFormat',
  standalone: true
})
export class NumberFormatPipe implements PipeTransform {
  transform(value: number | string | null | undefined, decimals: number = 6, forceDecimals: boolean = false): string {
    if (value === null || value === undefined || value === '') {
      return forceDecimals ? '0,000000' : '0';
    }

    const numValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
    
    if (isNaN(numValue)) {
      return forceDecimals ? '0,000000' : '0';
    }

    // Para formatação com casas decimais fixas
    if (forceDecimals) {
      return numValue.toFixed(decimals).replace('.', ',');
    }

    // Formatação padrão (remove zeros desnecessários)
    const formatted = numValue.toFixed(decimals);
    const withoutTrailingZeros = formatted.replace(/\.?0+$/, '');
    
    // Aplicar formatação brasileira com vírgula
    return withoutTrailingZeros.replace('.', ',');
  }
}