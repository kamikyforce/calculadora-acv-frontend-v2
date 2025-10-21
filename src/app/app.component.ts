import { Component, OnInit, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { NotificationComponent } from './shared/components/notification/notification.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NotificationComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit {
  title = 'calculadora-acv-frontend';
  
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}
  
  ngOnInit() {
    // Component initialization
  }
  
  ngAfterViewInit() {
    // Only initialize Gov.br components in browser
    if (isPlatformBrowser(this.platformId)) {
      this.initGovBrComponents();
    }
  }
  
  private initGovBrComponents() {
    // Wait for complete DOM and script loading
    setTimeout(() => {
      try {
        // Check if Gov.br core is available
        if (typeof (window as any).core === 'undefined') {
          console.warn('Gov.br core library not loaded');
          return;
        }

        // Initialize BRHeader with enhanced validation - Skip if no proper Gov.br header structure
        const headerElements = document.querySelectorAll('.br-header');
        if (headerElements.length > 0 && (window as any).core.BRHeader) {
          headerElements.forEach((header) => {
            try {
              // Comprehensive element validation
              if (header && 
                  header.nodeType === Node.ELEMENT_NODE && 
                  header.parentNode && 
                  header.isConnected && // Ensure element is in DOM
                  typeof header.addEventListener === 'function' &&
                  !header.hasAttribute('data-br-initialized')) {
                
                // Check for Gov.br Design System specific elements
                const hasGovBrElements = header.querySelector('.br-header-actions') || 
                                       header.querySelector('.br-header-menu') ||
                                       header.querySelector('.br-header-search') ||
                                       header.querySelector('.br-header-logo');
                
                // Only initialize if it has proper Gov.br structure
                if (hasGovBrElements) {
                  header.setAttribute('data-br-initialized', 'true');
                  new (window as any).core.BRHeader('br-header', header);
                } else {
                  // Skip initialization for custom headers without Gov.br structure
                  console.info('Skipping BRHeader initialization - custom header structure detected');
                }
              }
            } catch (error) {
              console.warn('Erro ao inicializar BRHeader:', error);
            }
          });
        }
        
        // Initialize BRMenu with enhanced validation
        const menuElements = document.querySelectorAll('.br-menu');
        if (menuElements.length > 0 && (window as any).core.BRMenu) {
          menuElements.forEach((menu) => {
            try {
              // Comprehensive element validation
              if (menu && 
                  menu.nodeType === Node.ELEMENT_NODE && 
                  menu.parentNode &&
                  menu.isConnected && // Ensure element is in DOM
                  typeof menu.addEventListener === 'function' &&
                  !menu.hasAttribute('data-br-initialized')) {
                
                menu.setAttribute('data-br-initialized', 'true');
                new (window as any).core.BRMenu('br-menu', menu);
              }
            } catch (error) {
              console.warn('Erro ao inicializar BRMenu:', error);
            }
          });
        }
      } catch (error) {
        console.warn('Gov.br initialization error:', error);
      }
    }, 3000); // Increased timeout for better reliability
  }
}