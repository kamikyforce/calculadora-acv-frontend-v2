import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

// Função para verificar se a rota é pública
function isPublicRoute(url: string): boolean {
  const publicRoutes = [
    '/public/',
    '/auth/login',
    '/auth/logout',
    '/oauth2/authorization',
    '/login'
  ];
  
  return publicRoutes.some(route => url.includes(route));
}

// Função para adicionar token à requisição
function addTokenToRequest(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: {
      'Authorization': `Bearer ${token}`,
      'X-Request-Id': generateRequestId()
    }
  });
}

// Função para gerar ID de requisição
function generateRequestId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// Função para lidar com erro 401 (não autorizado)
function handle401Error(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  isRefreshing: boolean
): Observable<HttpEvent<unknown>> {
  if (!isRefreshing) {
    isRefreshing = true;
    
    return authService.refreshToken().pipe(
      switchMap(response => {
        isRefreshing = false;
        const newToken = response.token;
        return next(addTokenToRequest(req, newToken));
      }),
      catchError(error => {
        isRefreshing = false;
        authService.logout().subscribe();
        return throwError(() => error);
      })
    );
  }
  
  return next(req);
}

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  let isRefreshing = false;

  // Configuração CORS para todas as requisições
  // Não definir Content-Type para FormData (multipart/form-data)
  const headers: { [key: string]: string } = {
    'Accept': 'application/json'
  };
  
  // Só adicionar Content-Type se não for FormData
  if (!(req.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  req = req.clone({
    withCredentials: true,
    setHeaders: headers
  });
  
  // Não adiciona token para rotas públicas
  if (isPublicRoute(req.url)) {
    return next(req);
  }

  // Adiciona token se disponível
  const token = authService.getToken();
  if (token) {
    req = addTokenToRequest(req, token);
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isRefreshing) {
        return handle401Error(req, next, authService, isRefreshing);
      }
      return throwError(() => error);
    })
  );
};