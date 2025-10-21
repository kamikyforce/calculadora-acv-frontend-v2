export interface InsumoProducaoAgricola {
  // Campos de Controle
  id?: number;
  usuarioId?: number;
  
  versao?: string;
  
  // ===== ESCOPO 1 - 20 CAMPOS =====
  
  // SETOR Classificação
  classe?: string;
  especificacao?: string;
  
  // SETOR Teor de macronutrientes
  teorNitrogenio?: number; // Nitrogênio (N) %
  teorFosforo?: number;    // Fósforo (P₂O₅) %
  teorPotassio?: number;   // Potássio (K₂O) %
  
  // SETOR Fator de conversão
  fatorConversao?: number;        // Valor
  fatorConversaoUnidade?: string; // Unidade
  
  // SETOR Quantidade e unidade de referência
  quantidade?: number;         // Quantidade
  unidadeReferencia?: string;  // Unidade de referência
  
  // SETOR Fatores de emissão
  feCo2Biogenico?: number;           // FE CO₂ biogênico (kg CO₂ kg⁻¹)
  refFeCo2Biogenico?: string;        // Referência FE CO₂ biogênico
  feCo2?: number;                    // FE CO₂ (kg CO₂ kg⁻¹)
  refFeCo2?: string;                 // Referência FE CO₂
  feCh4?: number;                    // FE CH₄ (kg CH₄ kg⁻¹)
  refFeCh4?: string;                 // Referência FE CH₄
  feN2oDireto?: number;              // FE N₂O direto (kg N₂O kg⁻¹)
  refFeN2oDireto?: string;           // Referência FE N₂O direto
  fracN2oVolatilizacao?: number;     // FRAC N₂O volatilização (kg N₂O kg⁻¹)
  refFracN2oVolatilizacao?: string;  // Referência FRAC N₂O volatilização
  fracN2oLixiviacao?: number;        // FRAC N₂O lixiviação (kg N₂O kg⁻¹)
  refFracN2oLixiviacao?: string;     // Referência FRAC N₂O lixiviação
  feN2oComposto?: number;            // FE N₂O composto (kg N₂O kg⁻¹)
  refFeN2oComposto?: string;         // Referência FE N₂O composto
  feCo?: number;                     // FE CO
  refFeCo?: string;                  // Referência FE CO
  feNox?: number;                    // FE NOx
  refFeNox?: string;                 // Referência FE NOx
  
  // ===== ESCOPO 3 - 17 CAMPOS =====
  
  // SETOR Identificação e classificação
  grupoIngrediente?: string;  // Grupo do ingrediente alimentar
  nomeProduto?: string;       // Nome do produto
  tipoProduto?: string;       // Tipo
  
  // SETOR Quantidade e unidade de referência
  qtdProdutoReferencia?: number; // Quantidade do produto de referência
  unidadeProdutoReferencia?: string;    // Unidade do produto de referência
  
  // SETOR Quantidade e unidade
  quantidadeProduto?: number; // Quantidade do produto
  unidadeProduto?: string;    // Unidade do produto
  
  // SETOR Valores de emissões (GEE)
  geeTotal?: number;                           // GEE Total
  gwp100Total?: number;                        // GWP 100 - Total
  gwp100Fossil?: number;                       // GWP 100 - Fóssil
  gwp100Biogenico?: number;                    // GWP 100 - Biogênico
  gwp100Transformacao?: number;                // GWP 100 - Transformação do uso do solo
  dioxidoCarbonoFossil?: number;               // Dióxido de carbono - Fóssil
  co2Ch4Transformacao?: number;                // CO₂ CH₄ Transformação
  metanoFossil?: number;                       // Metano - Fóssil
  metanoBiogenico?: number;                    // Metano - Biogênico
  oxidoNitroso?: number;                       // Óxido nitroso
  outrasSubstancias?: number;                  // Outras substâncias
  dioxidoCarbonoMetanoTransformacao?: number;  // CO₂ CH₄ Transformação
  
  // SETOR Observações
  comentarios?: string; // Comentários
  
  // Campos de auditoria
  dataCriacao?: string;
  ultimaAtualizacao?: string;
  ativo?: boolean;
}

export interface InsumoProducaoAgricolaRequest {
  // Campos de controle
  usuarioId?: number;
  
  versao?: string;
  
  // ===== ESCOPO 1 - 20 CAMPOS =====
  
  // SETOR Classificação
  classe?: string;
  especificacao?: string;
  
  // SETOR Teor de macronutrientes
  teorNitrogenio?: number;
  teorFosforo?: number;
  teorPotassio?: number;
  
  // SETOR Fator de conversão
  fatorConversao?: number;
  unidadeFatorConversao?: string;
  
  // SETOR Quantidade e unidade de referência
  quantidade?: number;
  unidadeReferencia?: string;
  
  // SETOR Fatores de emissão
  feCo2Biogenico?: number;
  refFeCo2Biogenico?: string;
  feCo2?: number;
  refFeCo2?: string;
  feCh4?: number;
  refFeCh4?: string;
  feN2oDireto?: number;
  refFeN2oDireto?: string;
  fracN2oVolatilizacao?: number;
  refFracN2oVolatilizacao?: string;
  fracN2oLixiviacao?: number;
  refFracN2oLixiviacao?: string;
  feN2oComposto?: number;
  refFeN2oComposto?: string;
  feCo?: number;
  refFeCo?: string;
  feNox?: number;
  refFeNox?: string;
  
  // ===== ESCOPO 3 - 17 CAMPOS =====
  
  // SETOR Identificação e classificação
  grupoIngrediente?: string;
  nomeProduto?: string;
  tipoProduto?: string;
  
  // SETOR Quantidade e unidade de referência
  qtdProdutoReferencia?: number;
  unidadeProdutoReferencia?: string;
  
  // SETOR Quantidade e unidade
  quantidadeProduto?: number;
  unidadeProduto?: string;
  
  // SETOR Valores de emissões (GEE)
  geeTotal?: number;
  gwp100Total?: number;
  gwp100Fossil?: number;
  gwp100Biogenico?: number;
  gwp100Transformacao?: number;
  dioxidoCarbonoFossil?: number;
  co2Ch4Transformacao?: number;
  metanoFossil?: number;
  metanoBiogenico?: number;
  oxidoNitroso?: number;
  outrasSubstancias?: number;
  dioxidoCarbonoMetanoTransformacao?: number;
  
  // SETOR Observações
  comentarios?: string;
}

export interface InsumoProducaoAgricolaResponse {
  // Campos de controle
  id: number;
  usuarioId: number;
  
  versao?: string;
  
  // ===== ESCOPO 1 - 20 CAMPOS =====
  
  // SETOR Classificação
  classe?: string;
  especificacao?: string;
  
  // SETOR Teor de macronutrientes
  teorNitrogenio?: number;
  teorFosforo?: number;
  teorPotassio?: number;
  
  // SETOR Fator de conversão
  fatorConversao?: number;
  fatorConversaoUnidade?: string;
  
  // SETOR Quantidade e unidade de referência
  quantidade?: number;
  unidadeReferencia?: string;
  
  // SETOR Fatores de emissão
  feCo2Biogenico?: number;
  refFeCo2Biogenico?: string;
  feCo2?: number;
  refFeCo2?: string;
  feCh4?: number;
  refFeCh4?: string;
  feN2oDireto?: number;
  refFeN2oDireto?: string;
  fracN2oVolatilizacao?: number;
  refFracN2oVolatilizacao?: string;
  fracN2oLixiviacao?: number;
  refFracN2oLixiviacao?: string;
  feN2oComposto?: number;
  refFeN2oComposto?: string;
  feCo?: number;
  refFeCo?: string;
  feNox?: number;
  refFeNox?: string;
  
  // ===== ESCOPO 3 - 17 CAMPOS =====
  
  // SETOR Identificação e classificação
  grupoIngrediente?: string;
  nomeProduto?: string;
  tipoProduto?: string;
  
  // SETOR Quantidade e unidade de referência
  quantidadeProdutoReferencia?: number;
  unidadeProdutoReferencia?: string;
  
  // SETOR Quantidade e unidade
  quantidadeProduto?: number;
  unidadeProduto?: string;
  
  // SETOR Valores de emissões (GEE)
  geeTotal?: number;
  gwp100Total?: number;
  gwp100Fossil?: number;
  gwp100Biogenico?: number;
  gwp100Transformacao?: number;
  dioxidoCarbonoFossil?: number;
  co2Ch4Transformacao?: number;
  metanoFossil?: number;
  metanoBiogenico?: number;
  oxidoNitroso?: number;
  outrasSubstanciasEscopo3?: number;
  dioxidoCarbonoMetanoTransformacao?: number;
  
  // SETOR Observações
  comentarios?: string;
  
  // Campos de Auditoria
  dataCriacao: string;
  ultimaAtualizacao?: string;
  ativo?: boolean;
}