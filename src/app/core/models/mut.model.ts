import { EscopoEnum } from "./escopo.enum";

export enum TipoMudanca {
  SOLO = 'SOLO',
  DESMATAMENTO = 'DESMATAMENTO',
  VEGETACAO = 'VEGETACAO',
  USO_ANTERIOR_ATUAL = "USO_ANTERIOR_ATUAL"
}

export interface MutFiltros {
  escopo?: EscopoEnum;
  tipoMudanca?: TipoMudanca;
  bioma?: Bioma;
  termoBusca?: string;
  page?: number;
  size?: number;
  sort?: string;
  direction?: 'ASC' | 'DESC';
}

export enum Bioma {
  AMAZONIA = 'AMAZONIA',
  CAATINGA = 'CAATINGA',
  CERRADO = 'CERRADO',
  MATA_ATLANTICA = 'MATA_ATLANTICA',
  PAMPA = 'PAMPA',
  PANTANAL = 'PANTANAL'
}

export enum UF {
  AC = 'AC', AL = 'AL', AP = 'AP', AM = 'AM', BA = 'BA', CE = 'CE',
  DF = 'DF', ES = 'ES', GO = 'GO', MA = 'MA', MT = 'MT', MS = 'MS',
  MG = 'MG', PA = 'PA', PB = 'PB', PR = 'PR', PE = 'PE', PI = 'PI',
  RJ = 'RJ', RN = 'RN', RS = 'RS', RO = 'RO', RR = 'RR', SC = 'SC',
  SP = 'SP', SE = 'SE', TO = 'TO'
}

export enum TipoFatorSolo {
  USO_ANTERIOR_ATUAL = 'USO_ANTERIOR_ATUAL',
  SOLO_USO_ANTERIOR_ATUAL = 'SOLO_USO_ANTERIOR_ATUAL'
}

export enum SiglaFitofisionomia {
  AA = 'Aa', AB = 'Ab', AS = 'As', CB = 'Cb', CS = 'Cs', DA = 'Da',
  DB = 'Db', DM = 'Dm', DS = 'Ds', FA = 'Fa', FB = 'Fb', FM = 'Fm',
  FS = 'Fs', LA = 'La', LB = 'Lb', LD = 'Ld', LG = 'Lg', PA = 'Pa',
  PF = 'Pf', PM = 'Pm', RM = 'Rm', SA = 'Sa', SD = 'Sd', SG = 'Sg',
  SP = 'Sp', TA = 'Ta', TD = 'Td', TG = 'Tg', TP = 'Tp', AM = 'Am',
  CA = 'Ca', RL = 'Rl', RS = 'Rs', SN = 'SN', SO = 'SO', ST = 'ST',
  TN = 'TN', LO = 'LO', ON = 'ON', T = 'T', S = 'S', P = 'P', L = 'L',
  AR = 'Ar', CM = 'Cm', DN = 'Dn', EG = 'Eg', MA = 'Ma', ML = 'Ml',
  MM = 'Mm', SM = 'SM', D = 'D', DL = 'Dl', E = 'E', EM = 'EM',
  EN = 'EN', F = 'F', M = 'M', MS = 'Ms', NM = 'NM', NP = 'NP',
  OM = 'OM', OP = 'OP', EA = 'Ea', EP = 'Ep'
}

export enum CategoriaDesmatamento {
  O = 'O',
  F = 'F',
  OFL = 'OFL',
  G = 'G'
}

export interface MutDesmatamentoData {
  id: number;
  bioma: Bioma;
  valorUnico: boolean;
  ufs: UF[];
  nomeFitofisionomia: string;
  siglaFitofisionomia: SiglaFitofisionomia;
  categoriaDesmatamento: CategoriaDesmatamento;
  estoqueCarbono?: number; // decimal (6)
  fatorEmissao?: number; // ✅ Novo campo decimal (6)
  fatorCO2?: number; // ✅ Novo campo decimal (6)
  fatorCH4?: number; // ✅ Novo campo decimal (6)
  fatorN2O?: number; // ✅ Novo campo decimal (6)
  replicadoAutomatico?: boolean;
}

// Dados específicos - Solo
export interface MutSoloData {
  id: number;
  tipoFatorSolo: string;
  valorFator: number;
  descricao: string;
  bioma?: Bioma; // ✅ Novo campo
  fatorCO2?: number; // ✅ Novo campo decimal (6)
  fatorCH4?: number; // ✅ Novo campo decimal (6)
  fatorN2O?: number; // ✅ Novo campo decimal (6)
  usoAnterior?: string;
  usoAtual?: string;
  principal?: boolean;
  replicadoAutomatico?: boolean;
}

// Dados específicos - Vegetação
export interface MutVegetacaoData {
  id: number;
  categoriasFitofisionomia: string[]; // F | G | OFL
  parametro: string;                 // opções fixas (dropdown)
  valorAmazonia?: number;                 // decimais (6)
  valorCaatinga?: number;
  valorCerrado?: number;
  valorMataAtlantica?: number;
  valorPampa?: number;
  valorPantanal?: number;
  especieVegetacao?: string;
  biomassaAerea?: number;
  biomassaSubterranea?: number;
  alturaMedia?: number;
  bioma?: Bioma; // ✅ Novo campo obrigatório para backend
  fatorCO2?: number; // ✅ Novo campo decimal (6)
  fatorCH4?: number; // ✅ Novo campo decimal (6)
  fatorN2O?: number; // ✅ Novo campo decimal (6)
  replicadoAutomatico?: boolean;
}

// Request
export interface MutRequest {
  tipoMudanca: TipoMudanca;
  escopo: EscopoEnum;
  nome?: string;
  dadosSolo?: MutSoloData[];
  dadosVegetacao?: MutVegetacaoData[];
  dadosDesmatamento?: MutDesmatamentoData[];
}

// Response
export interface MutResponse extends MutRequest {
  id: number;
  usuarioId?: number;
  nomeUsuario?: string;
  ativo: boolean;
  dataCriacao: number[];
  dataAtualizacao?: number[];
}

// Estatísticas MUT
export interface MutStats {
  total: number;
  porEscopo: { [key in EscopoEnum]?: number };
  porTipoMudanca: { [key in TipoMudanca]?: number };
  porBioma: { [key in Bioma]?: number };
}

export interface MutPagedResponse {
  content: MutResponse[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: {
      unsorted: boolean;
      sorted: boolean;
      empty: boolean;
    };
    offset: number;
    unpaged: boolean;
    paged: boolean;
  };
  totalPages: number;
  totalElements: number;
  last: boolean;
  number: number;
  sort: {
    unsorted: boolean;
    sorted: boolean;
    empty: boolean;
  };
  numberOfElements: number;
  first: boolean;
  size: number;
  empty: boolean;
}

export { EscopoEnum };
