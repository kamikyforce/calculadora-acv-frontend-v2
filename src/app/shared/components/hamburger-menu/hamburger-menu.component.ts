import { Component, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  children?: MenuItem[];
  active?: boolean;
}

@Component({
  selector: 'app-hamburger-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hamburger-menu.component.html',
  styleUrls: ['./hamburger-menu.component.scss']
})
export class HamburgerMenuComponent implements OnDestroy {
  @Input() menuItems: MenuItem[] = [];
  @Input() isOpen: boolean = false;
  @Output() menuToggle = new EventEmitter<boolean>();
  @Output() itemClick = new EventEmitter<MenuItem>();

  expandedItems: Set<string> = new Set();
  private originalBodyOverflow: string = '';

  ngOnDestroy(): void {
    // Restaurar scroll do body ao destruir componente
    this.restoreBodyScroll();
  }

  toggleMenu(): void {
    this.isOpen = !this.isOpen;
    this.menuToggle.emit(this.isOpen);
    
    if (this.isOpen) {
      this.preventBodyScroll();
    } else {
      this.restoreBodyScroll();
    }
  }

  closeMenu(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.menuToggle.emit(this.isOpen);
      this.restoreBodyScroll();
    }
  }

  onItemClick(item: MenuItem): void {
    if (item.children && item.children.length > 0) {
      this.toggleExpanded(item.id);
    } else {
      this.itemClick.emit(item);
      this.closeMenu();
    }
  }

  toggleExpanded(itemId: string): void {
    if (this.expandedItems.has(itemId)) {
      this.expandedItems.delete(itemId);
    } else {
      this.expandedItems.add(itemId);
    }
  }

  isExpanded(itemId: string): boolean {
    return this.expandedItems.has(itemId);
  }

  onBackdropClick(): void {
    this.closeMenu();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeMenu();
    }
  }

  private preventBodyScroll(): void {
    this.originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  private restoreBodyScroll(): void {
    document.body.style.overflow = this.originalBodyOverflow;
  }
}