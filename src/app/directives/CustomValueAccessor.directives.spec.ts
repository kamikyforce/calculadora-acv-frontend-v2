import { Component, DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { CustomValueAccessorDirective } from './CustomValueAccessor.directives';

@Component({
  standalone: true,
  imports: [FormsModule, CustomValueAccessorDirective],
  template: `
    <br-input [(ngModel)]="campo"></br-input>
  `
})
class TestComponent {
  campo = '';
}

describe('CustomValueAccessorDirective', () => {
  let fixture: ComponentFixture<TestComponent>;
  let component: TestComponent;
  let inputEl: DebugElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestComponent, FormsModule]
    });

    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
    inputEl = fixture.debugElement.query(By.css('br-input'));
    fixture.detectChanges();
  });

  it('deve atualizar o valor do model quando o input mudar', () => {
    inputEl.nativeElement.campo = 'Valor de teste';
    inputEl.triggerEventHandler('input', { detail: 'Valor de teste' });
    fixture.detectChanges();

    expect(component.campo).toBe('Valor de teste');
  });

});