import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'br-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="br-loading" [class.medium]="size === 'medium'" [attr.data-progress]="progress">
      <div *ngIf="!progress" class="loading-spinner">
        <div class="spinner-border" role="status">
          <span class="sr-only">Carregando...</span>
        </div>
      </div>
      <div *ngIf="progress" class="loading-progress">
        <div class="progress-circle">
          <svg class="progress-ring" width="60" height="60">
            <circle
              class="progress-ring-circle"
              stroke="#1351B4"
              stroke-width="4"
              fill="transparent"
              r="26"
              cx="30"
              cy="30"
              [style.stroke-dasharray]="circumference"
              [style.stroke-dashoffset]="strokeDashoffset"/>
          </svg>
          <span class="progress-text">{{ progress }}%</span>
        </div>
      </div>
      <div *ngIf="message" class="loading-message">
        <p>{{ message }}</p>
      </div>
    </div>
  `,
  styleUrls: ['./br-loading.component.scss']
})
export class BrLoadingComponent {
  @Input() size: 'small' | 'medium' = 'small';
  @Input() progress?: number;
  @Input() message?: string;

  get circumference() {
    return 2 * Math.PI * 26;
  }

  get strokeDashoffset() {
    if (!this.progress) return this.circumference;
    return this.circumference - (this.progress / 100) * this.circumference;
  }
}