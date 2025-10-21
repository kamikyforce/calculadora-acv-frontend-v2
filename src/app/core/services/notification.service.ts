import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications$ = new BehaviorSubject<Notification[]>([]);
  private idCounter = 0;

  getNotifications(): Observable<Notification[]> {
    return this.notifications$.asObservable();
  }

  addNotification(notification: Omit<Notification, 'id'>): void {
    const newNotification: Notification = {
      ...notification,
      id: (++this.idCounter).toString(),
      duration: notification.duration || 5000
    };

    const currentNotifications = this.notifications$.value;
    this.notifications$.next([...currentNotifications, newNotification]);

    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        this.removeNotification(newNotification.id);
      }, newNotification.duration);
    }
  }

  removeNotification(id: string): void {
    const currentNotifications = this.notifications$.value;
    const filteredNotifications = currentNotifications.filter(n => n.id !== id);
    this.notifications$.next(filteredNotifications);
  }

  success(message: string, title: string = 'Sucesso'): void {
    this.addNotification({
      type: 'success',
      title,
      message
    });
  }

  error(message: string, title: string = 'Erro'): void {
    this.addNotification({
      type: 'error',
      title,
      message,
      duration: 8000
    });
  }

  warning(message: string, title: string = 'Atenção'): void {
    this.addNotification({
      type: 'warning',
      title,
      message,
      duration: 6000
    });
  }

  info(message: string, title: string = 'Informação'): void {
    this.addNotification({
      type: 'info',
      title,
      message
    });
  }

  showValidationErrors(errors: Record<string, string>): void {
    const fieldNames: Record<string, string> = {
      'nome': 'Nome',
      'cnpj': 'CNPJ',
      'estado': 'Estado',
      'tipo': 'Tipo',
      'email': 'E-mail',
      'cpf': 'CPF',
      'orgao': 'Órgão',
      'usuarioId': 'Usuário'
    };

    Object.entries(errors).forEach(([field, message]) => {
      const fieldLabel = fieldNames[field] || field;
      this.error(`${fieldLabel}: ${message}`);
    });
  }

  handleHttpError(error: any): void {
    if (error?.userMessage) {
      this.error(error.userMessage);
      return;
    }
    if (error?.mensagem) {
      this.error(error.mensagem);
      return;
    }
    if (error?.error?.codigo === 'VALIDACAO_CAMPOS' && error?.error?.campos) {
      this.showValidationErrors(error.error.campos);
    } else if (error?.error?.mensagem) {
      this.error(error.error.mensagem);
    } else if (error?.message) {
      this.error(error.message);
    } else {
      this.error('Ocorreu um erro inesperado. Tente novamente.');
    }
  }

  clearAll(): void {
    this.notifications$.next([]);
  }
}