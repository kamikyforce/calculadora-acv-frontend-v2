export interface UsuarioResponse {
  id: string;
  nome: string;
  email: string;
  tipo: string;
  cpf?: string;
  ativo?: boolean;
  dataCadastro?: string;
}

export interface UsuarioCreateRequest {
  nome: string;
  email: string;
  cpf: string;
  tipo?: string;
}

// Keep the existing AdministradorResponse
export interface AdministradorResponse {
  id: number;
  usuario: {
    id: string;
    nome: string;
    email: string;
    cpf?: string;
    ativo?: boolean;
    dataCadastro?: string;
  };
  orgao: string;
  perfil: string;
}

// Update AdministradorRequest to match backend exactly
export interface AdministradorRequest {
  usuarioId: number; // This must match the backend Long usuarioId
  orgao: string;
  perfilId: number; // This must match the backend Long perfilId
}

// Remove AdministradorCreateRequest as we'll use the two-step process
// Or keep it for internal use only
export interface AdministradorCreateRequest {
  nome: string;
  email: string;
  cpf: string;
  orgao: string;
  perfilId: number;
}

export interface AdministradorUpdateRequest {
  orgao: string;
  perfilId: number;
}

export interface AdministradorStatusRequest {
  status: string;
}