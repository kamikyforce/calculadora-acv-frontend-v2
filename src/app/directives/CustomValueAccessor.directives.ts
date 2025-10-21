import { Directive, ElementRef, HostListener, Renderer2, forwardRef } from '@angular/core'
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'

/**
 * Diretiva customizada para acessar e controlar o valor de um input.
 */
@Directive({
  selector: 'br-input, br-select',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomValueAccessorDirective),
      multi: true,
    },
  ],
})
export class CustomValueAccessorDirective implements ControlValueAccessor {
  private onChange: (value: string) => void = () => {}
  private onTouched: () => void = () => {}
  private _value: string | undefined
  public disabled = false

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2
  ) {}

  /**
   * Obtém o valor do campo.
   */
  public get value(): string {
    return this._value || ''
  }

  /**
   * Define o valor do campo.
   * @param val O valor a ser definido.
   */
  public set value(val: string) {
    if (val !== this._value) {
      this._value = val
      this.onChange(this._value)
      this.onTouched()
      this.updateValue(val)
    }
  }

  private updateValue(value: string): void {
    this.elementRef.nativeElement.value = value
    this.renderer.setProperty(this.elementRef.nativeElement, 'value', value)
  }

  /**
   * Registra uma função de retorno de chamada a ser chamada quando o valor do campo mudar.
   * @param fn A função de retorno de chamada.
   */
  public registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn
  }

  /**
   * Registra uma função de retorno de chamada a ser chamada quando o campo for tocado.
   * @param fn A função de retorno de chamada.
   */
  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn
  }

  /**
   * Define o estado de desabilitado do campo.
   * @param isDisabled Indica se o campo deve ser desabilitado.
   */
  public setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled
  }

  /**
   * Escreve um novo valor para o campo.
   * @param value O novo valor a ser escrito.
   */
  public writeValue(value: any): void {
    this.value = value
  }

  /**
   * Manipulador do evento de input.
   * Atualiza o valor do campo quando ocorre o evento de input.
   * @param value O valor do evento de input.
   */
  @HostListener('input', ['$event.detail'])
  private handleInput(value: string): void {
    this.value = value
  }

  /**
   * Manipulador do evento de change.
   * Chama a função de retorno de chamada quando ocorre o evento de change.
   * @param value O valor do evento de change.
   */
  @HostListener('change', ['$event.detail'])
  private handleChange(value: string): void {
    this.onChange(value[0])
  }

  /**
   * Manipulador do evento de blur.
   * Chama a função de retorno de chamada quando ocorre o evento de blur.
   * @param event O evento de blur.
   */
  @HostListener('blur')
  private handleBlur(event: any): void {
    this.onTouched()
  }
}
