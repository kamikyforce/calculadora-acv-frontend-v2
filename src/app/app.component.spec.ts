import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { RouterTestingModule } from '@angular/router/testing';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
        RouterTestingModule
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have a router outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should initialize Gov.br components', (done) => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    
    // Mock window.core
    (window as any).core = {
      BRHeader: class {
        constructor(name: string, element: Element) {}
      },
      BRMenu: class {
        constructor(name: string, element: Element) {}
      }
    };

    // Add test elements
    document.body.innerHTML = `
      <div class="br-header"></div>
      <div class="br-menu"></div>
    `;

    fixture.detectChanges();

    // Wait for setTimeout
    setTimeout(() => {
      expect(document.querySelector('.br-header')).toBeTruthy();
      expect(document.querySelector('.br-menu')).toBeTruthy();
      done();
    }, 150);
  });
});
