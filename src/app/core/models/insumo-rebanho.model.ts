export enum TipoInsumo {
  INGREDIENTES_ALIMENTARES = 'INGREDIENTES_ALIMENTARES',
  ANIMAIS_COMPRADOS = 'ANIMAIS_COMPRADOS',
  FERTILIZANTES = 'FERTILIZANTES',
  COMBUSTIVEIS = 'COMBUSTIVEIS',
  ENERGIA = 'ENERGIA'
}

export enum EscopoEnum {
  ESCOPO_1 = 'ESCOPO1',
  ESCOPO_2 = 'ESCOPO2',
  ESCOPO_3_PRODUCAO = 'ESCOPO3_PRODUCAO',
  ESCOPO_3_TRANSPORTE = 'ESCOPO3_TRANSPORTE'
}

export enum UnidadeProdutoReferencia {
  KG = 'KG',
  T = 'T',
  G = 'G'
}

export enum GrupoIngredienteAlimentar {
  CEREAIS_E_GRAOS = 'CEREAIS_E_GRAOS',
  LEGUMINOSAS = 'LEGUMINOSAS',
  OLEAGINOSAS = 'OLEAGINOSAS'
}

export enum FazParteDieta {
  SIM = 'SIM',
  NAO = 'NAO'
}

export enum FatoresEmissao {
  CALCULADO = 'CALCULADO',
  ESTIMADO = 'ESTIMADO'
}

export interface InsumoRebanhoRequest {
  usuarioId: number;
  modulo: string;
  tipo: TipoInsumo;
  escopo: EscopoEnum;
  identificacaoProduto: string;
  fonteDataset: string;
  datasetProduto?: string;
  unidadeProduto: UnidadeProdutoReferencia;
  metodoAvaliacaoGwp?: string;
  
  // Campos específicos para Escopo 1 e 3
  grupoIngrediente?: GrupoIngredienteAlimentar;
  nomeProduto?: string;
  uuid?: string;
  quantidade?: number;
  quantidadeProdutoReferencia?: number;
  unidade?: string;
  
  // Valores de emissão
  gwp100Fossil?: number;
  gwp100Biogenico?: number;
  gwp100Transformacao?: number;
  co2Fossil?: number;
  co2Ch4Transformacao?: number;
  ch4Fossil?: number;
  ch4Biogenico?: number;
  n2o?: number;
  outrasSubstancias?: number;
  
  // Campos relacionados à dieta
  fazParteDieta?: FazParteDieta;
  ingrediente?: string;
  notEu?: string;
  energiaBruta?: number;
  ms?: number;
  proteinaBruta?: number;
  fatoresEmissao?: FatoresEmissao;
  comentarios?: string;
  comentariosEscopo1?: string;
  comentariosEscopo3?: string;
  
  geeTotalEscopo1?: number;
  co2FossilEscopo1?: number;
  usoTerraEscopo1?: number;
  ch4FossilEscopo1?: number;
  ch4BiogenicoEscopo1?: number;
  n2oEscopo1?: number;
  outrasSubstanciasEscopo1?: number;
  
  geeTotalEscopo3?: number;
  gwp100FossilEscopo3?: number;
  gwp100BiogenicoEscopo3?: number;
  gwp100TransformacaoEscopo3?: number;
  dioxidoCarbonoFossilEscopo3?: number;
  dioxidoCarbonoMetanoTransformacaoEscopo3?: number;
  metanoFossilEscopo3?: number;
  metanoBiogenicoEscopo3?: number;
  oxidoNitrosoEscopo3?: number;
  outrasSubstanciasEscopo3?: number;
  
  ativo?: boolean;
}

export interface InsumoRebanhoResponse {
  id: number;
  modulo: string;
  tipo: TipoInsumo;
  escopo: EscopoEnum;
  identificacaoProduto: string;
  fonteDataset: string;
  datasetProduto?: string;
  unidadeProduto: UnidadeProdutoReferencia;
  metodoAvaliacaoGwp?: string;
  
  // Campos específicos para Escopo 1 e 3
  grupoIngrediente?: GrupoIngredienteAlimentar;
  nomeProduto?: string;
  uuid?: string;
  quantidade?: number;
  quantidadeProdutoReferencia?: number;
  unidade?: string;
  
  // Valores de emissão
  gwp100Fossil?: number;
  gwp100Biogenico?: number;
  gwp100Transformacao?: number;
  co2Fossil?: number;
  co2Ch4Transformacao?: number;
  ch4Fossil?: number;
  ch4Biogenico?: number;
  n2o?: number;
  outrasSubstancias?: number;
  
  // Campos relacionados à dieta
  fazParteDieta?: FazParteDieta;
  ingrediente?: string;
  notEu?: string;
  energiaBruta?: number;
  ms?: number;
  proteinaBruta?: number;
  fatoresEmissao?: FatoresEmissao;
  comentarios?: string;
  comentariosEscopo1?: string;
  comentariosEscopo3?: string;
  
  geeTotalEscopo1?: number;
  co2FossilEscopo1?: number;
  usoTerraEscopo1?: number;
  ch4FossilEscopo1?: number;
  ch4BiogenicoEscopo1?: number;
  n2oEscopo1?: number;
  outrasSubstanciasEscopo1?: number;
  
  geeTotalEscopo3?: number;
  gwp100FossilEscopo3?: number;
  gwp100BiogenicoEscopo3?: number;
  gwp100TransformacaoEscopo3?: number;
  dioxidoCarbonoFossilEscopo3?: number;
  dioxidoCarbonoMetanoTransformacaoEscopo3?: number;
  metanoFossilEscopo3?: number;
  metanoBiogenicoEscopo3?: number;
  oxidoNitrosoEscopo3?: number;
  outrasSubstanciasEscopo3?: number;
  
  ativo: boolean;
  dataCriacao: string;
  dataAtualizacao?: string;
}

export interface InsumoRebanhoFiltros {
  usuarioId?: number;
  tipo?: TipoInsumo;
  escopo?: EscopoEnum;
  grupoIngrediente?: GrupoIngredienteAlimentar;
  fazParteDieta?: FazParteDieta;
}

export interface InsumoRebanhoStats {
  total: number;
}

export interface InsumoRebanhoExistencia {
  exists: boolean;
}