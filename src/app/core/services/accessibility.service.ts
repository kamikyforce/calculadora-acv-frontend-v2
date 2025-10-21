import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AccessibilityService {
  private isHighContrastSubject = new BehaviorSubject<boolean>(false);
  private isVLibrasActiveSubject = new BehaviorSubject<boolean>(false);

  public isHighContrast$ = this.isHighContrastSubject.asObservable();
  public isVLibrasActive$ = this.isVLibrasActiveSubject.asObservable();

  constructor() {
    this.initializeFromStorage();
  }

  private initializeFromStorage(): void {
    if (typeof window !== 'undefined') {
      // Initialize High Contrast
      const highContrastPreference = localStorage.getItem('highContrast');
      if (highContrastPreference === 'true') {
        this.setHighContrast(true);
      }

      // Initialize VLibras
      const vLibrasPreference = localStorage.getItem('vLibras');
      if (vLibrasPreference === 'true') {
        this.setVLibras(true);
      } else {
        // Hide VLibras by default
        setTimeout(() => {
          const vwElement = document.querySelector('[vw]') as HTMLElement;
          if (vwElement) {
            vwElement.classList.remove('enabled');
            vwElement.style.display = 'none';
          }
        }, 1000);
      }
    }
  }

  toggleHighContrast(): void {
    const newState = !this.isHighContrastSubject.value;
    this.setHighContrast(newState);
  }

  toggleVLibras(): void {
    const newState = !this.isVLibrasActiveSubject.value;
    this.setVLibras(newState);
  }

  private setHighContrast(enabled: boolean): void {
    this.isHighContrastSubject.next(enabled);
    
    if (enabled) {
      document.body.classList.add('high-contrast');
      localStorage.setItem('highContrast', 'true');
    } else {
      document.body.classList.remove('high-contrast');
      localStorage.setItem('highContrast', 'false');
    }
  }

  private setVLibras(enabled: boolean): void {
    this.isVLibrasActiveSubject.next(enabled);
    
    // Control VLibras visibility using the official method
    const vwElement = document.querySelector('[vw]') as HTMLElement;
    if (vwElement) {
      if (enabled) {
        vwElement.classList.add('enabled');
        vwElement.style.display = 'block';
        localStorage.setItem('vLibras', 'true');
      } else {
        vwElement.classList.remove('enabled');
        vwElement.style.display = 'none';
        localStorage.setItem('vLibras', 'false');
      }
    }
  }

  getHighContrastState(): boolean {
    return this.isHighContrastSubject.value;
  }

  getVLibrasState(): boolean {
    return this.isVLibrasActiveSubject.value;
  }
}