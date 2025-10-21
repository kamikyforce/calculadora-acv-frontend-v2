import { Directive, ElementRef, HostListener, Input, Renderer2, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Directive({
  selector: '[appDecimalFormat]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DecimalFormatDirective),
      multi: true
    }
  ]
})
export class DecimalFormatDirective implements ControlValueAccessor {
  @Input() decimals: number = 6;
  @Input() forceDecimals: boolean = true;

  private onChange = (value: any) => {};
  private onTouched = () => {};
  private rawValue: string = '';

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  @HostListener('input', ['$event'])
  onInput(event: any): void {
    const input = event.target;
    let value = input.value as string;

    // Remove caracteres não numéricos (exceto ponto e vírgula)
    value = value.replace(/[^0-9.,]/g, '');

    // Substitui vírgula por ponto
    value = value.replace(/,/g, '.');

    // Permite apenas um ponto decimal
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }

    // Limita as casas decimais durante a digitação
    if (parts[1] && parts[1].length > this.decimals) {
      value = parts[0] + '.' + parts[1].substring(0, this.decimals);
    }

    this.rawValue = value;

    // Envia null quando vazio; quando houver número, envia o float (se válido)
    if (value === '') {
      this.onChange(null);
    } else {
      const parsed = parseFloat(value);
      this.onChange(Number.isFinite(parsed) ? parsed : null);
    }
  }

  @HostListener('blur', ['$event'])
  onBlur(_: any): void {
    this.onTouched();
    this.formatDisplay();
  }

  @HostListener('focus', ['$event'])
  onFocus(_: any): void {
    // Mostra o valor "raw" para edição
    this.renderer.setProperty(this.el.nativeElement, 'value', this.rawValue);
  }

  private formatDisplay(): void {
    // Se está vazio, deixa o input vazio (não mostra 0)
    if (this.rawValue === '') {
      this.renderer.setProperty(this.el.nativeElement, 'value', '');
      return;
    }

    const numValue = parseFloat(this.rawValue);
    if (!Number.isFinite(numValue)) {
      this.renderer.setProperty(this.el.nativeElement, 'value', '');
      return;
    }

    const formatted = this.forceDecimals
      ? numValue.toFixed(this.decimals).replace('.', ',')
      : numValue.toString().replace('.', ',');

    this.renderer.setProperty(this.el.nativeElement, 'value', formatted);
  }

  writeValue(value: any): void {
    if (value === null || value === undefined || value === '') {
      this.rawValue = '';
      // mantém o campo visualmente vazio
      this.renderer.setProperty(this.el.nativeElement, 'value', '');
      return;
    }
    this.rawValue = String(value);
    this.formatDisplay();
  }

  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void {
    this.renderer.setProperty(this.el.nativeElement, 'disabled', isDisabled);
  }
}
